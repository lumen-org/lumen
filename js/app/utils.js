define([], function() {
  'use strict';

  /**
   * Returns:
   *   valPref if valPref is defined and not null, else:
   *    val_i if cond_i holds and val_i is defined and not null, else:
   *    etc..., else:
   *    valDefault
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


  // public part of the module
  return {
    selectValue: selectValue
  };
});