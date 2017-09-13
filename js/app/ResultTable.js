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

  /**
   * Returns a direct accessor of FieldUsages to corresponding table columns.
   * WARNING: only works if the table is column-major!!
   * @param table
   * @return {*}
   * @private
   */
  function getByFuAccessor(table, fu2idx) {
    let byfu = new Map();
    table.fu2idx.forEach((idx, fu) => byfu.set(fu, table[idx]));
    return byfu;
  }

  /**
   * Attaches the extent of each column of a (row-major) result table under the attribute .extent and returns the modified table.
   * Naturally this requires each row of the table to have equal number of items. A RangeError is raised otherwise.
   * Note that a result table is expected, which has .idx2fu property.
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
      table = _attachExtent(table);
      if (prop) {
        if (!collection[rIdx][cIdx])
          collection[rIdx][cIdx] = {};
        collection[rIdx][cIdx][prop] = table;
      } else
        collection[rIdx][cIdx] = table;
    });
  }

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
     *
     * All filters of the VisMEL query are preserved.
     *
     * When executing the resulting query, you will get a result table with columns in a certain order, as follows:
     *
     *   1. column:
     *     * idx: 0
     *     * name: 'data vs model'
     *     * fieldUsage: A Split or a Filter on the 'data vs model' Field.
     *   2. column:
     *     * idx: 1
     *     * name: the name of the field which is on rows/cols in the VisMEL query
     *     * fieldUsage: the fielsUsage which is on rows/cols in the VisMEL query
     *   3. column:
     *     * idx: 2
     *     * name: density[<all involved fields>])
     *     * fieldUsage: a new Density FieldUsage over all splits
     *   4.+ the rest of the Fields that is possibly split by
     *
     * Handling the model vs data field (mvd):
     *
     *   case 1: mvd is entirely unused in the base VisMEL query.
     *     -> then
     *
     *
     * @param vismelQuery The VisMEL query to derive the PQL query from.
     * @param rowsOrCols There is up to two marginal density queries from a VisMEL query, one for the FieldUsage on Layout.Rows and one for the FieldUsage on Layout.Cols. Accordingly, this parameter may have the value 'rows' or 'cols'.
     * @param model The model against which the resulting query is executed later.
     * @return {*}
     */
    uniDensity: (vismelQuery, rowsOrCols, model) => {
      if (rowsOrCols !== 'cols' && rowsOrCols !== 'rows')
        throw new RangeError("rowsOrCols must be 'rows' or 'cols' but is:" + rowsOrCols.toString());

      let axisFieldUsage = vismelQuery.layout[rowsOrCols][0];
      if (!PQL.isFieldUsage(axisFieldUsage)) {
        // nothing to do! set result table to empty and return fullfilled promise
        return Promise.resolve(_emptyResultTable())
      }

      // collect splits from aesthetics and details
      let splits = vismelQuery.fieldUsages(['layout', 'filters'], 'exclude').filter(PQL.isSplit);

      // find (index of) split on data vs model
      let mvd_split_idx = splits.indexOf(split => split.name === 'model vs data');
      let mvd_split = []; // this is an array on purpose, even though it as one element at maximum
      if (mvd_split_idx !== -1) {
        mvd_split = [splits[mvd_split_idx]];
        splits = splits.splice(mvd_split_idx, 1); // removes mvd_split
      }

      // create new split for univariate density
      let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'density');

      // create new univariate density field usage
      let fields4density = [...splits, densitySplit].map(split => split.field);
      let densityUsage = new PQL.Density(fields4density);

      // TODO: ich denk es ist besser, wenn wir keinen split hinzufügen, falls noch kein filter oder split da ist - das entspricht auch der Verfahrensweise bei dem original VisMEL query
      // noch besser: default explizit machen, d.h.: default is: filter auf model only.

      // if there is not yet already a filter on model vs data or a split on model vs data ...
      let filters = vismelQuery.fieldUsages(['filters'], 'include');
      if(!filters.find(elem => elem.name === 'model vs data')
        && mvd_split_idx == -1) {
        // .. then add a (new) filter on model vs data == model
        filters.push(PQL.Filter.ModelVsDataFilter(model, 'model'));
        // .. and add a (new) equi split on model vs data
        mvd_split = [PQL.Split.ModelVsDataSplit(model, 'identity')]  // need that identity split for consistency
        //splits.push(PQL.Split.ModelVsDataSplit(model));
      }

      // build accessor maps
      query_predict_ ...
      // TODO: fix this. problem is hier scheinbar wieder: 'model vs data'. denn es hat nicht immer ein FieldUsage... nämlich nicht, falls wir den Default Fall annehmen (default: model only)
      let fu2idx = new Map();
      let idx2fu = splits.concat(densityUsage);
      idx2fu.forEach((fu, idx) => fu2idx.set(fu, idx));

      let query = {
        'type': 'predict',
        'predict': ['model vs data', densitySplit.name, densityUsage, ...splits.map(split => split.name)],
        'splitby': [...mvd_split, densitySplit, ...splits],
        'filter': filters
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

  /**
   * Derives for each VisMEL query and each model in the given collection the corresponding PQL
   * query, executes it and stores both, the query and its result, in a 2d array collection. A call to this function returns a promise to the collection.
   *
   * Each element of the collection is a ResultTable, i.e. a row-major list of lists which stores the result of a query in tabular form. An individual entry of the can be accessed via [rowIdx][columnIdx].
   *
   * It has additional properties as follows:
   *
   *  * .header: a list of names for the columns of the table
   *  * .query: the PQL query whose execution resulted in this result table
   *  * .fu2idx, .idx2fu: see vismel2pql documentation.
   *
   *
   * Since the collection is merely an 2d array, elements can be accessed using the standard [] notation
   * @param queryCollection
   * @param modelCollection
   * @return {Promise.<Array>}
   */
  function aggrCollection(queryCollection, modelCollection) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        // generate and run PQL query
        let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.aggregation(queryCollection.at[rIdx][cIdx]);
        let promise = _runAndaddRTtoCollection(modelCollection.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  /**
   * See aggr Collection
   * @param queryCollection
   * @param model
   * @return {Promise.<Array>}
   */
  function samplesCollection(queryCollection, model) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.samples(queryCollection.at[rIdx][cIdx]);
        let promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  /**
   * An UniDensityResultTable creates marginal density queries for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accessed via the attribute [][].x and [][].y where .x refers to the x axis and y to the y axis.
   *
   * [][].x exists iff the respective VisMEL query had any FieldUsage on columns. Similarly for [][].y and a required FieldUsage on Rows.
   *
   * For the layout of the individual result tables see vismel2pq.uniDensity().
   *
   * @param queryCollection
   * @param model
   * @return {Promise.<Array>}
   */
  function uniDensityCollection(queryCollection, model) {
    let size = queryCollection.size;
    let collection = new Array(size.rows);
    collection.size = size;
    let fetchPromises = new Set(); //.add(Promise.resolve());
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      collection[rIdx] = new Array(size.cols);
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        // for all combinations of (model, data) and (rows, cols) // TODO
        let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.uniDensity(queryCollection.at[rIdx][cIdx], 'cols', model);
        let promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, 'x');
        fetchPromises.add(promise);
        ({query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.uniDensity(queryCollection.at[rIdx][cIdx], 'rows', model));
        promise = _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, 'y');
        fetchPromises.add(promise);
      }
    }
    return Promise.all(fetchPromises).then(() => collection);
  }

  /**
   * See aggr Collection
   * @param queryCollection
   * @param model
   * @return {Promise.<Array>}
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
    biDensityCollection,
    getByFuAccessor
  };
});
