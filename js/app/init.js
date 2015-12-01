/**
 * This module does initializations that have to be done before everything else.
 * @module init
 */
define([], function () {
  "use strict";

  // init the logger object.
  // reason for doing it here: it has to be run once before creating loggers, but overwrites specific logger settings, which are scattered in the project.
  Logger.useDefaults();
});