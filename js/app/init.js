/**
 * This module does initializations that have to be done before everything else.
 * @module init
 */
define(['lib/logger','d3'], function (Logger, d3) {
  "use strict";

  // init the logger object.
  // reason for doing it here: it has to be run once before creating loggers, but overwrites specific logger settings, which are scattered in the project.
  Logger.useDefaults();

  // extend d3
  var _nameMap = obj => obj.name;

  /**
   * todo: only works on single element selections for now.
   * @returns {Number}
   */
  d3.selection.prototype.attr2num = function (attributeString) {
    return parseFloat(this.attr(attributeString));
  };

  // extent array prototype

  Array.prototype.last = function() {
    return this[this.length-1];
  };

  Array.prototype.names = function () {
    return this.map(_nameMap);
  };

  Array.prototype.empty = function () {
    return this.length === 0;
  };

  /**
   * Clears this Array.
   */
  Array.prototype.clear = function () {
    //this.length = 0;
    this.splice(0,this.length);
  };


  // custom utility functions

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


});