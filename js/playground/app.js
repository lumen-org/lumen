/**
 * This is just some dummy/tryout module definition.
 *
 * d3 is included as a required dependency to this module, and will be available under the name d3 in this function.
 *
 * @module app
 * @author Philipp Lucas
 */

define(['d3', './common'], function(d3, common) {
//define([], function() {
  'use strict';

  // setup code / closure stuff here
  // ...

  // definitions of modules functions here
  return {
    /**
     * Start the application.
     */
    start: function() {
      //d3.select('body').append('p').text('I can call two() : ' + common.two());
      console.log("started!");
    },

    sumOf: function (a,b) {
      return a+b;
    }
  };
});
