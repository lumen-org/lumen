/**
 * Utility functions.
 * @module utils
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define([], function() {
  'use strict';

  //var logger = Logger.get('pl-utils');

  /**
   * @returns the first value of the argument list that is non null and not undefined. If there is none, it returns undefined.  
   * @alias module:utils.selectFirstValidValue
   */
  function selectFirstValidValue () {
    for (let arg of arguments) 
      if ( typeof arg !== 'undefined' && arg !== null) 
        return arg;    
    return undefined;
  }

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

  /**
   * Returns true iff obj has an own property with value value.
   */
  var hasValue = function (obj, value) {
    for (let key in obj)
      if (obj.hasOwnProperty(key) && obj[key] === value)
        return true;
    return false;
  };

  class ExtendableError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  }

  /**
   * Converts a colorstring of form rgb(<r>,<g>,<b>) to its hex representation and returns it.
   * for example:  colorstring2hex("rgb(255,255,0)") returns "#ffff00"
   *
   * @param str
   * @param prefix: defaults to "#".
   * @return {string}
   */
  function colorstring2hex(str, prefix="#") {
    let innerStr = str.split("(")[1].split(")")[0];
    let rgb = innerStr.split(",");
    let hex = rgb.map( x => {
      x = parseInt(x).toString(16);
      return (x.length==1) ? "0"+x : x;
    });
    return prefix + hex.join("");
  }


  /**
   * Returns a universially unique identifier.
   * Credits to: https://gist.github.com/jed/982883
   * @param a
   * @returns {String}
   */
  function uuid(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,uuid)}


  /**
   * Returns the date of today as a string in format YYYY-MM-DD.
   * @returns {string}
   */
  function todayString() {
    let d = new Date();
    return ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + d.getFullYear();
  }

  function rescale(data, colIdx=0, normalization=1.0) {
    let total = 0;
    data.map(el => total=total+el[colIdx]);

    total = total / normalization;

    data.map(el => el[colIdx] = el[colIdx] / total);
    return data;
  }

  function assignWithFilter (target, source, filter) {

    if (_.isArray(filter)) {
      for (let prop of filter)
        if (prop in source)
          target[prop] = source[prop];
    }
    else if (filter instanceof RegExp) {
      for (let prop of Object.keys(source))
        if (filter.test(prop))
          target[prop] = source[prop];
    }
    return target;
  }

  /**
   * Triggers client-side download of data.
   *
   * @param filename The name of the file to download.
   * @param data The data download to the client.
   * @param type optional. The MIME type. Defaults to 'text/csv'.
   */
  function download(filename, data, type='text/csv') {
    // from: https://stackoverflow.com/questions/3665115/create-a-file-in-memory-for-user-to-download-not-through-server
    var blob = new Blob([data], {type: type});
    if(window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, filename);
    }
    else{
      var elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = filename;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }
  }

  /**
   * Returns a copy of facets object {obj} with only the relevant flags included as object properties.
   * @param obj
   * @param flags Flags to extract.
   */
  function getFacetsFlags(obj, flags=['active', 'possible']) {
    let facets = {};
    for (let key in obj)
      facets[key] = _.pick(obj[key], flags);
    return facets;
  }

  return {
    selectValue,
    selectFirstValidValue,
    listify,
    join,
    domain,
    hasProperty,
    hasValue,
    ExtendableError,
    colorstring2hex,
    uuid,
    todayString,
    assignWithFilter,
    download,
    getFacetsFlags,
    rescale
  };
});