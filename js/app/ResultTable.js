/**
 * A result table holds the raw data for a single pane for a VisMEL query.
 *
 * @module ResultTable
 * @author Philipp Lucas
 */

define(['./ModelTable'], function (ModelTable) {
  "use strict";

  /**
   * @param value The value to replicate
   * @param times Times to replicate
   * @returns {Array} Returns an array of length times that contains value as all its elements.
   * @private
   */
  function _repeat(value, times) {
    var array = new Array(times);
    for(var i=0;i<times;++i)
      array[i] = value;
    return array;
  }

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

    var rowIdx, colIdx, aRowIdx, bRowIdx;
    var column, aVal;

    var res = new Array(cols);

    // iterate over columns of a
    for (colIdx = 0; colIdx < aCols; ++colIdx) {
      rowIdx = 0;
      column = new Array(rows);
      // iterate over elements (of current column of a)
      for (aRowIdx = 0; aRowIdx < aRows; ++aRowIdx) {
        // write each element bRows many times
        aVal = a[colIdx][aRowIdx];
        for (bRowIdx = 0; bRowIdx < bRows; ++bRowIdx) {
          column[rowIdx] = aVal;
          ++rowIdx;
        }
      }
      res[colIdx] = column;
    }

    // iterate of columns of b
    // similar but instead of repeating the same element, repeat the sequence of all elements
    for (colIdx = 0; colIdx < bCols; ++colIdx) {
      rowIdx = 0;
      column = new Array(rows);
      // repeat sequence of elements aRows many times
      for (aRowIdx = 0; aRowIdx < aRows; ++aRowIdx) {
        // iterate over elements (of current column of b)
        for (bRowIdx = 0; bRowIdx < bRows; ++bRowIdx){
          column[rowIdx] = b[colIdx][bRowIdx];
          ++rowIdx;
        }
      }
      res[colIdx + aCols] = column;
    }

    return res;
  }


  function _resultTablePerPane(model, dimensions, measures, rows) {
    // todo: performance: let _join work on a preallocated (possibly larger than needed) array
    // pair-wise joins
    var resultTable = dimensions.reduce( function (table, dim) {
      return _join(table, [dim.domain]);
    }, []);

    // add columns for measures
    measures.forEach( function (m) {
      var column = new Array(rows);
      for (var i = 0; i < rows; ++i) {
        // todo: how to do that!?
        // actually I need for each aggregation (be it on multiple fields or not) a separate model!
        column[i] = model.aggregate(
//          todo continue here
          new Array(model.size())
        );
      }
      resultTable.push(column);
    });

    return resultTable;
  }

  /**
   * @alias module:ResultTable
   * @constructor
   */
  var ResultTable; ResultTable = function (modelTable) {
    this.rows = modelTable.rows;
    this.cols = modelTable.cols;
    if (this.rows === 0 || this.cols === 0)
      return; //todo: do I need that?

    // common among all panes
    var dimensions = modelTable.query.splittingDimensionUsages();
    var measures = modelTable.query.measureUsages();
    var resultLength = dimensions.reduce( function(rows, dim) { return rows * dim.domain.length;}, 1);   // todo: doesn't work for measures. have create domain of a previous measure when converting it to a dimension?

    // for each model in the modelTable
    this.at = new Array(this.rows);
    for (var rIdx=0; rIdx<this.rows; rIdx++) {
      this.at[rIdx] = new Array(this.cols);
      for (var cIdx=0; cIdx<this.cols; cIdx++) {
         this.at[rIdx][cIdx]  = _resultTablePerPane(modelTable.at[rIdx][cIdx], dimensions, measures, resultLength); // geht das so???
      }
    }
  };

  return ResultTable;
});