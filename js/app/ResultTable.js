/**
 * @module ResultTable
 * @author Philipp Lucas
 */

define(['lib/logger', './Field'], function (Logger, F) {
  "use strict";

  var logger = Logger.get('pl-ResultTable');
  logger.setLevel(Logger.DEBUG);

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
  function _resultTablePerPane(model, dimensions, measures, rows, nsfe) {
    // todo: performance: let _join work on a preallocated (possibly larger than for a particular _join call needed) array
    // todo: implement aggregations on multiple variables of a model.
    // todo: how to pass values to the model efficiently? idea: just expect the values in the order of variables of the model

    // pair-wise joins of dimension domains, i.e. create all combinations of dimension domain values
    var inputTable = dimensions.reduce(
      function (table, dim) {
        return _join(table, [dim.domain]);
      }, []);
    var outputTable = [];

    // add columns for values of measures
    measures.forEach( function (m) {
      let column = new Array(rows);

      // generate specialized model for the current measure.
      let measureModel = model.copy().marginalize(_.without(measures, m));

      // sample accordingly
      for (let rowIdx = 0; rowIdx < rows; ++rowIdx) {

        // condition on dimension values / collect dimension values
        let dimValues = inputTable.map(
          function (v) { return v[rowIdx]; }
        ); // jshint ignore:line

        // aggregate remaining model
        // need to pass: dimension values of this row of the result table. this will set all remaining variables of the model except for the one measure. Then calculate the aggregation on that measure
        column[rowIdx] = measureModel.aggregate(dimValues, m.aggr);
      }
      outputTable.push(column);
    });

    return [...outputTable, ...inputTable];
  }

  /**
   * A ResultTable contains the raw data that are the (sampled) answers to the actual queries to the model(s). Each cell of the result table holds its own data, and is accessed by its row and column index via the at property.
   *
   * The at propery contains no information about what FieldUsages are encoded in what index. Therefore, a {@link ResultTable} has the indexes property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:ResultTable
   * @constructor
   */
  var ResultTable;

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


  var aggregate = function (model, query) {
    // 1. generate mapping and empty result table
    // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
    // - multiple measures of the same field are possible and
    // - multi-dimensional measures aren't supported yet


    //var iter = query.FieldUsageIterator()
    //var idx2fu = [];

    //for (let current = iter.next(); !current.done; iter.next()) {

    // attach index in aggregation table and build of the set of dimensions and measures of the aggregation table
    // note: in the general case query.fieldUsage and [...dimensions, ...measures] doesn't contain the same set of field usages, as duplicate dimensions won't show up in dimensions
    var dimensions = [];
    var measures = [];
    var fieldUsages = query.fieldUsages();
    var idx = 0;
    fieldUsages.forEach( function (fu) {
      // attach to maps
      fu.index = idx;
      //idx2fu[idx] = fu;

      if (fu.isDimension()) {
        let sameBase = dimensions.find( function (e) {
          return (fu.base === e.base);
        });
        if (sameBase && fu.splitter !== sameBase.splitter)
            throw new RangeError("If using multiple dimensions of the same field in an atomic query, their splitter functions must match!");
          // note: in any case we don't need to add it again
        else
          dimensions.push(fu);
      } else
      if (fu.isMeasure())
        measures.push(fu);
      else
        throw new TypeError();
    });

    // 9,30-10,00 - baum fällen??

    fieldUsages = [...dimensions, ...measures];

    // 2. setup input tuples, i.e. calculate the cross product of all dim.sample()
    // pair-wise joins of dimension domains, i.e. create all combinations of dimension domain values
    var inputTable = dimensions.reduce(
      function (table, dim) {
        return _join(table, [dim.domain]);
      }, []);

    // 3. generate output tuples from

    // 4. apply aggregation filters

    // 5. return aggregation table

  };

  ResultTable = function (models, queries) {
    this.size = models.size;
    this.at = new Array(this.size.rows);
    for (let rIdx=0; rIdx<this.size.rows; ++rIdx) {
      this.at[rIdx] = new Array(this.size.cols);
      for (let cIdx=0; cIdx<this.size.cols; ++cIdx) {
        this.at[rIdx][cIdx] = aggregate(models.at[rIdx][cIdx], queries.at[rIdx][cIdx]);
      }
    }
  };

  //ResultTable = function (models, queries) {
  //  this.modelTable = modelTable;
  //  this.query = modelTable.query;
  //  this.rows = modelTable.rows;
  //  this.cols = modelTable.cols;
  //  if (this.rows === 0 || this.cols === 0)
  //    return; //todo: do I need that?
  //
  //  this.indexes = {};
  //
  //  // common among all panes
  //  var dimensions = this.query.splittingDimensionUsages();
  //  var commonMeasures = this.query.commonMeasureUsages();
  //
  //  // todo: the following doesn't work for measures yet. Do I have to create a domain of a "previous" measure when converting it to a dimension? with this approach yes, however it's maybe not nice that I already at this point of the pipeline have to decide how neatly I want to sample a measure that has become a dimension
  //  var resultLength = dimensions.reduce(function (rows, dim) {
  //    return rows * dim.domain.length;
  //  }, 1);
  //
  //  // attach indices to aestethics and layer mappings of the query.
  //  // this is needed to know how field usages of the VisMEL query map to vectors in the result table
  //  // todo: this seems ugly
  //
  //  var rowNSF = this.modelTable.rowNSF;
  //  var colNSF = this.modelTable.colNSF;
  //  {
  //     //important note:
  //     //  this assumes a certain order of fieldUsages in the result table columns:
  //     //    1. layoutMeasures
  //     //    2. commonMeasures
  //     //    3. dimensionUsages
  //     //  this order has to be used when constructing the actual result table later!
  //
  //    let idx = 0;
  //    let fu = [...dimensions, ...commonMeasures];
  //    let aesthetics = this.query.layers[0].aesthetics;
  //
  //    // todo: implement properly for multiple FU on rows and columns
  //    if (F.isMeasure(colNSF[0].last().fieldUsage))
  //      this.indexes.x = idx++;
  //    if (F.isMeasure(rowNSF[0].last().fieldUsage))
  //      this.indexes.y = idx++;
  //
  //    // todo: buggy: in case of a multiple usage of a dimension this code breaks, as the FU below will not be found, as they are filtered in splittingDimensionUsages() above...
  //    if (aesthetics.color instanceof F.FieldUsage)
  //      this.indexes.color = fu.indexOf(aesthetics.color) + idx;
  //    if (aesthetics.shape instanceof F.FieldUsage)
  //      this.indexes.shape = fu.indexOf(aesthetics.shape) + idx;
  //    if (aesthetics.size instanceof F.FieldUsage)
  //      this.indexes.size = fu.indexOf(aesthetics.size) + idx;
  //      // todo: implement this for details - though its not necessarily needed for visualization
  //      // todo: what about filter??
  //  }
  //
  //  // do sampling for each model in the modelTable
  //  this.at = new Array(this.rows);
  //  for (let rIdx = 0; rIdx < this.rows; rIdx++) {
  //    this.at[rIdx] = new Array(this.cols);
  //    for (let cIdx = 0; cIdx < this.cols; cIdx++) {
  //      // there may be pane specific measures, i.e. measures in the table algebra expression
  //      // note: if there is one, it always is the last in a NSF element
  //      let layoutMeasures = [rowNSF[rIdx].last().fieldUsage, colNSF[cIdx].last().fieldUsage]
  //        .filter(F.isMeasure);
  //
  //      this.at[rIdx][cIdx] = _resultTablePerPane(
  //        modelTable.at[rIdx][cIdx],
  //        dimensions,
  //        [...layoutMeasures, ...commonMeasures],
  //        resultLength);
  //    }
  //  }
  //};

  return ResultTable;
});