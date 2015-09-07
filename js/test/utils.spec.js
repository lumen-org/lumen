/**
 * Test module for utils.js
 *
 * @author Philipp Lucas
 * @module
 */

define(['app/utils'], function (utils) {
  "use strict";

  describe('basic tests', function () {
    it('tests selectValue()', function () {
      expect (utils.selectValue(null, 1)).toBe(1);
      expect (utils.selectValue(undefined, 1)).toBe(1);
      expect (utils.selectValue(undefined, false, 2, 1)).toBe(1);
      expect (utils.selectValue(undefined, true, 2, 1)).toBe(2);
      expect (utils.selectValue(undefined, false, undefined, false, null, 1)).toBe(1);
      expect (utils.selectValue(undefined, false, undefined, false, null, null)).toBe(null);
    });
  });
});