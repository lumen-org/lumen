/**
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
   *
  function _repeat(value, times) {
    var array = new Array(times);
    for(var i=0;i<times;++i)
      array[i] = value;
    return array;
  }*/

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


  /**
   * Sample the given model.
   * Note: the parameters dimensions and measures are {@link FieldUsage}s, not {@link Field}s. They contain the required information on how exactly the model is to be sampled.
   * @param model The model to sample.
   * @param {FieldUsage} The dimensions of the model to sample.
   * @param {FieldUsage} The measures of the model to sample.
   * @param rows The precomputed length of the result table.
   * @param nsfe the nsf (normalized set form) element that belongs to this model. This is needed to get the pane specific measure (on rows or columns).
   * @returns {*}
   * @private
   */
  function _resultTablePerPane(model, dimensions, measures, rows) {
    // todo: performance: let _join work on a preallocated (possibly larger than for a particular _join call needed) array
    // pair-wise joins of dimension domains, i.e. create all combinations of dimension domain values
    var resultTable = dimensions.reduce(
      function (table, dim) {
        return _join(table, [dim.domain]);
      }, []);

    // add columns for values of measures
    measures.forEach( function (m) {
      var column = new Array(rows);
      for (var i = 0; i < rows; ++i) {
        // todo: how to do that!?
        // todo: actually I need for each aggregation (be it on multiple fields or not) a separate model!
        // and there may very well be multiple measure per pane! e.g. avg(age) on color and avg(income) on rows
        column[i] = model.aggregate(
//          todo continue here: need to get the actual data for the aggregation calculation
          new Array(model.size())
        );
      }
      resultTable.push(column);
    });

    return resultTable;
  }

  /**
   * A ResultTable contains the raw data that are the (sampled) answers to the actual queries to the model(s). Each cell of the result table holds its own data, and is access by its row and column index via the at property.
   * Note that the header of each cell may not be identical, e.g. when using something like "avg(age)+avg(income)" for the row mapping.
    Therefore a {@link ResultTable} also attaches index values to the aesthetics and layers of a query. The index's value is the index in the data table of a cell.
   * @alias module:ResultTable
   * @constructor
   */
  var ResultTable; ResultTable = function (modelTable) {
    this.modelTable = modelTable;
    this.query = modelTable.query;
    this.rows = modelTable.rows;
    this.cols = modelTable.cols;
    if (this.rows === 0 || this.cols === 0)
      return; //todo: do I need that?

    // common among all panes
    var dimensions = this.query.splittingDimensionUsages();
    // todo: this is wrong. We may not include measure of the layout part, as they may be not be the same for all panes
    var measures = this.query.measureUsages();

    // todo: the follwing doesn't work for measures. Do I have to create a domain of a "previous" measure when converting it to a dimension?
    // todo: it's maybe not nice that I already at this point of the pipeline have to decide how neatly I want to sample a measure that has become a dimension
    var resultLength = dimensions.reduce( function(rows, dim) { return rows * dim.domain.length;}, 1);

    // add header, i.e. array of FieldUsages that belong to the result table.
    // note: header is same for all "per pane result tables"!
    // todo: that's wrong! e.g imagine height+weight ON COLS .... then not all per-pane result tables contain both, height and weight!
    this.header = dimensions.concat(measures);

    // attach indices to aestethics and layer mappings of the query.


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