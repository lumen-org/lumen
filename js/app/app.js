/**
 * @author Philipp Lucas
 * @module
 * This is the Module definition of app.js.
 * d3 is included as a required dependency to this module, and will be available under the name d3 in this function.
 */

define(['d3', 'app/common'], function(d3, common) {
  'use strict';

  // setup code / closure stuff here
  // ...

  // definitions of modules functions here
  return {

    /**
     * Start the application.
     */
    start: function() {
      var w = 300,
        h = 300;

      var svg = d3.select('#d3circle')
        .append('svg')
        .attr({
          height: h,
          width: w,
          id: 'svgmain'
        });

      var circle = svg.append('circle')
        .attr({
          cx: w / 2,
          cy: h / 2,
          r: d3.min([w, h]) * 0.45,
          fill: 'orange'
        });

      var body = d3.select('body').append('p')
        .text('I can call two() : ' + common.two());
    },

    /**
     * @returns a + b
     */
    sumOf : function(a, b) {
      return a + b;
    },

    three : function() {
      return this.sumOf(common.one(), common.two());
    }

  };

  /*
   * Adds a paragraph with some random content as a child to the passed DOM selection using D3
   * @param parent
   *
  function addRandomParagraph(parent) {
    'use strict';

    parent.append('p')
      .text('This is some random content');
  }
// */

});
