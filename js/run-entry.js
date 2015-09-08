/**
 * @author Philipp Lucas
 *
 * This file configures requirejs and serves as a single entry point for the javascript application.
 * This actual application if called after necessary libraries are loaded via a callback function. See below.
 */

// configure require.js
require.config({

  // all module IDs are resolved relative to that path
  // and that path itself is relative to the html file calling it
  baseUrl: 'js',

  // rules to resolve module IDs
  paths: {
    d3: 'lib/d3.min'
    //d3: 'http://d3js.org/d3.v3.min' // or: d3: 'd3.min
  }
});

// dynamic load of required libraries. When done, call callback
require(['app/app'], function  (app) {
    'use strict';

    // start the app!
    app.start();
});
