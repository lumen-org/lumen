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
define(['lib/d3-scale-chromatic','lib/d3-format', 'lib/d3-color', './plotly-shapes', './SplitSample', './Domain', './ViewSettings', './utils'], function (d3chromatic, d3f, d3color, plotlyShapes, ss, Domain, viewSettings, utils) {
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
      discrete9dark2: d3chromatic.schemeDark2,
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
      "stroke": {
        type: "object",
        format: "grid",
        properties: {
          "color prediction": {type: "string"},
          "color data": {type: "string"},
        }
      },
      "data local prediction": {
        type: "object",
        format: "grid",
        properties: {
          "point number minimum": {type: "integer"},
          "point  number maximum": {type: "integer"},
          "point percentage": {type: "integer"},
          "category": {type: "string"},
        }
      },
      "data_point_limit": {type: "integer"},
    },
  };

  let tweaksInitial = {
    hideAggregations: false,
    hideAccuMarginals: true,
    resolution_1d: 25,
    resolution_2d: 25,
    opacity: 0.5,
    levels: 12,
    splitCnts: {
      layout: 5,
      density: undefined, // TODO: watches
      aggregation: 15,
    },
    data: {
      "stroke color": greys(0.1),
      "stroke width": 1,
      "fill opacity": 0.55,
    },
    prediction: {
      "stroke color": greys(0.9),
      "stroke width": 1,
      "fill opacity": 0.8,
    },
    "data local prediction": {
      "point number maximum": 200,
      "point number minimum": 10,
      "point percentage target": 5,
      "data category": "training data", // or "training data" or "test data"
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
          discrete9dark2_Enum: {type: "string", enum: colorscalesKeys},
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

  let shapesInitial= {
      model:  'square',
      "training data": 'circle',
      "test data": 'cross',
  };

  let colorsInitial = {
    // abstract scales for certain data characteristics
    semanticScales: {
      diverging_Enum: "rdYlBu",  // rdYlBu ?  // mit Nulldurchgang
      sequential_Enum: "ylOrBr", // ohne Nulldurchgang / bis 0
      discrete9_Enum: "set1",
      discrete12_Enum: "paired12",
      discrete6light_Enum: "discrete6light",
      discrete6dark_Enum: "discrete6dark",
      discrete9light_Enum: "discrete9light",
      discrete9dark_Enum: "discrete9dark",
      discrete9dark2_Enum: "discrete9dark2",
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

    data: { //TODO: where is that used?
      single: d3color.hsl(d3chromatic.schemePaired[9]).darker(4).rgb().toString(),
      // single: d3chromatic.schemePaired[9],
    },

    aggregation: {
      single: d3chromatic.schemeDark2[3],
      // single: d3chromatic.schemePaired[1],
    },

    testData: {
      single: d3chromatic.schemeDark2[6],
      // single: d3chromatic.schemePaired[7],
    },

    'training data': {
      single: d3chromatic.schemeDark2[7],
      //single: d3chromatic.schemePaired[3],
    },

    modelSamples: {
      single: d3chromatic.schemeDark2[3],
      // single: d3chromatic.schemePaired[1],
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
      /*"predictionOffset": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
          active: {type: "boolean"},
        }
      },*/
      /*"accuMarginals": {
        type: "object",
        properties: {
          possible: {type: "boolean"},
        }
      },*/

    }
  };

  let mapSchema = {
    type: "object",
    properties: {
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
      "aggrMarker": {
        type: "object",
        properties: {
          "fill": {
            type: "object", format: "grid",
            properties: {
              "def": {type: "string", format: "color", watch: {_single: "colors.aggregation.single"}, template: "{{_single}}"},
              // TODO: "opacity": {type: "number", watch: {_hide:"tweaks.hideAggregations"}, template: "1*!{{_hide}}"},
              "opacity": {type: "number"},
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
              opacity: {type: "number"},
            }
          },
          "maxDisplayed": {type: "integer"},
        }
      },
      "modelSampleMarker": {
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
              "def": {type: "string", format: "color", watch: {_single: "colors.testData.single"}, template: "{{_single}}"},
              opacity: {type: "number"},
            },
          },
        }
      },
      "testDataMarker": {
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
      "dataMarginals": {
        type: "object",
        properties: {
          // // "color": { TODO: link to colors.density. ... },
          // "bar": {
          //   type: "object",
          //   properties: {
          //     "opacity": {type: "number"},
          //   }
          // },
          "line": {
            type: "object", format: "grid",
            properties: {
              // "width": {type: "number"},
              // "opacity": {type: "number"},   // line opacity
              // "fill": {type: "boolean"},
              // "fillopacity": {type: "number"},
              "shapex": {type: "string"}, // spline, linear, hv, vh, hvh, or vhv
              "shapey": {type: "string"}, // spline, linear, hv, vh, hvh, or vhv
            }
          },
          "resolution": {type: "integer", watch: {_res1d: "tweaks.resolution_1d"}, template: "{{_res1d}}"}
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
              "shape": {type: "string"}, // spline, linear, hv, vh, hvh, or vhv
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
          contour: {
            type: "object", format: "grid",
            properties: {
              "width": {type: "number"},
              "coloring": {type: "string"}, // possible values are: "fill" | "heatmap" | "lines"
              "levels": {type: "integer", watch: {_levels: "tweaks.levels"}, template: "{{_levels}}"},
            },
          },
          line: {
            type: "object", format: "grid",
            properties: {
              "width": {type: "number"},
              // "color": { TODO: link to colors.density. ... },
              "fill": {type: "boolean"},
              "fillopacity": {type: "number"}
            }
          },
          // TODO: make subgroup and  format: "grid",
          // "colorscale_Enum": { TODO: link to colors.density. ... },

          "resolution": {type: "integer", watch: {_res2d: "tweaks.resolution_2d"}, template: "{{_res2d}}"},
          "labelFormatterString": {type: "string"},
          "backgroundHeatMap": {type: "boolean"},
        }
      }
    }
  };

  let mapInitial = {
    heatmap: {
      opacity: {
        discrete: 0.5,
        continuous: 0.8,
      },
      xgap: 2,
      ygap: 2,
    },

    aggrMarker: {
      fill: {
        //def: "#377eb8",
        def: colorsInitial.aggregation.single, // TODO: watches!
        //def: greys(0.05), // prepaper
        opacity: tweaksInitial.prediction['fill opacity'] * !tweaksInitial.hideAggregations, // TODO: watches!
      },
      stroke: {
        color: tweaksInitial.prediction["stroke color"],
        "color prediction": tweaksInitial.prediction["stroke color"],
        // color: x,
        width: 1.5,
      },
      size: {
        min: 6, // HACK: used to be 8.
        max: 40,
        def: 10,
        //type: 'absolute' // 'relative' [% of available paper space], 'absolute' [px]
      },
      line: { // the line connecting the marker points
        //color: c.colors.aggregation.single,
        color: greys(0.8),
      },
      shape: {
        def: shapesInitial.model,
      }
    },

    sampleMarker: {
      size: {
        min: 8,
        max: 40,
        def: 12,
      },
      stroke: {
        color: tweaksInitial.data['stroke color'],// #929292
        width: 1,
      },
      fill: {
        def: colorsInitial['training data'].single, // TODO: watched!
        opacity: tweaksInitial.data['fill opacity'], // TODO: watch tweaks->opacity
      },
      shape: {
        def: shapesInitial["training data"],
      },
      maxDisplayed: 750,  // the maximum number of samples plotted in one trace of one atomic plot
    },

    modelSampleMarker: {
      size: {
        min: 8,
        max: 40,
        def: 11,
      },
      fill: {
        def: colorsInitial.modelSamples.single,// TODO: watched!
        opacity: tweaksInitial.data['fill opacity'],
      },
      shape: {
        def: shapesInitial.model,
      },
      stroke: {
        color: tweaksInitial.data['stroke color'],// #929292
        width: 1,
      },
    },

    testDataMarker: {
      size: {
        min: 8,
        max: 40,
        def: 12,
      },
      stroke: {
        color: tweaksInitial.data['stroke color'],
        width: 1,
      },
      fill: {
        def: colorsInitial.testData.single,// TODO: watched!
        opacity: tweaksInitial.data['fill opacity'],
      },
      shape: {
        def: shapesInitial["test data"],
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

    dataMarginals: {
      line: {
        shapex: 'hvh',
        shapey: 'vhv',
      },
      resolution: tweaksInitial.resolution_1d,  // TODO: watched!
    },

    uniDensity: {
      bar: {
        opacity: 0.7,
      },
      line: {
        width: 2,
        opacity: 0.7, // line opacity
        fill: true,
        fillopacity: 0.06,
        shape: 'spline',
      },
      resolution: tweaksInitial.resolution_1d,  // TODO: watched!
    },

    biDensity: {
      mark: {
        opacity: 0.8,
      },
      line: {
        width: 2,
        shape: 'spline', // only used for biqc plots at the moment
        fill: true,
        fillopacity: 0.06,
      },
      contour: {
        width: 3,
        levels: tweaksInitial.levels, // TODO: watches!
        coloring: "lines", // possible values are: "fill" | "heatmap" | "lines"

      },
      colorscale_Enum: colorsInitial.density.scale_Enum, // color scale to use for heat maps / contour plots  // TODO: watches!

      resolution: tweaksInitial.resolution_2d, // the number computed points along one axis // TODO: watches!
      labelFormatterString: ".3f",
      backgroundHeatMap: false, // enable/disable a background heatmap in addition to the scatter trace (with circles) representing cat-cat densities
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
              "weight": {type: "integer"},
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
              "width": {type: "number"},
              "zerolinewidth": {type: "number"},
              "zerolinecolor": {type: "string", format: "color"},
            }
          },
          "label_style": {type: "string"},
          "text": {
            type: "object",
            format: "grid",
            properties: {
              "family": {type: "string"},
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
          "label_style": {type: "string"},
          "text": {
            type: "object",
            format: "grid",
            properties: {
              "family": {type: "string"},
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
      // title_style: "em",
      // title_font: {
      //   family: "Droid Sans",
      //   size: 16,
      //   color: "#b3b3b3",
      // },
      // label_style: "",
      // label_font: {
      //   family: "Droid Sans",
      //   size: 11,
      //   color: "#232323",
      // },
      title_style: "",
      title_font: {
        family: "Roboto Slab, serif",
        size: 14,
        color: greys(0.8), // 0.8 = #404040
        weight: 100, // doesn't work
      },
      // unused
      // label_style: "",
      // label_font: {
      //   family: "Roboto, serif",
      //   size: 11,
      //   color: greys(0.8),
      // },
    },
    main: {
      background: {
        fill: 'white', //unused
      },
      grid: {
        color: greys(0.4),
      },
      axis: {
        color: greys(0.6), //"#a4a4a4",
        width: 1,
        zerolinewidth: 1.5,
        zerolinecolor: greys(0.3),
      },
      label_style: "",
      label: {
        family: "Roboto, sans-serif",
        color: greys(0.6),
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
        color: greys(0.6),
        width: 1,
      },
      test_style: "",
      label: {
        color: greys(0.5),
        size: 10,
        family: "Roboto, sans-serif",
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
        l: 90,
        //l: 120,
        t: 30,
        r: 30,
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
        axis_padding: 0.2, // padding between neighboring used main axis in relative coordinates length
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
    shapes: shapesInitial,
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

    c.legend = {
      symbolSize: 5,
      enable: true,
    };

    // shapes in plotly can be specified by a string number or a string 'name' identifier. see also https://plot.ly/javascript/reference/#scatterternary-marker-symbol
    c.shapes = {
      // filled: _.range(44),
      // KEEP SYNCHRONIZED!
      filled: [0 /*circle*/,  3/*cross*/, 1 /*square*/, 4 /*X*/, 2 /*diamond*/, 17 /*star*/, 5,6,7,8 /*triangles...*/],
      filledName: ['circle',  'cross', 'square', 'x', 'diamond', 'star', 'triangle-up', 'triangle-down', 'triangle-left', 'triangle-right'],
    };
    c.shapes.open = c.shapes.filled.map(n => n+100);
    // precompute svg paths for shapes. unfortunately I cannot access plotly shape svg paths directly...
    c.shapes.svgPath =
      c.shapes.filledName.map(name => `M${c.legend.symbolSize*5} 0 ${plotlyShapes[name].f(c.legend.symbolSize)}`);

    // some static configuration parts of the GUI
    c.gui = {
      clone_offset: 30, // visualize cloned context with some offset from the original position [px]
    };

    let today = new Date();
    let todayStr = today.getDate() + "-" + (today.getMonth()+1) + "-" + today.getFullYear();

    c.meta = {
      activity_logging_mode: "remote", // one of ["disabled", "console.error", "console.log", "remote"]
      // activity_logging_filename: "user_log.json",
      activity_logging_filename: utils.todayString() + "_" + "activity.log",
      activity_logging_subdomain: '/activitylogger',
      modelbase_subdomain: '/webservice',
    };

    c.widget = {
      graph: {
        enable: false,  // enable or disable the graph widget
      },
      userStudy: {
        enabled: false && (c.meta.activity_logging_mode !== "disabled"), // note: always keep the latter part, the former may change to true and false and back...
      },
      details: {
        enabled: false,
      }
    };


    return c;
  }

  function _addRefactorJSON(c) {
    c.views = { // TODO: rename to facets!

      // new way of representation:  differentiate between what and where:
      // what is the advantage?
      // dataDensity : {
      //  marginal: { // -> histograms
      //    possible: true,
      //    active: true,
      //  },
      //  central: { // -> density plot
      //    possible: true,
      //    active: true,
      //  },
      // }
      aggregations: {
        possible: true, // true iff the view should be made accessible to the user at all, false else
        active: false, // true iff the view is active (i.e.. computed and visible) BY DEFAULT false if not
      },

      // training data
      data: {
        possible: true,
        active: true,
      },

      // test data
      testData: {
        possible: true,
        active: true,
      },

      // model samples
      'model samples': {
        possible: true,
        active: true,
      },

      // model density marginal
      marginals: {
        possible: true,
        active: false,
      },

      // training data marginals
      dataMarginals: {
        possible: true,
        active: false,
      },

      // model density 'central' plot
      contour: {
        possible: true,
        active: false,
      },

      // data-local model prediction
      // -> enable choosing between which data?
      predictionDataLocal: {
        possible: true,
        active: false,
      },

      /*predictionOffset: {
        possible: false,
        active: false,
      },*/
      /*accuMarginals: {
        possible: false
      }*/
    };

    c.toolbar = {
      query: {
        active: true,
      },
      clone: {
        active: true,
      },
      undo: {
        active: false,
      },
      redo: {
        active: false,
      },
      clear: {
        active: true,
      },
      details: {
        active: true,
      },
      graph: {
        active: true,
        graph: {
          active: true
        },
        threshold: {
          active: false
        },
      },
      config: {
        active: true,
      },
      reloadmodels: {
        active: true,
      },
      modelselector: {
        active: true,
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

      bounding_rect(xaxis, yaxis) {
        return {
          type: 'rect',
          layer: 'below',
          xref: 'paper',
          yref: 'paper',
          x0: xaxis.domain[0],
          x1: xaxis.domain[1],
          y0: yaxis.domain[0],
          y1: yaxis.domain[1],
          line: {
            color: c.plots.main.axis.color,
            width: c.plots.main.axis.width,
          }
        }
      },
    };

    c.axisGenerator = {
      /**
       * Explanation for a y-axis. For x-axis it is analogous.
       * @param offset y offset
       * @param length lenght along y-direction
       * @param position x position
       * @param used
       * @returns {*}
       */
      main: (offset, length, position, used) => {
        if (used)
          return {
            showline: true,
            linecolor: c.plots.main.axis.color,
            linewidth: c.plots.main.axis.width,
            mirror: false, // 'all' mirrors to marginal axis as well. Note that this cannot work if I use position and not anchor.
            zeroline: false,  // TODO: enable back on?
            zerolinecolor: c.plots.main.axis.zerolinecolor,
            zerolinewidth: c.plots.main.axis.zerolinewidth,
            showgrid: false, // !!!
            gridcolor: c.plots.main.grid.color,
            ticklen: 5,
            ticks: 'outside',
            tickfont: c.plots.main.label,
            tickcolor: c.plots.main.axis.color,
            // titlefont: { unused, since we use custom axis label
            //   color: c.plots.main.label.color,
            //   size: c.plots.main.label.size*1.25,
            // },
            autorange: true,
            domain: [offset, offset + length],
            anchor: 'free',
            position: position,
            spikemode: "across",
            showspikes: true,
            spikethickness: 2,
            spikecolor: c.plots.main.axis.color,
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
        zerolinecolor: c.plots.main.axis.color, // 'main' because visually this represent the main axis
        zerolinewidth: c.plots.marginal.axis.width,
        tickformat: '.3f',
        hoverformat: '.3f',
        rangemode: 'nonnegative',
        autorange: false,
        fixedrange: true,
        side: xy === 'y' ? 'right' : 'top',
        nticks: 3,
        tickmode: 'auto', // TODO:
        tickfont: c.plots.marginal.label,
        tickangle: xy === 'x' ? -90 : 0,
        spikemode: "across",
        showspikes: true,
        spikethickness: 2,
        // titlefont: {
        //   color: c.plots.marginal.label.color,
        //   size: c.plots.marginal.label.size,
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
        type: 'category',
        autorange: false,
        range: [-0.5, ticks.length - 0.5], // must be numbers starting from 0
        fixedrange: true,
        ticklen: 5,
        tickvals: _.range(ticks.length),
        ticktext: ticks,
        tickfont: c.plots.main.label,
        tickcolor: c.plots.main.axis.color,
        linecolor: c.plots.main.axis.color,
        linewidth: c.plots.main.axis.width,
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
