/**
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 * This configures requirejs and serves as a single entry point for the prototype application.
 * The actual application if called after necessary libraries are loaded via a callback function. See below.
 */

// configure require.js
require.config({

  // all module IDs are resolved relative to that path
  // and that path itself is relative to the html file calling it
  baseUrl: '../js',

  // rules to resolve module IDs (i.e. explicit additional rules)
  paths: {
    'd3': 'lib/d3.min',
    'd3legend': 'lib/d3-legend-min-amd',
  }
});

// dynamic load of required libraries. When done, call callback
require(['app/prototype'], function  (proto) {
  'use strict';

  // start the app!
  proto.start();
});
