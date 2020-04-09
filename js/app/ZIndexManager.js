define([], function () {
  'use strict';
  /**
   * monotone z-index generator. used to push activated contexts visually to the front.
   * Usage: zIndex = zIndexGenerator++;
   */
  var zIndex = 1;

  function reset () {
    zIndex = 1;
  }

  function current () {
    return zIndex;
  }

  /**
   * Increment the z-order index and return it.
   */
  function inc () {
    zIndex += 1;
    return current();
  }

  return {
    reset,
    current,
    inc
  }
});