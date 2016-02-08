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
        fill: '#fbfbfb'
      }
    }
  });
});