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
 *      * utility functions are added whereever needed
 *      * other non-json compatible things are added
 *    * the resulting augmented settings object is then made available in ViewSettings.js
 *    * and can be imported and used from other modules
 */
define(['d3-scale-chromatic','d3-format', 'd3-color', './SplitSample', './Domain'], function (d3chromatic, d3f, d3color, ss, Domain) {
  "use strict";

  /*
  * API:
  *  * a function to watch changes in certain parts of the config
  *
  *
  *
  * */

  /**
   * the fixed part of the json-compatible config.
   * This will be added to the settings object on any update.
   */
  let fixedJsonCompatibleConfig = {
    shapes: {
      open: _.range(100,144),
      filled: _.range(44),
    },
  };

  let otherSettingsStuff = {
    plots: {
      styled_text: (title, style) => {
        if (style === "")
          return title;
        return "<" + style + ">" + title +"</" + style + ">";
      },
    },
    layout: {
      ratio_marginal: used => (used ? 0.75 : 0.05),  // translate to JSON dependency
    }
  };

  /**
   * Adds all non-JSON v06 compatible annotations to the settings object and return this modified object.
   * Their configurable aspects should only depend on the settings object.
   * @param json
   */
  function annotateJsonSettings(json) {
    // TODO ...

    return json;
  }

  /**
   * Registers a callback function to be triggered on changes to the JSON subtree referenced by ref.
   *
   * @param ref
   * @param callback
   */
  function watch(ref, callback) {

    // register to editor to watch
    editor.watch(ref, () => {

      let json = editor.getValue();
      json = annotateJsonSettings(json);

      //
      callback()

    });
  }

  let tweaksSchema = {
    type: "object",
    properties: {
      hideAggregations: {type: "boolean"},
    }
  };

  // appearance to plot

  /**
   * An enumeration of all available color schemes.
   * A user can select between these for an option that requires a color scheme.
   */
  let colorscalesEnum = {
    // schemePaired5: d3chromatic.schemePaired[5],
    // schemePaired6: d3chromatic.schemePaired[6],
    // schemePaired7: d3chromatic.schemePaired[7],
    // TODO: change to suitable names.
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

  let colorsSchema = {
    type: "object",
    title: "colors",
    properties: {
      density: {
        type: "object",
        properties: {
          single: {type: "string"},
          scale: {type: "string"},
          adapt_to_color_usage: {type: "boolean"},
        }
      },
      marginal: {
        type: "object",
        properties: {
          single: {type: "object"}
        }
      },
      aggregation: {
        type: "object",
        properties: {
          single: {type: "object"}
        }
      },
      data: {
        type: "object",
        properties: {
          single: {type: "object"}
        }
      },
      testData: {
        type: "object",
        properties: {
          single: {type: "object"}
        }
      }
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

  // let mapsSchema = {
  //   type: "object",
  //   properties: {
  //     size: {type: "integer"},
  //     minSize: {type: "integer"},
  //     maxSize: {type: "integer"},
  //     fill: {type: "string", format: "color"},
  //     stroke: {type: "string", format: "color"},
  //     opacity: {type: "number"},
  //     shape: {type: "string"} // add possible enum types
  //   }
  // };

  let mapSchema = {
    type: "object",
    title: "map",
    properties: {
      aggrMarker: {
        type: "object",
        properties: {
          fill: {
            type: "object",
            properties: {
              def: {
                type: "string",
                format: "color"
              },
              opacity: {
                type: "number"
              }
            }
          },
          stroke: {
            type: "object",
            properties: {
              color: {
                type: "object",
                format: "color",
              },
              width: {
                type: "number",
              }
            }
          },
          size: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              def: { type: "number" },
            }
          }
        }
      }
    }
  };


  // partial schemas?
  let biDensitySchema = {
    type: "object",
    properties: {
      globalColor: {type: "string", format: "color"},
      dependentColor: {type: "string", format: "color", watch: {"pl_color": "root.globalColor"}, template: "{{pl_color}}"},
      mark: {
        type: "object",
        properties: {
          opacity: {type: "number"},
          color: {type: "string", format: "color"},
        }
      },
      line: {
        type: "object",
        //description: "a line description!",
        //format: "grid",
        properties: {
          width: {type: "number", default: 99},
          color: {type: "string", format: "color"},
          fill: {type: "boolean", format: "checkbox"},
          fillopacity: {type: "number"}
        }
      },
      colorscale: {type: "string", enum: ["A","B"]},

      levels: {type: "integer"},
      resolution: {type: "integer"},
      labelFormatString: {type: "string"}
    }
  };




});