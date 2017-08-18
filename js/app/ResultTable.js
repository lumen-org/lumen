/**
 * @module ResultTable
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', './PQL'], function (Logger, d3, PQL) {
  "use strict";

  var logger = Logger.get('pl-ResultTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Returns an empty result table.
   * @private
   */
  function _emptyResultTable() {
    let res = [];
    res.header = [];
    res.idx2fu = [];
    res.fu2idx = new Map();
    return res;
  }

  function _attachByFU(table) {
    let byfu = new Map();
    table.fu2idx.forEach((idx, fu) => byfu.set(fu, table[idx]));
    table.byFu = byfu;
    return table;
  }

  /**
   * Attaches the extent of each column of a (row-based) table under the attribute .extent and returns the modified table.
   * Naturally this requires each row of the table to have equal number of items. A RangeError is raised otherwise.
   * Note that the passed table is expected to have a .fu attribute, which describes the FieldUsage of each column.
   */
  function _attachExtent(table) {
    if (table.length === 0 || table[0].length === 0)
      table.extent = [];
    else {
      let cols = table[0].length;
      let extent = new Array(cols);
      for (let i = 0; i < cols; ++i) {
        if (table.idx2fu[i].yieldDataType === PQL.FieldT.DataType.num)
          extent[i] = d3.extent(table, row => row[i]); // jshint ignore:line
        else if (table.idx2fu[i].yieldDataType === PQL.FieldT.DataType.string)
          extent[i] = _.unique(_.map(table, row => row[i]));
        else
          throw new RangeError("invalid data type.");
      }
      table.extent = extent;
    }
    return table;
  }

  function _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, prop = undefined) {
    return model.execute(pql).then(table => {
      //table.fu = idx2fu;
      table.idx2fu = idx2fu;
      table.fu2idx = fu2idx;
      table.query = pql;
      table = _attachExtent(_attachByFU(table));
      if (prop) {
        if (!collection[rIdx][cIdx])
          collection[rIdx][cIdx] = {};
        collection[rIdx][cIdx][prop] = table;
      } else
        collection[rIdx][cIdx] = table;
    });
  }

  /**
   * An aggregation result table holds a table of aggregations queries and provides the method fetch to execute these queries. The results are then stored in a result table. Each cell of the result table holds its own data, and is accessed by its row and column index via the 'at' property.
   *
   * Outdated: The 'at' property contains no information about what FieldUsages are encoded in what index. Therefore, a
   * {@link AggrResultTable} has an 'indexes' property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:!isAggrDensity && firstAggrDensity
   * @constructor
   */

  /**
   * A collection of translation methods that converts a given VisMEL query into a PQL query.
   *
   * All return an object with three properties: query, fu2idx, idx2fu, as follows:
   *
   *   query: the generated PQL query.
   *
   *   fu2idx: a Map from the FieldUsage s of the VisMEL query to their corresponding column index in the result of the query. This encodes which {@link FieldUsage} of the VisMEL query is represented by which column of the result table.
   *
   *   idx2fu: an array that maps a row index of the result of the query to the corresponding FieldUsage.
   */
  let vismel2pql = {
    /**
     * Translates a VisMEL query into a PQL query of the aggregations requested in the VisMEL query.
     * @param vismelQuery
     * @return {query, fu2idx, idx2fu}
     */
    aggregation: (vismelQuery) => {
      // note:
      // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
      // - multiple measures of the same field are possible

      // 1. build list of split fields and aggregate fields, and attach indices to FieldUsages of query

      // note: in the general case query.fieldUsages() and [...dimensions, ...measures] do not contain the same set of
      //  field usages, as duplicate dimensions won't show up in dimensions
      // TODO: it's not just about the same method, is just should be the same Split! Once I implemented this possiblity (see "TODO-reference" in interaction.js) no duplicate split should be allowed at all!

      let fieldUsages = vismelQuery.fieldUsages(),
        dimensions = [],
        fu2idx = new Map(),
        idx2fu = [],
        idx = 0;

      fieldUsages.filter(PQL.isSplit).forEach(fu => {
        // todo: this kind of comparison is ugly and slow for the case of many dimensions
        // how to make it better: build boolean associative array based on fu.base -> then the find becomes a simple lookup
        let sameBase = dimensions.find(elem => (fu.name === elem.name));
        if (sameBase) {
          // fu is already there
          if (fu.method === sameBase.method /*|| fu.method === 'identity'*/) {
            fu.index = sameBase.index;
            fu2idx.set(fu, sameBase.index);
          } else
            throw new RangeError("If using multiple splits of the same field in an atomic query, either their splitter methods must match, or at most one may split differently than by 'identity'!");
        }
        else {
          // fu is new
          fu.index = idx;
          idx2fu.push(fu);
          fu2idx.set(fu, idx);
          dimensions.push(fu);
          idx++;
        }
      });

      let measures = [];
      fieldUsages
        .filter(fu => PQL.isAggregationOrDensity(fu))
        .forEach(fu => {
          fu.index = idx;
          idx2fu.push(fu);
          fu2idx.set(fu, idx);
          measures.push(fu);
          idx++;
        });

      let query = {
        'type': 'predict',
        'predict': [...dimensions, ...measures],
        'splitby': dimensions,
        'mode': vismelQuery.mode
      };

      return {query, fu2idx, idx2fu};
    },

    samples: (vismelQuery) => {
// note:
      // we derive the data-select query from a PQL/VisMEL query as follows:
      //  * filters: stay unchanged as filters
      //  * splits: add the name of what is split to the select-clause
      //  * aggregations: add the name of the field that is the yield of the aggregation to the select-clause
      //  * densities: ignore them. A valid density anyway requires a split - which is handleled above
      // note2: we need to detect multiple usages of the same name and add indices later accordingly

      let idx2fu = [],
        idx = 0,
        fu2idx = new Map(),
        select = new Map();  // map of <field-name to select> to <index of column in result-table>
      let filters = [];
      for (let fu of vismelQuery.fieldUsages()) {
        let name;
        if (PQL.isFilter(fu)) {
          filters.push(fu);
          continue;
        }
        else if (PQL.isSplit(fu))
          name = fu.name;
        else if (PQL.isAggregation(fu))
          name = fu.yields;
        else if (PQL.isDensity(fu))
          continue;
        else
          throw RangeError('Unknown object in field usages: ' + fu.toString());

        // DEBUG: assert that it doesn't have a dataIndex yet
        //if ('dataIndex' in fu)
        //  throw RangeError("it shouldnt have an index yet. its value is: " + fu.dataIndex.toString());

        if (select.has(name)) {
          // don't add again but reuse the stored index
          let prev_idx = select.get(name);
          fu.dataIndex = prev_idx;
          fu2idx.set(fu, prev_idx);
        } else {
          fu.dataIndex = idx;
          fu2idx.set(fu, idx);
          select.set(name, idx);
          idx2fu.push(fu);
          idx++;
        }
      }

      let query = {
        'type': 'select',
        'select': Array.from(select.keys()),
        //'where': filters
      };
      return {query, fu2idx, idx2fu}
    },

    /**
     * An UniDensityResultTable creates marginal density queries for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accesed via the attribute .at[][].x and at[][].y where .x refers tothe x axis and y to the y axis.
     */
    uniDensity: (vismelQuery, rowOrCol) => {

      /* there is up to two marginal density queries from a VisMEL query, one for the FieldUsage on Layout.Rows and one for the FieldUsage on Layout.Cols. */

        let axisFieldUsage = vismelQuery.layout[rowOrCol][0];
        if (!PQL.isFieldUsage(axisFieldUsage)) {
          // nothing to do! set result table to empty and return fullfilled promise
          return Promise.resolve(_emptyResultTable())
        }

        // collect splits from aesthetics and details shelves
        let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'density');
        let splits = vismelQuery.fieldUsages(['layout', 'filters']).filter(PQL.isSplit);
        splits.push(densitySplit);
        splits.fields = splits.map(split => split.field);
        splits.names = splits.map(split => split.name);

        let densityUsage = new PQL.Density(splits.fields);

        // build maps
        let fu2idx = new Map();
        let idx2fu = splits.concat(densityUsage);
        idx2fu.forEach((fu, idx) => fu2idx.set(fu, idx));

      let query = {
        'type': 'predict',
        'predict': splits.names.concat(densityUsage),
        'splitby': splits
      };
      return {query, fu2idx, idx2fu}
    },

    /**
     * Given a VisMEL query, it constructs a PQL query for the 2d density over the fields of rows and cols.
     * */
    biDensity: (vismelQuery) => {
      // can only get density if there is something on rows and cols
      let xfu = vismelQuery.layout.cols[0];
      let yfu = vismelQuery.layout.rows[0];
      if (!PQL.isFieldUsage(xfu) || !PQL.isFieldUsage(yfu)) {
        // nothing to do! set result table to empty and return fullfilled promise
        return Promise.resolve(_emptyResultTable())
      }

      let xSplit = PQL.Split.FromFieldUsage(xfu, 'density');
      let ySplit = PQL.Split.FromFieldUsage(yfu, 'density');
      let densityFu = new PQL.Density([xSplit.field, ySplit.field]);

      let idx2fu = [xSplit, ySplit, densityFu];
      let fu2idx = new Map();
      idx2fu.forEach((fu, idx) => fu2idx.set(fu, idx));

      let query = {
        'type': 'predict',
        'predict': [xSplit.name, ySplit.name, densityFu],
        //'where': model.filter,
        'splitby': [xSplit, ySplit]
      };

      return {query, fu2idx, idx2fu}
    }
  };

  function aggrCollection(queryCollection, modelCollection) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        // generate and run PQL query
        let {query:pql, fu2idx:fu2idx, idx2fu:idx2fu} = vismel2pql.aggregation(queryCollection.at[rIdx][cIdx]);
        let promise = _runAndaddRTtoCollection(modelCollection.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  function samplesCollection(queryCollection, model) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        let {query:pql, fu2idx:fu2idx, idx2fu:idx2fu} = vismel2pql.samples(queryCollection.at[rIdx][cIdx]);
        let promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  function uniDensityCollection(queryCollection, model) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        // for all combinations of (model, data) and (rows, cols) // TODO
        let {query:pql, fu2idx:fu2idx, idx2fu:idx2fu} = vismel2pql.uniDensity(queryCollection.at[rIdx][cIdx], 'cols');
        let promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, 'x');
        fetchPromises.add(promise);
        ({query:pql, fu2idx:fu2idx, idx2fu:idx2fu} = vismel2pql.uniDensity(queryCollection.at[rIdx][cIdx], 'rows'));
        promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, 'y');
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  /**
   * A BiDensityResultTable creates a 2d density queries over the FieldUsage on the X and Y axis. It does it for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accesed via the attribute .at.
   */
  function biDensityCollection(queryCollection, model) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let pql, fu2idx, idx2fu;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.biDensity(queryCollection.at[rIdx][cIdx]);
        let promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  return {
    aggrCollection,
    samplesCollection,
    uniDensityCollection,
    biDensityCollection
  };
});
