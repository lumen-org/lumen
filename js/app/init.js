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

  /**
   * Gets
   * todo: only works on single element selections for now.
   * @returns {Number}
   */
  d3.selection.prototype.attr2num = function (attributeString) {
    return parseFloat(this.attr(attributeString));
  };

});