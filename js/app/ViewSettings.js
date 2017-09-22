/**
 * @copyright © 2015-2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define([], function () {
  "use strict";

  let config = {};

  _.extend(config, {
    maps: {
      size: 50,
      minSize: 32,
      maxSize: 2048,
      fill: "#377eb8",
      stroke: "#222222",
      opacity: 0.3,
      shape: "circle"
    },

    appearance: {
      pane: {
        borderColor: "#d4d4d4",
        fill: 'none'
      }
    },

    geometry: {
      // TODO: is that actually used?
      axis: {
        // [px] size (height for horizontal axis, width for vertical axis) reserved for an axis, including 'axis line', tick marks and labels
        size: 35,
        // [px] font size of tick marks of axis
        tickFontSizePx: 11,
        // [px] font size of axis label (i.e. name of axis)
        labelFontSizePx: 11,
        // [px] padding at the beginning and end of an axis
        padding: 5,
        // [px] outer tick size of axis tick marks
        outerTickSize: -5
      }
    }
  });

  config.colorscales = {
    // categorical (5,10,20)
    // continuous (mit Nulldurchgang, ohne Nulldurchgang)
  };

  config.map = {
    aggrMarker: {
      fill: 0,
      size: {
        min: 0,
        max: 0,
        def: 0,
        type: 'absolute' // 'relative' [% of available paper space], 'absolute' [px]
      }
    },
    sampleMarker: {}
  };

  config.plots = {
    main: {
      background: {
        fill: 'white',
      }
    },

    marginal: {
      visible: {
        x: true,
        y: true
      },
      background: {
        fill: 'white'
      }
    },

    layout: {
      ratio_marginal: {
        used: 0.15,
        unused: 0.5,
      },
      margin_main_sub: 0.005,
      margin: 20,
    }
  };

  config.axisGenerator = {
    main: (used) => {
      if (used)
        return {
          showline: true,
          linecolor: "grey",
          linewidth: 1,
          mirror: true, // 'all' mirrors to marginal axis as well
          zeroline: false,
          // zerolinewidth: 10,
          // zerolinecolor: "black",
        };
      else
        return {
          visible: true,
          mirror: true,
          showline: true,
          zeroline: false,
          showgrid: false,
          showticklabels: false,
          ticks: "",
          range: [-1, 1],
          fixedrange: true,
        };
    },

    marginal: (used, xOrY = 'x') => ({
      autorange: 'reversed',
      tickmode: 'auto',
      zeroline: !used,
      rangemode: 'tozero',
      domain: [0, (used ? config.plots.layout.ratio_marginal.used : config.plots.layout.ratio_marginal.unused) - config.plots.layout.margin_main_sub],
      nticks: 2,
      tickangle: xOrY === 'x' ? 90 : 0,
    }),
  };

  return Object.freeze(config);
});
