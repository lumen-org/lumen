/**
 * @copyright © 2015-2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
//define([], function () {
define(['d3-scale-chromatic'], function (d3chromatic) {
  "use strict";

  let greys = d3chromatic.interpolateGreys;

  let c = {};

  _.extend(c, {
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

  c.colorscales = {
    density: [[0, 'rgb(255,255,255)'], [0.0001, 'rgb(255,255,255)'], [0.0001, 'rgb(255,255,255)'], [1, 'rgb(0,0,0)']],
    //density: [[0, 'rgb(255,255,255)'], [0.01, 'rgb(255,255,255)'], [0.01, 'rgb(255,255,255)'], [1, 'rgb(0,0,0)']],
    diverging: d3chromatic.schemeRdBu[11],  // d3chromatic.schemeRdYlBu[9] ?  // mit Nulldurchgang
    sequential: d3chromatic.schemeYlOrBr[9] , // ohne Nulldurchgang / bis 0
    discrete9: d3chromatic.schemeSet1,
    discrete12: d3chromatic.schemePaired,
  };

  // shapes in plotly can be specified by a string number or a string 'name' identifier. see also https://plot.ly/javascript/reference/#scatterternary-marker-symbol
  c.shapes = {
    open: _.range(100,144),
    filled: _.range(44),
  };

  c.map = {
    aggrMarker: {
      fill: {
        def: "#377eb8",
        opacity: 0.9,
      },
      stroke: {
        color: greys(0.8),
        width: 1.5,
      },
      size: {
        min: 6,
        max: 40,
        def: 8,
        //type: 'absolute' // 'relative' [% of available paper space], 'absolute' [px]
      },
      shape: {

      },
    },

    heatmap: {
      opacity: {
        discrete: 0.6,
        continuous: 0.9,
      }
    },

    sampleMarker: {
      size: {
        min: 6,
        max: 40,
        def: 8,
      },
      stroke: {
        color: greys(0.3),
        width: 1.5,
      },
      fill: {
        opacity: 0.6,
      },
      maxDisplayed: 500,  // the maximum number of samples plotted in one trace of one atomic plot
    },
    uniDensity: {
      color: {
        def: greys(0.5),
      },
      bar: {
        opacity: 0.3,
      }
    },
    biDensity: {
      colorscale: c.colorscales.density,
      opacity: 0.4,
    },
  };

  c.plots = {
    main: {
      background: {
        fill: 'white', //TODO
      },
      grid: {
        color: "red", //TODO
      },
      axis: {
        color: "#3D3A40",
      },
      text: {
        color: greys(1.0),
        size: 12,
      }
    },

    marginal: {
      visible: {
        x: true,
        y: true
      },
      background: {
        fill: 'white'
      },
      grid: {
        color: greys(0.6),
        width: 5, //TODO
      },
      axis: {
        color: greys(0.4),
        zerolinewidth: 1,
      },
      text: {
        color: greys(0.6),
        size: 10,
      }

    },

    layout: {
      // ratio_marginal: {
      //   used: 0.15,
      //   unused: 0.5,
      // },
      ratio_marginal: used => used ? 0.15 : 0.4,
      //margin_main_sub: 0.005,
      margin_main_sub: 0.02,
      margin: 20,
    }
  };


  c.axisGenerator = {
    main: (offset, length, used) => {
      if (used)
        return {
          showline: true,
          linecolor: c.plots.main.axis.color,
          linewidth: 1,
          mirror: false, // 'all' mirrors to marginal axis as well
          zeroline: true,
          // zerolinewidth: 10,
          // zerolinecolor: "black",
          tickfont: {
            color: c.plots.main.text.color,
            size: c.plots.main.text.size,
          },
          titlefont: {
            color: c.plots.main.text.color,
            size: c.plots.main.text.size*1.25,
          },
          domain: [offset, offset + length],
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
          domain: [offset, offset + length],
        };
    },

    marginal: (offset, length, xOrY) => ({
      autorange: 'reversed',
      tickmode: 'auto',
      //zeroline: !used,
      zeroline: true,
      zerolinecolor: c.plots.marginal.axis.color,
      zerolinewidth: c.plots.marginal.axis.zerolinewidth,
      rangemode: 'tozero',
      // domain: [0, (used ? c.plots.layout.ratio_marginal.used : c.plots.layout.ratio_marginal.unused) - c.plots.layout.margin_main_sub],
      nticks: 2,
      tickangle: xOrY === 'x' ? 90 : 0,
      tickfont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      titlefont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      domain: [offset, offset + length],
    }),
  };

  return Object.freeze(c);
});
