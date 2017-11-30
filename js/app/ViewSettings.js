/**
 * @copyright © 2015-2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
//define([], function () {
define(['d3-scale-chromatic','d3-format'], function (d3chromatic, d3f) {
  "use strict";

  let greys = d3chromatic.interpolateGreys;

  let c = {};

  // set of default config options for the visualization
  // beware when you add more
  c.views = {
    aggregations : {
      active: true,
    },
    data: {
      active: false,
    },
    marginals: {
      active: false, // true if the view is active (i.e.. computed and visible) by default, false if not
    },
    contour: {
      active: true,
    },
  };

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
    density: [[0, 'rgb(255,255,255)'], [0.000001, 'rgb(255,255,255)'], [0.000001, 'rgb(255,255,255)'], [1, 'rgb(0,0,0)']],
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
      levels: 8,
      resolution: 50 // the number computed points along one axis
    },
  };

  c.plots = {

    styled_text: (title, style) => {
      if (style === "")
        return title;
      return "<" + style + ">" + title +"</" + style + ">";
    },
    axis: {
      title_style: "em",
      title_font: {
        family: "Droid Sans",
        size: 16,
        color: "#b3b3b3",
      },
      label_style: "",
      label_font: {
        family: "Droid Sans",
        size: 11,
        color: "#232323",
      },
    },
    main: {
      background: {
        fill: 'white', //unused
      },
      grid: {
        color: greys(0.1),
      },
      axis: {
        color: "#3D3A40",
        zerolinewidth: 1.5,
        zerolinecolor: greys(0.3),
      },
      text: {
        color: greys(1.0),
        size: 12,
      }
    },

    marginal: {
      background: {
        fill: 'white', //unused
      },
      grid: {
        color: greys(0.6),
      },
      axis: {
        color: greys(0.9),
        zerolinewidth: 1,
      },
      text: {
        color: greys(0.5),
        size: 10,
      }

    },

    layout: {
      ratio_marginal: used => (used ? 0.85 : 0.1),

      //margin_main_sub: 0.02,
      margin: {
        l: 70, t: 60,
        r: 60, b: 50,
        pad: 3, // the amount of padding (in px) between the plotting area and the axis lines
      },
      // ratio of plotting area reserved for the templating axis (if any)
      templ_axis_level_ratio: {
        x: 0.08,
        y: 0.15
      },
      // width in [px] reserved for one axis
      templ_axis_level_width: {
        x: 60, // for a x-axis (i.e. it's the available height)
        y: 100, // for a y-axis (i.e. it's the available width)
      },
    },

    // label: {
    //   formatter: d3f.format(".3") // three significant digits, no trailing zeros
    // }
  };

  c.annotationGenerator = {

    axis_title: (title, xy, offset, length, position, position_shift=0, offset_shift=0) => {
      /**
       * xy ... x or y axis
       * offset ... x offset of if x-axis, y offset if y-axis
       * length ... length of axis in paper coordinates
       * xshift ... shifts label along x by number of pixels
       * yshift ... shifts label along y by number of pixels
       * @type {string}
       */
      const align = 'center'; // allowed: 'leftbottom', 'center', 'rightup'
      let anno = {
        text: c.plots.styled_text(title, c.plots.axis.title_style),
        font: c.plots.axis.title_font,
        showarrow: false,
        textangle: xy === 'y' ? -90 : 0,
        xref: 'paper',
        yref: 'paper',
      };
      if (align === 'rightup') {
        Object.assign(anno, {
          x: xy === 'x' ? offset + length : position,
          y: xy === 'y' ? offset + length : position,
          xanchor: xy === 'y' ? 'right' : 'left',
          yanchor: xy === 'y' ? 'bottom' : 'top',
          xshift: xy === 'x' ? offset_shift : position_shift,
          yshift: xy === 'y' ? offset_shift : position_shift,
        });
      } else if (align === 'center') {
        Object.assign(anno, {
          x: xy === 'x' ? offset + length*0.5 : position,
          y: xy === 'y' ? offset + length*0.5 : position,
          xanchor: xy === 'y' ? 'right' : 'center',
          yanchor: xy === 'y' ? 'center' : 'top',
          xshift: xy === 'x' ? offset_shift : position_shift-25, // -15 is to shift off labels
          yshift: xy === 'y' ? offset_shift : position_shift-22,
        });
      } else {
        throw RangeError("not allowed");
      }
      return anno;
    },

    templ_level_title: (title, xy, refId) => {
      let yx = xy === 'x' ? 'y' : 'x';
      let anno = {
        text: c.plots.styled_text(title, c.plots.axis.title_style),
        textangle: xy === 'y' ? -90 : 0,
        font: c.plots.axis.title_font,
        showarrow: false,
      };
      anno[xy+'anchor'] = 'center';
      // anno[yx+'anchor'] = 'center';
      anno[xy+'ref'] = 'paper';
      anno[xy] = 1; // 1 = right most
      anno[yx+'ref'] = yx + refId; // if referencing an axis (say an 'x' axis) the position along that axis is specified in axis coordinates.
      anno[yx] = 0; // up most (by convention minor templ axis have suitable range)
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
          zeroline: false,  // TODO: enable back on?
          zerolinecolor: c.plots.main.axis.zerolinecolor,
          zerolinewidth: c.plots.main.axis.zerolinewidth,
          gridcolor: c.plots.main.grid.color,
          tickfont: {
            color: c.plots.main.text.color,
            size: c.plots.main.text.size,
          },
          // titlefont: { unused, since we use custom axis label
          //   color: c.plots.main.text.color,
          //   size: c.plots.main.text.size*1.25,
          // },
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
      zerolinecolor: c.plots.main.axis.color, // 'main' because visually this represent the main axis
      zerolinewidth: c.plots.main.axis.width,
      autorange: 'false',
      //fixedrange: true,
      tickmode: 'auto', // TODO:
      nticks: 3,
      side: xy === 'y' ? 'right' : 'top',
      tickfont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      // titlefont: {
      //   color: c.plots.marginal.text.color,
      //   size: c.plots.marginal.text.size,
      // },
      domain: [offset, offset + length],
      //position: position,
    }),

    templating_major: (offset, length, ticks, anchor) => ({
      // TODO: what is this anchor? and why does the positioning not work correctly if stacked on rows.
      anchor: anchor,
      domain: [offset + 0.03*length, offset + 0.97*length],
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
