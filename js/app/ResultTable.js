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


  /**
   * A ResultTable contains the raw data that are the (sampled) answers to the actual queries to the model(s).
   * Each cell of the result table holds its own data, and is accessed by its row and column index via the 'at' property.
   *
   * Outdated: The 'at' property contains no information about what FieldUsages are encoded in what index. Therefore, a
   * {@link ResultTable} has an 'indexes' property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:ResultTable
   * @constructor
   */
  class ResultTable {

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
     * an attribute 'index' is attached to each field usages of the query.
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
      fieldUsages.filter(PQL.isSplit).forEach(function (fu) {
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

  class DataResultTable {

    constructor(queryTable) {
      this._qt = queryTable;
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
      let select = {};  // dict of <field-name to select> to <index of column in result-table>
      let filters = [];
      for (let fu in query.fieldUsages()) {
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

        // DEBUG: assert that it doesn't have a dataindex yet
        if ('dataindex' in fu)
          throw RangeError("it shouldnt have an index yet. its value is: " + fu.dataindex.toString());

        if (name in select) {
          // don't add again but reuse the stored index
          fu.dataindex = select[name];
        } else {
          fu.dataindex = idx;
          select[name] = idx;
          idx2fu.push(fu);
          idx++;
        }
      }

      // run PQL query
      return model.select(
        select.keys(),
        filters,
        [],
        query.mode // TODO: what is this?
      ).then( table => {
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

  /*return {
    ResultTable: ResultTable,
    DataResultTable: DataResultTable
  };*/

  return ResultTable;
});