/**
 * @author Philipp Lucas
 *
 * JavaScript code for this the source component of the UI of the EMV tool.
 *
 * Created on 24/03/15.
 */

define(['d3'], function(d3) {
  'use strict';

  // setup code here
  // ...

  // definitions of modules functions here
  return {

    /**
     * Start the application.
     */
    start: function () {
        d3.select("body").append("p").text("hi there");
    }
  };

});
