/**
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 * This file configures requirejs and serves as a single entry point for the javascript application.
 * The actual application is called after necessary libraries are loaded via a callback function. See below.
 */

// configure require.js
require.config({

  // all module IDs are resolved relative to that path
  // and that path itself is relative to the html file calling it
  baseUrl: 'js',

  // rules to resolve module IDs
  paths: {
    d3: 'lib/d3.min'
  }
});

// dynamic load of required libraries. When done, call callback
require(['playground/app'], function  (app) {
    'use strict';

    // start the app!
    app.start();
});
