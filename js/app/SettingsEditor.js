/**
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define(['./SettingsJSON'], function (SettingsJSON) {
  "use strict";






  // create editor
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

  let BiDensitySchemaStartVal = {
    colorscale: "A", // color scale to use for heat maps / contour plots
    globalColor: "#0000FF",
    dependentColor: "#0000FF",
    mark: {
      color: "#FF0000", // color of marks that represent density (e.g circle outline color for a chart where size encodes density)
      opacity: 0.8,
    },
    line: {
      width: 2,
      color: "##00FF00",
      fill: true,
      fillopacity: 0.06,
    },
//      opacity: 0.8,
    levels: 16, //16,
    resolution: 30, // the number computed points along one axis
    labelFormatString: ".3f",
  };



  /**
   * Registers a callback function to be triggered on changes to the JSON subtree referenced by ref.
   *
   * @param ref
   * @param callback
   */
  function watch(ref, callback) {
    // register to editor to watch
    editor.watch(ref, () => {

      // always update fill settings object
      let json = editor.getValue();
      let settings = SettingsJSON.makeSettings(json);
      SettingsJSON.updateSettings(settings);

      // then call the callback
      callback()
    });
  }

  /**
   * Create a json-editor for the settings in domElement.
   * @param domElement
   */
  function setEditor(domElement) {

    let options = {
      schema: biDensitySchema,
      //schema: viewSchema,
      startval: BiDensitySchemaStartVal,
      theme: 'barebones',
      disable_edit_json: true,
      disable_properties: true,
      disable_collapse: true
    };

    editor = new JSONEditor(domElement, options);

    return editor;
  }

  // currently only a single editor is supported, i.e. only a single instance of viewSettings can be managed.
  // Hence, all visualizations share the same set of settings
  // TODO: we will need a per-instance editor

  let editor = undefined;

  return {
    watch,
    setEditor
  };

});