/**
 * Test module for app.js
 *
 * @author Philipp Lucas
 * @module
 */

define(['app/app'], function(App) {
  "use strict";

  describe('A simple Spec', function() {

    it('tests correct summation of 2 numbers', function() {

      expect(App.sumOf(0,0)).toBe(0);
      expect(App.sumOf(1,4)).toBe(5);
      expect(App.sumOf(-2,6)).toBe(4);
      //expect(App.three().toBe(3));

    });

    it("should be true", function() {
      expect(true).toBe(true);
    });

    it("should not defined!", function () {
      var minimum = d3.min([0,1,2]);
      expect(minimum).toBe(0);
    });

  });

});

