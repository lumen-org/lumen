/**
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 * This file provides:
 *
 *   * rev0.6 compatible JSON schemas for settings in this app
 *
 *  Settings are managed as follows:
 *
 *   * all (user) configurable settings are stored in a JSON compatible format
 *   * any change to the settings results in a new JSON object representing the full settings
 *   * to these settings then augmentations are made:
 *      * utility functions are added where ever needed
 *      * other non-json compatible things are added
 *    * the resulting augmented settings object is then made available in ViewSettings.js
 *    * and can be imported and used from other modules
 *
 *  TODO:
 *    * TODO: use default values for schema, instead of separate inital json file. this would simplify the maintainance
 *    * TODO: add remaining dependencies
 *    * TODO/DONE: make editor view more compact. I made some progress
 *    * DONE: make it hideable
 *       * .color is set at runtime dynamically. this should not be part of the settings object, since it is created at query time, instead of being an actual configuration setting
 **/
define(['d3-scale-chromatic','d3-format', 'd3-color', './SplitSample', './Domain', './ViewSettings', './utils'], function (d3chromatic, d3f, d3color, ss, Domain, viewSettings, utils) {
  "use strict";

  // utility functions
  let c2h = utils.colorstring2hex;
  
  let greys = x => c2h(d3chromatic.interpolateGreys(x));
  //let greys = x => d3chromatic.interpolateGreys(x);

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

  /**
   * @param obj
   * @param refs
   * @param dict
   * @param postfix
   * @return {*}
   */
  function translateEnum(obj, refs, dict, postfix="_Enum"/*, deleteflag=False*/) {
    refs = utils.listify(refs);
    for (let ref of refs)
      obj[ref] = dict[obj[ref + postfix]];
    return obj;
  }


  /**
   * An enumeration of all available color schemes.
   * A user can select between these for an option that requires a color scheme.
   */
  let colorscalesEnum = {
      //     density: [[0, 'rgba(255,255,255,0)'], [0.000001, 'rgba(255,255,255,0)'], [0.000001, 'rgba(255,255,255,1)'], [1, 'rgba(0,0,0,1)']],
      blues: d3chromatic.schemeBlues[9],
      density_blues: makeDensityScale(d3chromatic.schemeBlues[9]),
      greens: d3chromatic.schemeGreens[9],
      density_greens: makeDensityScale(d3chromatic.schemeGreens[9]),
      greys: d3chromatic.schemeGreys[9],
      density_greys: makeDensityScale(d3chromatic.schemeGreys[9]),
      oranges: d3chromatic.schemeOranges[9],
      reds: d3chromatic.schemeReds[9],
      rdBu: d3chromatic.schemeRdBu[11],
      rdYlBu: d3chromatic.schemeRdYlBu[9],
      ylOrBr: d3chromatic.schemeYlOrBr[9],
      set1: d3chromatic.schemeSet1,
      paired12: d3chromatic.schemePaired,
      discrete6light: d3.range(6).map(i => d3chromatic.schemePaired[i * 2]),
      discrete6dark: d3.range(6).map(i => d3chromatic.schemePaired[i * 2 + 1]),
      discrete9light: d3chromatic.schemeSet1.map(co => d3color.hsl(co).brighter(0.5).rgb().toString()),
      discrete9dark: d3chromatic.schemeSet1,
    },
    colorscalesKeys = Object.keys(colorscalesEnum),
    colorscalesValues = Object.values(colorscalesEnum);

  let tweaksSchema = {
    type: "object",
    //format: "grid",
    properties: {
      "hideAggregations": {type: "boolean"},
      "hideAccuMarginals": {type: "boolean"},
      "opacity": {type: "number"},
      "levels": {type: "number"},
      "resolution_1d": {type: "integer"},
      "resolution_2d": {type: "integer"},
      "splitCnts": {
        type: "object",
        format: "grid",
        properties: {
          "layout": {type: "integer"},
          "density": {type: "integer", watch: {_res1d: "tweaks.resolution_1d"}, template: "{{_res1d}}"},
          "probability": {type: "integer", watch: {_res1d: "tweaks.resolution_1d"}, template: "{{_res1d}}"},
          "aggregation": {type: "integer"},
        }
      },
      "data_point_limit": {type: "integer"},
    },
  };
  let tweaksInitial = {
    hideAggregations: false,
    hideAccuMarginals: true,
    resolution_1d: 15,
    resolution_2d: 15,
    opacity: 0.7,
    levels: 16,
    splitCnts: {
      layout: 5,
      density: undefined, // TODO: watches
      aggregation: 15,
    },
    data_point_limit: 2000,
  };
  tweaksInitial.splitCnts.density = tweaksInitial.resolution_1d;

  /**
   * the colorsSchema contains all major settings about coloring. All the traces/facets again have their own color settings, however, these often only refer to the settings here. The rationale here is to 'concentrate' these settings at one easily accessible place.
   */
  let colorsSchema = {
    type: "object",
    //title: "colors",
    properties: {
      "semanticScales": {
        type: "object",
        properties: {
          diverging_Enum: {type: "string", enum: colorscalesKeys}, // mit Nulldurchgang
          sequential_Enum: {type: "string", enum: colorscalesKeys}, // ohne Nulldurchgang / bis 0
          discrete9_Enum: {type: "string", enum: colorscalesKeys},
          discrete12_Enum: {type: "string", enum: colorscalesKeys},
          discrete6light_Enum: {type: "string", enum: colorscalesKeys},
          discrete6dark_Enum: {type: "string", enum: colorscalesKeys},
          discrete9light_Enum: {type: "string", enum: colorscalesKeys},
          discrete9dark_Enum: {type: "string", enum: colorscalesKeys},
        },
      },
      "density": {
        type: "object",
        //format: "grid",
        properties: {
           // iff this flag is set to true and no color is used in the VisMEL query, then:
           //  marginal densities will use a grey encoding, while for the 'full' density a (single) hue encoding is used.
          "adapt_to_color_usage": {type: "boolean"},
          // primary: grey
          "primary_single": {type: "string", format: "color"},
          "primary_scale_Enum": {type: "string", enum: colorscalesKeys},
          // secondary: blue (used for full density if no color is used and adapt_to_color_usage flag is set)
          "secondary_single": {type: "string", format: "color"},
          "secondary_scale_Enum": {type: "string", enum: colorscalesKeys},
        }
      },
      "aggregation": {
        type: "object",
        format: "grid",
        properties: {
          "single": {type: "string", format: "color"}
        }
      },
      "data": {
        type: "object",
        format: "grid",
        properties: {
          "single": {type: "string", format: "color"}
        }
      },
      "testData": {
        type: "object",
        format: "grid",
        properties: {
          "single": {type: "string", format: "color"}
        }
      }
    }
  };

  let colorsInitial = {
    // abstract scales for certain data characteristics
    semanticScales: {
      diverging_Enum: "rdBu",  // rdYlBu ?  // mit Nulldurchgang
      sequential_Enum: "ylOrBr", // ohne Nulldurchgang / bis 0
      discrete9_Enum: "set1",
      discrete12_Enum: "paired12",
      discrete6light_Enum: "discrete6light",
      discrete6dark_Enum: "discrete6dark",
      discrete9light_Enum: "discrete9light",
      discrete9dark_Enum: "discrete9dark",
    },

    density: {
      adapt_to_color_usage: true,

      primary_single: greys(0.7),
      primary_scale_Enum: "density_greys", // todo: debug

      secondary_single: c2h(d3chromatic.interpolateBlues(0.7)),
      secondary_scale_Enum: "density_blues",
      //let reducedGreyScale = d3chromatic.schemeGreys[9].slice(0, 7);  // todo: debug
    },

    // not used at the moment
    // marginal: {
    //   single: greys(0.5),
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
      single: d3chromatic.schemePaired[6], // TODO: improve?
    }
  };

  let viewsSchema = {
    //$schema: "http://json-schema.org/draft-06/schema#",
    type: "object",
    title: "views", // todo: rename to traces
    properties: {
      "aggregations": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "data": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "testData": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "marginals": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "contour": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "predictionOffset": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },
      "accuMarginals": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
        }
      },

    }
  };

  let mapSchema = {
    type: "object",
    properties: {
      "aggrMarker": {
        type: "object",
        properties: {
          "fill": {
            type: "object", format: "grid",
            properties: {
              "def": {type: "string", format: "color", watch: {_single: "colors.aggregation.single"}, template: "{{_single}}"},
              // TODO: "opacity": {type: "number", watch: {_hide:"tweaks.hideAggregations"}, template: "1*!{{_hide}}"},
              opacity: {type: "number"},
            }
          },
          "stroke": {
            type: "object", format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "width": {type: "number"},
            }
          },
          "size": {
            type: "object", format: "grid",
            properties: {
              "min": {type: "integer"},
              "max": {type: "integer"},
              "def": {type: "integer"},
              }
            },
          "line": {
            type: "object",
            properties: {
              "color": {type: "string", format: "color"},
            }
          }
        }
      },
      "heatmap": {
        type: "object",
        properties: {
          "opacity": {
            type: "object",format: "grid",
            properties: {
              "discrete": {type: "number"},
              "continuous": {type: "number"},
            }
          },
          "xgap": {type: "integer"},
          "ygap": {type: "integer"},
        }
      },
      "sampleMarker": {
        type: "object",
        properties: {
          "size": {
            type: "object", format: "grid",
            properties: {
              "min": {type: "integer"},
              "max": {type: "integer"},
              "def": {type: "integer"},
            }
          },
          "stroke": {
            type: "object", format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "width": {type: "number"},
            }
          },
          "fill": {
            type: "object", format: "grid",
            properties: {
              "def": {type: "string", format: "color", watch: {_single: "colors.data.single"}, template: "{{_single}}"},
              opacity: {/*TODO*/}
            }
          },
          "maxDisplayed": {type: "integer"},
        }
      },
      "testDataMarker": {
        type: "object",
        properties: {
          "stroke": {
            type: "object", format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "width": {type: "number"},
            }
          },
          "fill": {
            type: "object", format: "grid",
            properties: {
              "def": {type: "string", format: "color", watch: {_single: "colors.testData.single"}, template: "{{_single}}"},
              opacity: {type: "number"}
            },
          },
        }
      },
      "predictionOffset": {
        type: "object",
        properties: {
          "line": {
            type: "object", format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "width": {type: "number"},
              "opacity": {type: "number"},
              "fill": {type: "boolean"},
            }
          }
        }
      },
      "uniDensity": {
        type: "object",
        properties: {
          // "color": { TODO: link to colors.density. ... },
          "bar": {
            type: "object",
            properties: {
              "opacity": {type: "number"},
            }
          },
          "line": {
            type: "object", format: "grid",
            properties: {
              "width": {type: "number"},
              "opacity": {type: "number"},   // line opacity
              "fill": {type: "boolean"},
              "fillopacity": {type: "number"},
            }
          },
          "resolution": {type: "integer", watch: {_res1d: "tweaks.resolution_1d"}, template: "{{_res1d}}"}
        }
      },
      "biDensity": {
        type: "object",
        properties: {
          mark: {
            type: "object", format: "grid",
            properties: {
              // "color": { TODO: link to colors.density. ... }, // color of marks that represent density (e.g circle outline color for a chart where size encodes density)
              "opacity": {type: "number"},
            }
          },
          line: {
            type: "object", format: "grid",
            properties: {
              "width": {type: "number", default: 99},
              // "color": { TODO: link to colors.density. ... },
              "fill": {type: "boolean"},
              "fillopacity": {type: "number"}
            }
          },
          // TODO: make subgroup and  format: "grid",
          // "colorscale_Enum": { TODO: link to colors.density. ... },
          "levels": {type: "integer", watch: {_levels: "tweaks.levels"}, template: "{{_levels}}"},
          "resolution": {type: "integer", watch: {_res2d: "tweaks.resolution_2d"}, template: "{{_res2d}}"},
          "labelFormatterString": {type: "string"}
        }
      }
    }
  };

  let mapInitial = {
    aggrMarker: {
      fill: {
        //def: "#377eb8",
        def: colorsInitial.aggregation.single, // TODO: watches!
        //def: greys(0.05), // prepaper
        opacity: 1 * !tweaksInitial.hideAggregations, // TODO: watches!
      },
      stroke: {
        color: greys(0.95),
        // color: greys(0.1),
        width: 1.5,
      },
      size: {
        min: 10, // HACK: used to be 8.
        max: 500,
        def: 12,
        //type: 'absolute' // 'relative' [% of available paper space], 'absolute' [px]
      },
      line: { // the line connecting the marker points
        //color: c.colors.aggregation.single,
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
        min: 10,
        max: 500,
        def: 8,
      },
      stroke: {
        color: greys(0.0),
        width: 1,
      },
      fill: {
        def: colorsInitial.data.single, // TODO: watched!
        opacity: 0.9, // TODO: watch tweaks->opacity
      },
      maxDisplayed: 750,  // the maximum number of samples plotted in one trace of one atomic plot
    },

    testDataMarker: {
      stroke: {
        color: greys(1),
        width: 1,
      },
      fill: {
        def: colorsInitial.testData.single,// TODO: watched!
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
      bar: {
        opacity: 0.7,
      },
      line: {
        width: 2.5,
        opacity: 0.7, // line opacity
        fill: true,
        fillopacity: 0.06,
      },
      resolution: tweaksInitial.resolution_1d,  // TODO: watched!
    },

    biDensity: {
      mark: {
        opacity: 0.8,
      },
      line: {
        width: 2,
        fill: true,
        fillopacity: 0.06,
      },
      colorscale_Enum: colorsInitial.density.scale_Enum, // color scale to use for heat maps / contour plots  // TODO: watches!
      levels: tweaksInitial.levels, // TODO: watches!
      resolution: tweaksInitial.resolution_2d, // the number computed points along one axis // TODO: watches!
      labelFormatterString: ".3f",
    },
  };

  let plotsSchema = {
    type: "object",
    //format: "grid",
    properties: {
      "axis": {
        type: "object",
        format: "grid",
        properties: {
          "title_style": {type: "string"},
          "label_style": {type: "string"},
          "title_font": {
            type: "object",
            format: "grid",
            properties: {
              "family": {type: "string"},
              "size": {type: "integer"},
              "color": {type: "string", format: "color"},
            }
          },
          "label_font": {
            type: "object",
            format: "grid",
            properties: {
              "family": {type: "string"},
              "size": {type: "integer"},
              "color": {type: "string", format: "color"},
            }
          }
        }
      },
      "main": {
        type: "object",
        //format: "grid",
        properties: {
          "background": {
            type: "object",
            format: "grid",
            properties: {
              "fill": {type: "string", format: "color"} // unused?
            }
          },
          "grid": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"}
            }
          },
          "axis": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "zerolinewidth": {type: "number"},
              "zerolinecolor": {type: "string", format: "color"},
            }
          },
          "text": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "size": {type: "integer"},
            }
          }
        }
      },
      "marginal": {
        type: "object",
        // format: "grid",
        properties: {
          "background": {
            type: "object",
            format: "grid",
            properties: {
              "fill": {type: "string", format: "color"} // unused?
            }
          },
          "grid": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"}
            }
          },
          "axis": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "width": {type: "number"},
            }
          },
          "text": {
            type: "object",
            format: "grid",
            properties: {
              "color": {type: "string", format: "color"},
              "size": {type: "integer"},
            }
          },
          "position": {
            type: "object",
            format: "grid",
            properties: {
              "x": {type: "string", enum:['topright','bottomleft']},
              "y": {type: "string", enum:['topright','bottomleft']}, //
            }
          }
        }
      },
      "layout": {
        type: "object",
        // format: "grid",
        properties: {
          "margin": {
            type: "object",
            format: "grid",
            properties: {
              "l": {type: "number"},
              "t": {type: "number"},
              "r": {type: "number"},
              "b": {type: "number"},
              "pad": {type: "number"},
            }
          },
          "templ_axis_level_ratio": {
            type: "object",
            format: "grid",
            properties: {
              "x": {type: "number"},
              "y": {type: "number"},
            }
          },
          "templ_axis_level_width": {
            type: "object",
            format: "grid",
            properties: {
              "x": {type: "number"},
              "y": {type: "number"},
            }
          },
          "main": {
            type: "object",
            format: "grid",
            properties: {
              "marginal_unused": {type: "number"},
              "marginal_used": {type: "number"},
              "axis_padding": {type: "number"},
            }
          },
        }
      },
    },
    //"defaultProperties": ["axis"],
  };

  let plotsInitial = {
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
      //ratio_marginal: used => (used ? 0.75 : 0.05),

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
      main: {
        // the ratio of space used for the main plot...
        marginal_unused: 0.05,  // ... if there is no marginal
        marginal_used: 0.8,  // ... if there is a marginal plot
        axis_padding: 0.1, // padding between neighboring used main axis in relative coordinates length
      },
    },

    // label: {
    //   formatter: d3f.format(".3") // three significant digits, no trailing zeros
    // }
  };


  let jsonSchema = {
    type: "object",
    //format: "grid",
    properties: {
      "tweaks": {"$ref": "#/definitions/tweaks"},
      "map": {"$ref": "#/definitions/map"},
      "colors": {"$ref": "#/definitions/colors"},
      "plots": {"$ref": "#/definitions/plots"},
    },
    definitions: {
      "tweaks": tweaksSchema,
      "map": mapSchema,
      "colors": colorsSchema,
      "plots": plotsSchema,
    }
  };

  let jsonInitial = {
    map: mapInitial,
    tweaks: tweaksInitial,
    colors: colorsInitial,
    plots: plotsInitial,
  };


  /**
   * add static, non-changable part of the json-compatible config.
   * This should be called on to the settings object on any update.
   * Advantage: no need to specify a schema for it...
   */
  function _addStaticJson(c) {
    // set of default config options for the visualization
    // beware when you add more

    // shapes in plotly can be specified by a string number or a string 'name' identifier. see also https://plot.ly/javascript/reference/#scatterternary-marker-symbol
    c.shapes = {
      // filled: _.range(44),
      filled: [0 /*circle*/,  3/*plus*/, 1 /*square*/, 4 /*X*/, 2 /*diamond*/, 17 /*star*/, 5,6,7,8 /*triangles...*/],
    };
    c.shapes.open = c.shapes.filled.map(n => n+100);


    // some static configuration parts of the GUI
    c.gui = {
      clone_offset: 30, // visualize cloned context with some offset from the original position [px]
    };

    let today = new Date();
    let todayStr = today.getDate() + "-" + (today.getMonth()+1) + "-" + today.getFullYear()

    c.meta = {
      activity_logging_mode: "remote", // one of ["disabled", "console.error", "console.log", "remote"]
      // activity_logging_filename: "user_log.json",
      activity_logging_filename: utils.todayString() + "_" + "activity.log",
      activity_logging_subdomain: '/activitylogger',
      modelbase_subdomain: '/webservice',
    };

    return c;
  }

  function _addRefactorJSON(c) {
    c.views = {
      aggregations: {
        possible: true, // true iff the view should be made accessible to the user at all, false else
        active: false, // true iff the view is active (i.e.. computed and visible) BY DEFAULT false if not
      },
      data: {
        possible: true,
        active: true,
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
    return c;
  }

  function _addNonJson(c) {
    // .plots
    c.plots.styled_text = (title, style) => {
      if (style === "")
        return title;
      return "<" + style + ">" + title + "</" + style + ">";
    };
    c.plots.layout.ratio_marginal = used => (used ? c.plots.layout.main.marginal_used : c.plots.layout.main.marginal_unused);

    // .colors
    translateEnum(c.colors.density, ["primary_scale", "secondary_scale"], colorscalesEnum);
    translateEnum(c.colors.semanticScales, ["diverging", "sequential", "discrete9", "discrete12", "discrete6light", "discrete6dark", "discrete9light", "discrete9dark"], colorscalesEnum);
    // translateEnum(c.myTest, ["color"], colorscalesEnum);

    // .map
    c.map.biDensity.labelFormatter = d3.format(c.map.biDensity.labelFormatterString);
    translateEnum(c.map.biDensity, ["colorscale"], colorscalesEnum);

    return c;
  }

  function _addGenerators(c) {
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
        rangemode: 'nonnegative',
        autorange: 'false',
        fixedrange: true,
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
    return c;
  }

  /**
   * Initialize settings object in ViewSettings.js
   * This is done on import of this module once.
   * @private
   */
  function _initSettings() {
    let settings = makeSettings(JSON.parse(JSON.stringify(jsonInitial)));  // deep copy initial object (why?^^)
    Object.assign(viewSettings, settings);
  }

  /**
   * Make a settings object from given JSON configuration.
   * This adds all non-JSON v06 compatible annotations to the settings object and return this modified object. Their configurable aspects should only depend on the settings object.
   * @param json
   */
  function makeSettings(json) {
    json = _addStaticJson(json);
    json = _addRefactorJSON(json);
    json = _addNonJson(json);
    json = _addGenerators(json);
    return json;
  }

  /**
   * Update the settings object of ViewSetting.js with newSettings
   * @param settings
   */
  function updateSettings(newSettings) {
    Object.assign(viewSettings, newSettings);
  }

  // initializes the settings object in ViewSettings.js
  _initSettings();

  return {
    makeSettings,
    updateSettings,
    jsonSchema,
    jsonInitial,
  }

});