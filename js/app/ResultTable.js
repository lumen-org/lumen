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
   * Utility function that returns the domain of some given discrete or continuous data.
   * @param data
   * @param discreteFlag
   * @returns {*}
   * @private
   */
  var _domain = function (data, discreteFlag) {
    return (discreteFlag? _.unique(data) : d3.extent(_.flatten(data)) );
  };


  /**
   * Checks that dimensions based on the same field use the same split function. If not it issues a warning.
   * @param dimensions
   *
  var checkDimensions = function (dimensions) {
    // sort by their name
    dimensions.sort( function(d1, d2) {
      return (d1.name < d2.name ? -1 : (d1.name > d2.name ? 1 : 0) );
    });

    // sequentially check
    // todo implement later
  };*/


  /**
   * Aggregate the given model.
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

    // 1. generate indices and empty result table
    // attach index in aggregation table and build of the set of dimensions and measures of the aggregation table
    // note: in the general case query.fieldUsage and [...dimensions, ...measures] do not contain the same set of field usages, as duplicate dimensions won't show up in dimensions
    var fieldUsages = query.fieldUsages();
    var dimensions = [];
    let idx = 0;
    fieldUsages.filter(F.isDimension).forEach( function (fu) {
      let sameBase = dimensions.find( e => (fu.base === e.base) );
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

    // push index to ancestors
    [...measures, ...dimensions].forEach( function(fu) {
      if (fu.origin) fu.origin.index = fu.index;
    } );

    // 2. setup input tuple, i.e. calculate the cross product of all dim.splitToValues()
    // pair-wise joins of dimension domains, i.e. create all combinations of dimension domain values
    let inputTable = dimensions.reduce(
      function (table, dim) {
        return _join(table, [dim.splitToValues()]);
      }, []);

    // attach extent and corresponding field usage
    // todo/note/check: there may be more than one field usages corresponding to this column. However, I believe we don't need more. otherwise we have to attach the full vector of corresponding FU in the code above (1.)
    inputTable.forEach(
      function (column, idx) {
        let dim = column.fu = dimensions[idx]; // todo: is that ever needed?
        column.extent = _domain(column, dim.isDiscrete());
      }
    );

    // 3. generate output tuple
    let outputTable = [];
    let len = (inputTable.length === 0 ? 0 : inputTable[0].length);
    let measPromises = new Set().add(Promise.resolve()); // makes sure that the set of promises resolves, even if no further promises are added
    measures.forEach( function (m) {
      let column = new Array(len);
      let tuplePromises = new Set;

      // sample accordingly
      let dimNames  = inputTable.map( v => v.fu.name);
      for (let tupleIdx = 0; tupleIdx < len; ++tupleIdx) {

        // condition on dimension values / collect dimension values
        let dimValues = inputTable.map( v => v[tupleIdx] ); // jshint ignore:line

        // aggregate remaining model
        // need to pass: dimension values of this row of the result table. this will set all remaining variables of the model except for the one measure. Then calculate the aggregation on that measure
        
        //column[tupleIdx] = m.model.aggregate(dimValues, m.aggr);
        //column[tupleIdx] = m.model.aggregate(dimValues, m); // synchonous version

        tuplePromises.add(
          m.model.aggregateNew(dimNames, dimValues, m)
            .then(result => {column[tupleIdx] = result;})
        );
      }

      let tuplesFetchedPromise =
        Promise.all(tuplePromises)
          .then(()=>{
            // attach extent and corresponding field usage
            column.fu = m;
            column.extent = _domain(column, m.isDiscrete());
            outputTable.push(column);
          });
      measPromises.add(tuplesFetchedPromise);
    });

    // todo 4. apply aggregation filters
    // todo: domains must be calculcated _after_ applying filters.... fix it when you implement aggregation filters!

    // 6. return (promise for an) aggregation table
    return Promise.all(measPromises)
      .then(
      function () {
        console.log("@resulttable final promise solution");
        return [...inputTable, ...outputTable];
        }
      //  ()=>[...inputTable, ...outputTable]
      );
  };


   /**
   * A ResultTable contains the raw data that are the (sampled) answers to the actual queries to the model(s). Each cell of the result table holds its own data, and is accessed by its row and column index via the at property.
   *
   * The at propery contains no information about what FieldUsages are encoded in what index. Therefore, a {@link ResultTable} has the indexes property, which maps a purpose (e.g. color, shape, horizontal position) to an index.
   *
   * @alias module:ResultTable
   * @constructor
   */
  class ResultTable {

     constructor(modelTable, queryTable) {
       this._qt = queryTable;
       this._mt = modelTable;
       this.size = modelTable.size;
       this.at = new Array(this.size.rows);
     }

     fetch () {
       let fetchPromises = new Set().add(Promise.resolve());
       for (let rIdx=0; rIdx<this.size.rows; ++rIdx) {
         this.at[rIdx] = new Array(this.size.cols);
         for (let cIdx=0; cIdx<this.size.cols; ++cIdx) {
           let promise = aggregate(this._mt.at[rIdx][cIdx], this._qt.at[rIdx][cIdx])
             .then( result => {this.at[rIdx][cIdx] = result});
           console.log("added fetch promise");
           fetchPromises.add(promise);
         }
       }
       return Promise.all(fetchPromises);
     }
  }

  return ResultTable;
});