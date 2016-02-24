/**
 * @module ResultTable
 * @author Philipp Lucas
 */

define(['lib/logger', './Field'], function (Logger, F) {
  "use strict";

  var logger = Logger.get('pl-ResultTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Joins the two tables a and b
   * naive implementation
   */
  function _join(a, b) {
    var aCols = a.length,
      bCols = b.length,
      cols = aCols + bCols;

    if (aCols === 0) return b;
    if (bCols === 0) return a;

    var aRows = a[0].length,
      bRows = b[0].length,
      rows = aRows * bRows;

    var rowIdx, column, aVal,
      res = new Array(cols);

    // iterate over columns of a
    for (let colIdx = 0; colIdx < aCols; ++colIdx) {
      rowIdx = 0;
      column = new Array(rows);
      // iterate over elements (of current column of a)
      for (let aRowIdx = 0; aRowIdx < aRows; ++aRowIdx) {
        // write each element bRows many times
        aVal = a[colIdx][aRowIdx];
        for (let bRowIdx = 0; bRowIdx < bRows; ++bRowIdx) {
          column[rowIdx] = aVal;
          ++rowIdx;
        }
      }
      res[colIdx] = column;
    }

    // iterate of columns of b
    // similar but instead of repeating the same element, repeat the sequence of all elements
    for (let colIdx = 0; colIdx < bCols; ++colIdx) {
      rowIdx = 0;
      column = new Array(rows);
      // repeat sequence of elements aRows many times
      for (let aRowIdx = 0; aRowIdx < aRows; ++aRowIdx) {
        // iterate over elements (of current column of b)
        for (let bRowIdx = 0; bRowIdx < bRows; ++bRowIdx) {
          column[rowIdx] = b[colIdx][bRowIdx];
          ++rowIdx;
        }
      }
      res[colIdx + aCols] = column;
    }

    return res;
  }


  /**
   * Checks that dimensions based on the same field use the same split function. If not it issues a warning.
   * @param dimensions
   */
  var checkDimensions = function (dimensions) {
    // sort by their name
    dimensions.sort( function(d1, d2) {
      return (d1.name < d2.name ? -1 : (d1.name > d2.name ? 1 : 0) );
    });

    // sequentially check
    // todo implement later
  };


  /**
   * Sample the given model.
   * Note: the parameters dimensions and measures are {@link FieldUsage}s, not {@link Field}s. They contain the required information on how exactly the model is to be sampled.
   * @param model The model to sample.
   * @param {FieldUsage} dimensions The dimensions of the model to sample.
   * @param {FieldUsage} measures The measures of the model to sample.
   * @param rows The precomputed length of the result table.
   * @param nsfe the nsf (normalized set form) element that belongs to this model. This is needed to get the pane specific measure (i.e. on rows or columns).
   * @returns {*} The result table for this pane.
   * @private
   */
  var aggregate = function (model, query) {
    // note:
    // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
    // - multiple measures of the same field are possible and
    // - multi-dimensional measures aren't supported yet

    // 1. generate mapping and empty result table
    // attach index in aggregation table and build of the set of dimensions and measures of the aggregation table
    // note: in the general case query.fieldUsage and [...dimensions, ...measures] do not contain the same set of field usages, as duplicate dimensions won't show up in dimensions
    var fieldUsages = query.fieldUsages();
    var dimensions = [];
    let idx = 0;
    fieldUsages.filter(F.isDimension).forEach( function (fu) {
      let sameBase = dimensions.find( function (e) {
        return (fu.base === e.base);
      });
      if (sameBase) {
        // fu is already there
        if (fu.splitter !== sameBase.splitter)
          throw new RangeError("If using multiple dimensions of the same field in an atomic query, their splitter functions must match!");
        else
          fu.index = sameBase.index;
      }
      else {
        // fu is new
        fu.index = idx++;
        dimensions.push(fu);
      }
    });

    var measures = [];
    fieldUsages.filter(F.isMeasure).forEach( function (fu) {
      fu.index = idx++;
      measures.push(fu);
    });

    // 2. setup input tuples, i.e. calculate the cross product of all dim.sample()
    // pair-wise joins of dimension domains, i.e. create all combinations of dimension domain values
    let inputTable = dimensions.reduce(
      function (table, dim) {
        //use the values of the splitted domain --> pass "true" as arg
        return _join(table, [dim.split(true)]);
      }, []);

    // 3. generate output tuples
    let outputTable = [];
    let len = (inputTable.length === 0 ? 0 : inputTable[0].length);
    measures.forEach( function (m) {
      let column = new Array(len);

      // generate specialized model for the current measure.
      let measureModel = model.copy().marginalize(_.without(measures, m));

      // sample accordingly
      for (let tupleIdx = 0; tupleIdx < len; ++tupleIdx) {

        // condition on dimension values / collect dimension values
        let dimValues = inputTable.map(
          function (v) { return v[tupleIdx]; }
        ); // jshint ignore:line

        // aggregate remaining model
        // need to pass: dimension values of this row of the result table. this will set all remaining variables of the model except for the one measure. Then calculate the aggregation on that measure
        // todo: oh oh: I think I need a model for each aggregation. Maybe better attach sub models to each aggregation in each atomic query?
        column[tupleIdx] = measureModel.aggregate(dimValues, m.aggr);
      }
      outputTable.push(column);
    });

    // todo 4. apply aggregation filters

    // todo 5. return aggregation table

    return [...inputTable, ...outputTable];
  };


   /**
   * A ResultTable contains the raw data that are the (sampled) answers to the actual queries to the model(s). Each cell of the result table holds its own data, and is accessed by its row and column index via the at property.
   *
   * The at propery contains no information about what FieldUsages are encoded in what index. Therefore, a {@link ResultTable} has the indexes property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:ResultTable
   * @constructor
   */
  var ResultTable; ResultTable = function (models, queries) {
    this.size = models.size;
    this.at = new Array(this.size.rows);
    for (let rIdx=0; rIdx<this.size.rows; ++rIdx) {
      this.at[rIdx] = new Array(this.size.cols);
      for (let cIdx=0; cIdx<this.size.cols; ++cIdx) {
        this.at[rIdx][cIdx] = aggregate(models.at[rIdx][cIdx], queries.at[rIdx][cIdx]);
      }
    }
  };

  return ResultTable;
});