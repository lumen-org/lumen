/**
 * Utility functions.
 * @module utils
 * @author Philipp Lucas
 */
define([], function() {
  'use strict';

  //var logger = Logger.get('pl-utils');

  /**
   * @returns valPref if valPref is defined and not null, else:
   *    val_i if cond_i holds and val_i is defined and not null, else:
   *    etc..., else:
   *    valDefault
   *  @alias module:utils.selectValue
   */
  var selectValue = function (valPref, /*cond_i, val_1, ...*/ valDefault) {
    var nr = arguments.length;
    console.assert(nr % 2 === 0);

    if (typeof valPref !== 'undefined' && valPref !== null) {
      return valPref;
    }

    for (var i = 1; i < nr-1; i+=2) {
      var cond = arguments[i];
      var val = arguments[i+1];
      if ( cond && typeof val !== 'undefined' && val !== null) {
        return val;
      }
    }

    return arguments[nr-1];
  };

  function listify (listOrScalar) {
    if (arguments.length === 1)
      return Array.isArray(listOrScalar) ? listOrScalar : [listOrScalar];
    else
      return Array.from(arguments)
        .map( arg => Array.isArray(arg) ? arg : [arg] );
  }


  /**
   * Joins the two tables a and b
   * naive implementation
   */
  function join(a, b) {
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
  var domain = function (data, discreteFlag) {
    return (discreteFlag ? _.unique(data) : d3.extent(_.flatten(data)) );
  };

  var hasProperty = function (obj, prop) {
    var proto = obj.__proto__ || obj.constructor.prototype;
    return (prop in obj) &&
      (!(prop in proto) || proto[prop] !== obj[prop]);
  };

  return {
    selectValue: selectValue,
    listify: listify,
    join: join,
    domain: domain,
    hasProperty: hasProperty
  };
});