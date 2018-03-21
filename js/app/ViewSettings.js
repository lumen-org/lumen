/**
 * @copyright © 2015-2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
//define([], function () {
define(['d3-scale-chromatic','d3-format', 'd3-color', './SplitSample', './Domain'], function (d3chromatic, d3f, d3color, ss, Domain) {
  "use strict";
  let greys = d3chromatic.interpolateGreys;
  let c = {};

  // TODO HACK: paper only
  let hideAggregations = false;

  function makeDensityScale(colorArray) {
    const threshhold = 0.000001;
    let colorScale = [[0, 'rgba(255,255,255,0)'], [threshhold, 'rgba(255,255,255,0)']];  // to make sure very small values are drawn in white
    // todo: this is ugly!
    let split = ss.Splitter.equidist(new Domain.Numeric([0,1]), true, colorArray.length-1); // -1 is a BUG!!
    split.push(1);
    split[0] = threshhold;
    for (let i=0; i < colorArray.length; ++i) {
      colorScale.push([ split[i], colorArray[i]]);
    }
    return colorScale;
  }

  //let reducedGreyScale = d3chromatic.schemeGreys[9].slice(0, 7);  // todo: debug
  let reducedGreyScale = d3chromatic.schemeGreys[9];  // todo: debug


  // >> BEGIN NEW
  c.colors = {

    // abstract scales for certain data characteristics
    semanticScales: {
      diverging: d3chromatic.schemeRdBu[11],  // d3chromatic.schemeRdYlBu[9] ?  // mit Nulldurchgang
      sequential: d3chromatic.schemeYlOrBr[9], // ohne Nulldurchgang / bis 0
      discrete9: d3chromatic.schemeSet1,
      discrete12: d3chromatic.schemePaired,
      discrete6light: d3.range(6).map(i => d3chromatic.schemePaired[i * 2]),
      discrete6dark: d3.range(6).map(i => d3chromatic.schemePaired[i * 2 + 1]),
      discrete9light: d3chromatic.schemeSet1.map(co => d3color.hsl(co).brighter(0.5).rgb().toString()),
      discrete9dark: d3chromatic.schemeSet1,
    },

    density: {
      adapt_to_color_usage: false,
      color_single: d3chromatic.interpolateBlues(0.7),
      color_scale: makeDensityScale(d3chromatic.schemeBlues[9]),
      grey_single: d3chromatic.interpolateGreys(0.7),
      grey_scale: makeDensityScale(reducedGreyScale),
    },

    // not used at the moment
    // marginal: {
    //   single: d3chromatic.interpolateGreys(0.5),
    // },

    aggregation: {
      // single:  d3chromatic.interpolateReds(0.55),
      // single:  d3chromatic.schemeSet1[6],
      //single:  d3chromatic.schemeSet1[5],
      single: d3chromatic.schemePaired[7],
    },

    data: {
      //single: d3chromatic.interpolateBlues(0.7),
      //single: d3chromatic.schemeSet1[7],
      single: d3chromatic.schemePaired[6],
    },

    testData: {
      // single: d3chromatic.schemePaired[6], // TODO: improve?
      single: d3chromatic.schemePaired[6], // TODO: improve?
    }
  };

  c.colors.density.single = c.colors.density.grey_single;
  c.colors.density.scale = c.colors.density.grey_scale;

  // << END NEW

  // c.densityColor = {
  //   adapt_to_color_usage: false,
  //   color_single: d3chromatic.interpolateBlues(0.7),
  //   color_scale: makeDensityScale(d3chromatic.schemeBlues[9]),
  //   grey_single: d3chromatic.interpolateGreys(0.7),
  //   grey_scale: makeDensityScale(reducedGreyScale),
  // };
  //
  // c.densityColor.single = c.densityColor.grey_single;
  // c.densityColor.scale = c.densityColor.grey_scale ;
  // // single: d3chromatic.interpolateBlues(0.7), // the default
  // scale: makeDensityScale(d3chromatic.schemeBlues[9]), // the default

  // c.marginalColor = {
  //   single: d3chromatic.interpolateGreys(0.5),
  // };

  // c.aggrColor = {
  //   // single:  d3chromatic.interpolateReds(0.55),
  //   // single:  d3chromatic.schemeSet1[6],
  //   //single:  d3chromatic.schemeSet1[5],
  //   single: d3chromatic.schemePaired[7],
  // };

  // c.dataColor = {
  //   //single: d3chromatic.interpolateBlues(0.7),
  //   //single: d3chromatic.schemeSet1[7],
  //   single: d3chromatic.schemePaired[6],
  // };
  //
  // c.testDataColor = {
  //   // single: d3chromatic.schemePaired[6], // TODO: improve?
  //   single: d3chromatic.schemePaired[6], // TODO: improve?
  // };

  // set of default config options for the visualization
  // beware when you add more
  c.views = {
    aggregations: {
      possible: true, // true iff the view should be made accessible to the user at all, false else
      active: false, // true if the view is active (i.e.. computed and visible) BY DEFAULT false if not
    },
    data: {
      possible: true,
      active: false,
    },
    testData: {
      possible: true,
      active: false,
    },
    marginals: {
      possible: true,
      active: true,
    },
    contour: {
      possible: true,
      active: true,
    },
    predictionOffset: {
      possible: true,
      active: false,
    },
    accuMarginals: {
      possible: true
    }
  };

  // appearantly unused
//   c.maps = {
//     size: 50,
//     minSize: 32,
//     maxSize: 2048,
//     fill: c.aggrColor.single,
// //    fill: "#377eb8", prepaper
//     stroke: "#222222",
//     opacity: 0.3,
//     shape: "circle"
//   };

  // appearantly unused
  // c.appearance = {
  //   pane: {
  //     //borderColor: "#d4d4d4",
  //     borderColor: "#FF0000",
  //     fill: 'none'
  //   }
  // };

  c.colorscales = {
    density: [[0, 'rgba(255,255,255,0)'], [0.000001, 'rgba(255,255,255,0)'], [0.000001, 'rgba(255,255,255,1)'], [1, 'rgba(0,0,0,1)']],
    density2: d3chromatic.schemeBlues[9],
    diverging: d3chromatic.schemeRdBu[11],  // d3chromatic.schemeRdYlBu[9] ?  // mit Nulldurchgang
    sequential: d3chromatic.schemeYlOrBr[9] , // ohne Nulldurchgang / bis 0
    discrete9: d3chromatic.schemeSet1,
    discrete12: d3chromatic.schemePaired,
    discrete6light: d3.range(6).map(i => d3chromatic.schemePaired[i*2]),
    discrete6dark: d3.range(6).map(i => d3chromatic.schemePaired[i*2+1]),
    discrete9light: d3chromatic.schemeSet1.map(co => d3color.hsl(co).brighter(0.5).rgb().toString()),
    discrete9dark: d3chromatic.schemeSet1,
  };

  // shapes in plotly can be specified by a string number or a string 'name' identifier. see also https://plot.ly/javascript/reference/#scatterternary-marker-symbol
  c.shapes = {
    open: _.range(100,144),
    filled: _.range(44),
  };

  c.map = {
    aggrMarker: {
      fill: {
        //def: "#377eb8",
        def: () => c.colors.aggregation.single,
        //def: greys(0.05), // prepaper
        opacity: 1 * !hideAggregations,
      },
      stroke: {
        color: greys(0.95),
        // color: greys(0.1),
        width: 1.5,
      },
      size: {
        min: 3, // HACK: used to be 8.
        max: 160,
        def: 14,
        //type: 'absolute' // 'relative' [% of available paper space], 'absolute' [px]
      },
      line: { // the line connecting the marker points
        //color: cc.colors.aggregation.single,
        color: greys(0.8),
      }
    },

    heatmap: {
      opacity: {
        discrete: 0.5,
        continuous: 0.8,
      },
      xgap: 2,
      ygap: 2,
    },

    sampleMarker: {
      size: {
        min: 6,
        max: 40,
        def: 8,
      },
      stroke: {
        color: greys(0.0),
        width: 1,
      },
      fill: {
        def: () => c.colors.data.single,
        opacity: _opac, //0.9,
        // opacity: 0.8,
      },
      maxDisplayed: 750,  // the maximum number of samples plotted in one trace of one atomic plot
    },

    testDataMarker: {
      stroke: {
        color: greys(1),
        width: 1,
      },
      fill: {
        def: () => c.colors.testData.single,
        opacity: 0.9,
      },
    },

    predictionOffset: {
      line: {
        color: greys(0.7),
        width: 2,
        opacity: 0.8,
        fill: false,
      },
    },

    uniDensity: {
      color: {
        //def: greys(0.5),
        def: () => c.colors.density.single,
      },
      bar: {
        opacity: 0.7,
      },
      line: {
        width: 2.5,
        opacity: 0.7, // line opacity
        fill: true,
        fillopacity: 0.06,
      },
      resolution: _res,
    },

    biDensity: {
      //colorscale: c.colorscales.density, // prepaper
      colorscale: () => c.colors.density.scale, // color scale to use for heat maps / contour plots
      mark: {
        color: () => c.colors.density.single, // color of marks that represent density (e.g circle outline color for a chart where size encodes density)
        opacity: 0.8,
      },
      line: {
        width: 2,
        color: () => c.colors.density.single,
        fill: true,
        fillopacity: 0.06,
      },
//      opacity: 0.8,
      levels: _lvls, //16,
      resolution: _res, //30, // the number computed points along one axis
      labelFormatter: d3.format(".3f"),
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
        color: greys(0.4),
      },
      axis: {
        color: "#3D3A40",
        zerolinewidth: 1.5,
        zerolinecolor: greys(0.3),
      },
      text: {
        color: greys(1.0),
        size: 13,
      }
    },

    marginal: {
      background: {
        fill: 'white', //unused
      },
      grid: {
        color: greys(0.3),
      },
      // prepaper
      // axis: {
      //   color: greys(0.4),
      //   width: 2,
      // },
      axis: {
        color: greys(0.8),
        width: 1,
      },
      text: {
        color: greys(0.5),
        size: 12,
      },
      position: {
        x: 'topright', // bottomleft or topright
        y: 'topright', // bottomleft or topright
      },
    },

    layout: {
      ratio_marginal: used => (used ? 0.75 : 0.05),

      //margin_main_sub: 0.02,
      margin: {
        l: 70,
        //l: 120,
        t: 15,
        r: 15,
        b: 60,
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
        y: 120, // for a y-axis (i.e. it's the available width)
      },

      main_axis_padding: 0.1, // padding between neighboring used main axis in relative coordinates length
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
          showgrid: false, // !!!
          gridcolor: c.plots.main.grid.color,
          ticklen: 5,
          tickfont: {
            color: c.plots.main.text.color,
            size: c.plots.main.text.size,
          },
          // titlefont: { unused, since we use custom axis label
          //   color: c.plots.main.text.color,
          //   size: c.plots.main.text.size*1.25,
          // },
          domain: [offset, offset + length],
          anchor: 'free',
          position: position,
          spikemode: "across",
          showspikes: true,
          spikethickness: 2,
        };
      else
        return {
          visible: true,
          mirror: true,
          showline: false,
          zeroline: false,
          showgrid: false,
          showticklabels: false,
          ticks: "",
          range: [-1, 1],
          fixedrange: true,
          domain: [offset, offset + length],
          anchor: 'free',
          position: position,
          spikemode: "across",
          showspikes: true,
          spikethickness: 2,
        };
    },

    marginal: (offset, length, position, xy) => ({
      //zeroline: !used,
      zeroline: true,
      zerolinecolor: c.plots.marginal.axis.color, // 'main' because visually this represent the main axis
      zerolinewidth: c.plots.marginal.axis.width,
      tickformat: '.3f',
      hoverformat: '.3f',
      // autorange: 'false',
      autorange: 'false',
      fixedrange: false,
      tickmode: 'auto', // TODO:
      nticks: 3,
      side: xy === 'y' ? 'right' : 'top',
      tickfont: {
        color: c.plots.marginal.text.color,
        size: c.plots.marginal.text.size,
      },
      tickangle: xy === 'x' ? -90 : 0,
      spikemode: "across",
      showspikes: true,
      spikethickness: 2,
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

  // TODO: HACK FOR PAPER return Object.freeze(c);
  return c;
});
