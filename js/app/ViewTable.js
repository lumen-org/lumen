/**
 * Takes a ResultTable and turns it into a D3-based visual representation that can be attached to the DOM.
 *
 * @module ViewTable
 * @author Philipp Lucas
 */

define(['d3', './ResultTable'], function (d3, ResultTable) {
  "use strict";

  /**
   * Constructs a ViewTable on a given svg-element
   * @param svg A D3 selection of a single svg element.
   * @param [resultTable] The {@link ResultTable} to visualize with this viewTable.
   * @constructor
   * @alias module:ViewTable
   */
  var ViewTable; ViewTable = function (svg, resultTable) {
    // create table of d3 canvases

    // start easy: just one canvas

    //
    if (resultTable)
      this.update(resultTable);
  };

  /**
   * Update this {@link ViewTable} with the given {@link ResultTable}.
   */
  ViewTable.prototype.update = function (resultTable) {

  };

  return ViewTable;
});