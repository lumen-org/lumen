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

  // c.shelves = {
  //   density.color
  // };

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
        opacity: 0.7,
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
        zerolinewidth: 1,
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
       // width: 5, //TODO
      },
      axis: {
        color: greys(0.4),
        zerolinewidth: 1,
      },
      text: {
        color: greys(0.5),
        size: 10,
      }

    },

    layout: {
      ratio_marginal: used => (used ? 0.85 : 0.4),
      //margin_main_sub: 0.02,
      margin: {
        l: 70, t: 60,
        r: 40, b: 40,
        pad: 3, // the amount of padding (in px) between the plotting area and the axis lines
      },
      // ratio of plotting area reserved for the templating axis (if any)
      templ_axis_level_size: {
        x: 0.08,
        y: 0.15
      },
    }
  };

  c.annotationGenerator = {
    templ_level_title: (title, xy, refId) => {
      let yx = xy === 'x' ? 'y' : 'x';
      let anno = {
        text: title,
        showarrow: false,
        textangle: xy === 'y' ? -90 : 0,
      };
      anno[xy+'ref'] = 'paper';
      anno[xy] = 1; // right most / up most
      anno[yx+'ref'] = yx + refId;
      anno[yx] = 0;
      anno[yx+'shift'] = -10; // shift below/left of axis line (axis line not over axis title)
      anno[xy+'shift'] =  c.plots.layout.margin[xy === 'x' ? 'r' : 't'] - 20; // shift right/up off axis line (tick labels not over axis title)
      return anno;
    },
  };

  c.axisGenerator = {
    main: (offset, length, position, used) => {
      if (used)
        return {
          showline: true,
          linecolor: c.plots.main.axis.color,
          linewidth: 1,
          mirror: false, // 'all' mirrors to marginal axis as well. Note that this cannot work if I use position and not anchor.
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
          position: position,
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
          position: position,
        };
    },

    marginal: (offset, length, position, xy) => ({
      //zeroline: !used,
      zeroline: true,
      zerolinecolor: c.plots.main.axis.color,
      zerolinewidth: c.plots.main.axis.zerolinewidth,
      autorange: 'false',
      fixedrange: true,
      tickmode: 'auto', // TODO: use tickmode="array" and tickvals and ticktext to set exactly 2 ticks as I want
      nticks: 3,
      side: xy === 'y' ? 'right' : 'top',
      tickfont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      titlefont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      domain: [offset, offset + length],
      //position: position,
    }),

    templating_major: (offset, length, ticks, anchor) => ({
      // TODO: what is this anchor? and why does the positioning not work correctly if stacked on rows.
      anchor: anchor,
      domain: [offset + 0.02*length, offset + 0.98*length],
      visible: true,
      showline: true,
      showgrid: false,
      ticklen: 5,
      type: 'category',
      range: [-0.5, ticks.length - 0.5], // must be numbers starting from 0
      tickvals: _.range(ticks.length),
      ticktext: ticks,
      fixedrange: true,
    }),

    templating_minor: (offset, length, anchor) => ({
      domain: [offset, offset + length],
      anchor: anchor,
      range: [0,1],
      visible: false,
      fixedrange: true,
    }),
  };

  return Object.freeze(c);
});
