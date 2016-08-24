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
    return Array.isArray(listOrScalar) ? listOrScalar : [listOrScalar];
  }


  return {
    selectValue: selectValue,
    listify: listify
  };
});