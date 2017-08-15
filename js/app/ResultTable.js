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
   * Attaches the extent of each column of a (row-based) table under the attribute .extent and returns the modified table.
   * Naturally this requires each row of the table to have equal number of items. A RangeError is raised otherwise.
   * Note that the passed table is expected to have a .fu attribute, which describes the FieldUsage of each column.
   */
  function _attachExtent (table) {
    if (table.length === 0 || table[0].length === 0)
      table.extent = [];
    else {
      let cols = table[0].length;
      let extent = new Array(cols);
      for (let i = 0; i < cols; ++i) {
        if (table.fu[i].yieldDataType === PQL.FieldT.DataType.num)
          extent[i] = d3.extent(table, row => row[i]); // jshint ignore:line
        else if (table.fu[i].yieldDataType === PQL.FieldT.DataType.string)
          extent[i] = _.unique(_.map(table, row => row[i]));
        else
          throw new RangeError("invalid data type.");
      }
      table.extent = extent;
    }
    return table;
  }

  //
  // /**
  //  * Abstract ResultTable class which provides a method to fetch a certain type of result for each atomic query
  //  */
  // class ResultTable {
  //
  //   fetch() {
  //     let that = this;
  //     let fetchPromises = new Set().add(Promise.resolve());
  //     for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
  //       this.at[rIdx] = new Array(this.size.cols);
  //       for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
  //         let promise = this.dataSelect(this._qt.at[rIdx][cIdx])
  //           .then(result => {that.at[rIdx][cIdx] = result;}); // jshint ignore:line
  //         fetchPromises.add(promise);
  //       }
  //     }
  //     return Promise.all(fetchPromises);
  //   }
  // }

  /**
   * An aggregation result table holds a table of aggregations queries and provides the method fetch to execute these queries. The results are then stored in a result table. Each cell of the result table holds its own data, and is accessed by its row and column index via the 'at' property.
   *
   * Outdated: The 'at' property contains no information about what FieldUsages are encoded in what index. Therefore, a
   * {@link AggrResultTable} has an 'indexes' property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:!isAggrDensity && firstAggrDensity
   * @constructor
   */
  class AggrResultTable {

    constructor(modelTable, queryTable) {
      this._qt = queryTable;
      this._mt = modelTable;
      this.size = queryTable.size;
      this.at = new Array(this.size.rows);
    }

    /**
     * Aggregates the given model according to the given atomic query into a result table.
     *
     * # Map from FieldUsages to columns in result table:
     * In order to know which {@link FieldUsage} of the query is represented by which column of the result table,
     * an attribute 'index' is attached to each field usage of the query.
     *
     * # Map from columns in result table to FieldUsages:
     * The reverse mapping is provided by the attribute 'fu' on the table itself,
     * where '.fu[i]' maps to the corresponding {@link FieldUsage} of the i-th column of the result table.
     *
     * @param model The model to aggregate.
     * @param query The atomic query to the model.
     * @returns {*} A Promise to the result table.
     * @private
     */
    aggregate (model, query) {

      if (model === undefined)
        throw RangeError("model is undefined");
      if (query === undefined)
        throw RangeError("query is undefined");

      // note:
      // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
      // - multiple measures of the same field are possible

      // 1. build list of split fields and aggregate fields, and attach indices to FieldUsages of query

      // note: in the general case query.fieldUsages() and [...dimensions, ...measures] do not contain the same set of
      //  field usages, as duplicate dimensions won't show up in dimensions
      // TODO: it's not just about the same method, is just should be the same Split! Once I implemented this possiblity (see "TODO-reference" in interaction.js) no duplicate split should be allowed at all!

      var fieldUsages = query.fieldUsages();
      var dimensions = [];
      var idx2fu = [];
      let idx = 0;
      fieldUsages.filter(PQL.isSplit).forEach( fu => {
        // todo: this kind of comparison is ugly and slow for the case of many dimensions
        // how to make it better: build boolean associative array based on fu.base -> then the find becomes a simple lookup
        let sameBase = dimensions.find(elem => (fu.name === elem.name));
        if (sameBase) {
          // fu is already there
          if (fu.method === sameBase.method /*|| fu.method === 'identity'*/)
            fu.index = sameBase.index;
          else
            throw new RangeError("If using multiple splits of the same field in an atomic query, either their splitter methods must match, or at most one may split differently than by 'identity'!");
        }
        else {
          // fu is new
          fu.index = idx++;
          idx2fu.push(fu);
          dimensions.push(fu);
        }
      });

      var measures = [];
      fieldUsages.filter(fu => PQL.isAggregation(fu) || PQL.isDensity(fu)).forEach( fu => {
        fu.index = idx++;
        idx2fu.push(fu);
        measures.push(fu);
      });

      // run PQL query
      return model.predict(
        [...dimensions, ...measures],
        [],
        dimensions,
        query.mode
      ).then( table => {
        table.fu = idx2fu;
        return _attachExtent(table);
      });
    }

    fetch() {
      var that = this;
      let fetchPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        this.at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let promise = this.aggregate(this._mt.at[rIdx][cIdx], this._qt.at[rIdx][cIdx])
            .then(result => {that.at[rIdx][cIdx] = result;}); // jshint ignore:line
          fetchPromises.add(promise);
        }
      }
      return Promise.all(fetchPromises);
    }
  }

  /**
   * A data result table contains
   */
  class DataResultTable {

    constructor(queryTable, model) {
      this._qt = queryTable;
      this._model = model;
      this.size = queryTable.size;
      this.at = new Array(this.size.rows);
    }

    dataSelect(query) {
      if (query === undefined)
        throw RangeError("query is undefined");

      // note:
      // we derive the data-select query from a PQL/VisMEL query as follows:
      //  * filters: stay unchanged as filters
      //  * splits: add the name of what is split to the select-clause
      //  * aggregations: add the name of the field that is the yield of the aggregation to the select-clause
      //  * densities: ignore them. A valid density anyway requires a split - which is handleled above
      // note2: we need to detect multiple usages of the same name and add indices later accordingly

      let idx2fu = [];
      let idx = 0;
      let select = new Map();  // map of <field-name to select> to <index of column in result-table>
      let filters = [];
      for (let fu of query.fieldUsages()) {
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
          fu.dataIndex = select.get(name);
        } else {
          fu.dataIndex = idx;
          select.set(name, idx);
          idx2fu.push(fu);
          idx++;
        }
      }

      // run PQL query
      return this._model.select(
        Array.from(select.keys()),
        filters
      ).then(table => {
        table.fu = idx2fu;
        return _attachExtent(table);
      });
    }

    fetch() {
      let that = this;
      let fetchPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        this.at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let promise = this.dataSelect(this._qt.at[rIdx][cIdx])
            .then(result => {that.at[rIdx][cIdx] = result;}); // jshint ignore:line
          fetchPromises.add(promise);
        }
      }
      return Promise.all(fetchPromises);
    }
  }


  /**
   * An UniDensityResultTable creates marginal density queries for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accesed via the attribute .at[][].x and at[][].y where .x refers tothe x axis and y to the y axis.
   *
   * TODO: alternative: extend the aggregation query that is anyway issued. This perform better!?
   */
  class UniDensityResultTable {

    constructor(queryTable, model) {
      this._qt = queryTable;
      this._model = model;
      this.size = queryTable.size;
      this.at = new Array(this.size.rows);
    }

   static marginalSelect(query, model, rowOrCol) {
     /* there is up to two marginal density queries from a VisMEL query, one for the FieldUsage on Layout.Rows and one for the FieldUsage on Layout.Cols. */

      let axisFieldUsage = query.layout[rowOrCol][0];
      if (!PQL.isFieldUsage(axisFieldUsage)) {
        // nothing to do! set result table to empty and return fullfilled promise
        return Promise.resolve([])
      }

      // collect splits from aesthetics and details shelves
      let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'density');
      let splits = query.fieldUsages(['layout','filters']).filter(PQL.isSplit);
      splits.push(densitySplit);
      splits.fields = splits.map(split => split.field);
      splits.names =  splits.map(split => split.name);

      let densityUsage = new PQL.Density(splits.fields);

      // build idx2fu map
      let idx2fu = splits.concat(densityUsage);

      // run PQL query
      return model.predict(splits.names.concat(densityUsage), [], splits)
        .then(table => {
          table.fu = idx2fu;  // todo: what is that?
          return _attachExtent(table);
      });
    }

    fetch() {
      let at = this.at;
      let fetchPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let query = this._qt.at[rIdx][cIdx];
          at[rIdx][cIdx] = {};
          let promiseX = UniDensityResultTable.marginalSelect(query, this._model, 'cols')
            .then(result => {at[rIdx][cIdx].x = result;}); // jshint ignore:line
          fetchPromises.add(promiseX);
          let promiseY = UniDensityResultTable.marginalSelect(query, this._model, 'rows')
            .then(result => {at[rIdx][cIdx].y = result;}); // jshint ignore:line
          fetchPromises.add(promiseY);
        }
      }
      return Promise.all(fetchPromises);
    }
  }


  /**
   * A BiDensityResultTable creates a 2d density queries over the FieldUsage on the X and Y axis. It does it for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accesed via the attribute .at.
   */
  class BiDensityResultTable {

    constructor(queryTable, basemodel) {
      this._qt = queryTable;
      this._model = basemodel;
      this.size = queryTable.size;
      this.at = new Array(this.size.rows);
    }

    /**
     * Constructs and runs a query for the 2d density over the fields of rows and cols
     **/
    static densityPredict(query, model) {
      // can only get density if there is something on rows and cols
      let xfu = query.layout.cols[0];
      let yfu = query.layout.rows[0];
      if (!PQL.isFieldUsage(xfu) || !PQL.isFieldUsage(yfu)) {
        // nothing to do! set result table to empty and return fullfilled promise
        return Promise.resolve([])
      }

      let xSplit = PQL.Split.FromFieldUsage(xfu, 'density');
      let ySplit = PQL.Split.FromFieldUsage(yfu, 'density');
      let densityFu = new PQL.Density([xSplit.field, ySplit.field]);

      let idx2fu = [xSplit, ySplit, densityFu];

      // run PQL query
      return model.predict([xSplit.name, ySplit.name, densityFu], model.filter, [xSplit, ySplit])
        .then(table => {
          table.fu = idx2fu;  // todo: what is that?
          return _attachExtent(table);
        });
    }

    fetch() {
      let at = this.at;
      let fetchPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let query = this._qt.at[rIdx][cIdx];
          let promise = BiDensityResultTable.densityPredict(query, this._model)
            .then(result => at[rIdx][cIdx] = result); // jshint ignore:line
          fetchPromises.add(promise);
        }
      }
      return Promise.all(fetchPromises);
    }
  }

  return {
    AggrResultTable: AggrResultTable,
    DataResultTable: DataResultTable,
    UniDensityResultTable: UniDensityResultTable,
    BiDensityResultTable: BiDensityResultTable
  };

  //return ResultTable;
});