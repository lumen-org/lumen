define([], function () {
  "use strict";

  return Object.freeze({
    maps: {
      size: 64,
      minSize: 32,
      maxSize: 2048,
      color: "red",
      shape: "circle"
    },

    appearance: {
      pane: {
        borderColor: "#d4d4d4",
        fill: 'none'
      }
    },

    geometry: {
      axis: {
        // [px] size (height for horizontal axis, width for vertical axis) reserved for an axis, including 'axis line', tick marks and labels
        size: "25",
        // [px] padding at the beginning and end of an axis that 
        padding: 15,
        outerTickSize: 1.5
      }
    }

  });
});