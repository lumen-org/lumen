/**
 * VisMEL query module.
 *
 * This module allows to construct VisMEL queries from shelves and sources, and defines utility functions on VisMEL queries.
 *
 * VisMEL queries come in two representations:
 *  1. external: as JSON objects (which of course can be constructed from serialized JSON and be converted in such serialized JSON)
 *  2. internal: as JavaScript objects
 **
 *
 *
 * @module VisMEL
 * @author Philipp Lucas
 * @copyright © 2016-2019 Philipp Lucas (philipp.lucas@uni-jena.de, philipp.lucas@dlr.de)
 */

define(['lib/emitter', './utils', './jsonUtils', './PQL', './TableAlgebra', './RemoteModelling'], function(Emitter, utils, jsonutils, PQL, TableAlgebra, Remote) {
  'use strict';

  // TODO: need to emit some internal changed event for visualization synchronization

  class BaseMap {
    constructor(fieldUsage) {
      this.fu = fieldUsage;
      Emitter(this);
      this.bubbleChangedEventUp(this.fu);
      this.bubbleEventUp(this, Emitter.InternalChangedEvent, Emitter.ChangedEvent);
    }

    copy () {
      return new BaseMap(this.fu);
    }

    static DefaultMap(fu) {
      return new BaseMap(fu);
    }

    toString() {
      return "BaseMap " + this.fu.toString()
    }

    toJSON () {
      return jsonutils.removeEmptyElements(this.fu.toJSON());
    }

    static
    FromJSON (jsonObj, model) {
      let _class = jsonObj.class;
      if (!PQL.FieldUsageT.types.has(_class))
        throw `json object is not of any FieldUsage class, but ${_class}`
      let fu = PQL[_class].FromJSON(jsonObj, model);
       return new BaseMap(fu);
    }
  }

  function isMap (o) {
    return o instanceof BaseMap;
  }

  function isSplitMap(o) {
    return (isMap(o) && PQL.isSplit(o.fu));
  }

  class ColorMap extends BaseMap {
    constructor(fu, channel) {
      super(fu);
      this.channel = channel;
      if (fu.yieldDataType === PQL.FieldT.DataType.num) {
        this.scale = 'linear';
        this.colormap = 'default';
      } else if (fu.yieldDataType === PQL.FieldT.DataType.string) {
        this.scale = 'ordinal';
        this.colormap = 'default';
      } else
        throw new RangeError('invalid value for yieldDataType: ' + fu.yieldDataType);
    }

    copy () {
      return new ColorMap(this.fu, this.channel);
    }

    static
    DefaultMap(fu) {
      return new ColorMap(fu, 'rgb');
    }

    toString() {
      return "ColorMap on "+ this.channel + " of " + this.fu.toString();
    }

    toJSON() {
      // let jsonObj = super.toJSON();
      let jsonObj = this.fu.toJSON();
      return Object.assign(jsonObj, {
        channel: this.channel
      });
    }

    static
    FromJSON (jsonObj, model) {
      let _class = jsonObj.class;
      if (!PQL.FieldUsageT.types.has(_class))
        throw `json object is not of any FieldUsage class, but ${_class}`
      let fu = PQL[_class].FromJSON(jsonObj, model);
      return new ColorMap(fu, jsonObj.channel);
    }
  }

  //var DetailMap = BaseMap;
  var ShapeMap = BaseMap;
  var SizeMap = BaseMap;
  var FilterMap = BaseMap;
  //var LayoutMap = BaseMap;

  /**
   * Converts given instance of (subclass of) BaseMap to a split map, i.e. a BaseMap that has a Split as its FieldUsage.
   * @param map_
   */
  function toSplitMap(map_) {
    if (map_ instanceof ColorMap)
      return new ColorMap(PQL.Split.FromFieldUsage(map_.fu));
    else
      return new BaseMap(PQL.Split.FromFieldUsage(map_.fu));
  }

  /**
   * Constructs the sources part of a VisMEL query from a given source.
   * If no argument is given, an empty source is constructed.
   * @param [source]
   * @constructor
   */
  var Sources = function (source) {
    Array.call(this);
    if (arguments.length === 0 || source === undefined)
      return;
    this.push(source);
  };
  Sources.prototype = Object.create(Array.prototype);
  Sources.prototype.constructor = Sources;

  Sources.prototype.shallowCopy = function () {
    var copy = new Sources();
    this.forEach(function (e) {
      copy.push(e);
    });
    return copy;
  };

  /**
   * TODO: use toJSON as basis instead of yet another representation.
   * @return {string}
   */
  Sources.prototype.toString = function () {
    return JSON.stringify(sources, _replacer.source, _delim);
  };

  Sources.prototype.toJSON = function () {
    return this.map(s => s.toJSON())
  };


  /**
   * Create model from JSON and return it as a Promise.
   * @param jsonObj
   * @return {Promise}
   */
  Sources.FromJSON = function (jsonObj) {
    let modelJSON = undefined;
    if (jsonObj.length === 1)
      modelJSON = jsonObj[0];
    else
      throw "A VisMEL query must have exactly one source";

    return Remote.Model.FromJSON(modelJSON)
        .then( model => [model]);  // return a 1-element array
  };


  /**
   * Constructs an empty Layout, or creates a Layout from the given single or array of LayoutMappings for row and column.
   * @constructor
   */
  class Layout {
    constructor(row, column) {
      this.rows = new TableAlgebra(row);
      this.cols = new TableAlgebra(column);
    }

    shallowCopy() {
      var copy = new Layout();
      copy.rows = this.rows.shallowCopy();
      copy.cols = this.cols.shallowCopy();
      return copy;
    }

    toString() {
      return JSON.stringify(this, _replacer.layout, _delim);
    }

    toJSON () {
      return jsonutils.removeEmptyElements({
        "class": 'layout',
        "rows": this.rows.toJSON(),
        "cols": this.cols.toJSON()
      });

    }

    /**
     *
     * @param jsonObj
     * @param model
     * @return
     * @constructor
     */
    static
    FromJSON (jsonObj, model) {
      jsonutils.assertClass(jsonObj, 'layout');
      let row = TableAlgebra.FromJSON(jsonObj.rows, model),
        col = TableAlgebra.FromJSON(jsonObj.cols, model),
        layout = new Layout();
      layout.rows = row;
      layout.cols = col;
      return layout;
    }
  }


  /**
   * Constructs an empty Layer or constructs a Layer from the given 'aesthetics shelf'.
   * @param shelf
   * @constructor
   */
  class Layer {
    constructor() {
      // empty constructor
      let aesthetics = {
        mark: "auto",
        color: {},
        shape: {},
        size: {},
        details: []
      };

      this.filters = [];
      this.defaults = [];
      this.aesthetics = aesthetics;
    }

    /**
     * @returns an array of all visual maps in this aesthetics object. Note that there are never any visual maps on the
     * details shelf, as this contains field usages.
     */
    visualMaps () {
      let collection = [];
      let a = this.aesthetics;
      if (a.color && a.color instanceof ColorMap)
        collection.push(a.color);
      if (a.shape && a.shape instanceof ShapeMap)
        collection.push(a.shape);
      if (a.size && a.size instanceof SizeMap)
        collection.push(a.size);
      return collection;
    }

    static
    FromJSON(jsonObj, model) {
      jsonutils.assertClass(jsonObj, 'layer');

      let layer = new Layer(),
          aestJson = jsonObj.aesthetics;

      Object.assign(layer.aesthetics, {
          mark: aestJson.mark,
          color: jsonutils.fromJSON_failsafe(aestJson.color, ColorMap.FromJSON, model),
          shape: jsonutils.fromJSON_failsafe(aestJson.shape, BaseMap.FromJSON, model),
          size: jsonutils.fromJSON_failsafe(aestJson.size, BaseMap.FromJSON, model),
          details: jsonutils.arrayFromJSON(aestJson.details, BaseMap.FromJSON, model)
      });

      layer.filters = jsonutils.arrayFromJSON(jsonObj.filters, PQL.Filter.FromJSON, model);
      
      if (jsonObj.defaults && jsonObj.defaults.length > 0)
        throw "not implemented";

      return layer;
    }

    toJSON() {
      let aest = this.aesthetics,
          jsonAest = jsonutils.removeEmptyElements({
                mark: aest.mark,
                color: jsonutils.toJSON_failsafe(aest.color),
                shape: jsonutils.toJSON_failsafe(aest.shape),
                size: jsonutils.toJSON_failsafe(aest.size),
                details: jsonutils.arrayToJSON(aest.details),
          });

      return jsonutils.removeEmptyElements({
        class: 'layer',
        filters: jsonutils.arrayToJSON(this.filters),
        defaults: jsonutils.arrayToJSON(this.defaults),
        aesthetics: jsonAest,
      });
    }

    shallowCopy() {
      var copy = new Layer();
      copy.filters = this.filters.slice();
      copy.defaults = this.defaults.slice();
      copy.aesthetics.mark = this.aesthetics.mark;
      copy.aesthetics.color = this.aesthetics.color;
      copy.aesthetics.shape = this.aesthetics.shape;
      copy.aesthetics.size = this.aesthetics.size;
      copy.aesthetics.details = this.aesthetics.details.slice();
      return copy;
    }

    toString() {
      // TODO: use toJSON() as basis
      return JSON.stringify(this, _replacer.layer, _delim);
    }
  }

  /**
   * Construct Array of {Layer}s from json.
   * @param jsonObj
   * @param model
   * @return {[Layer]}
   * @constructor
   */
  function Layers_fromJSON(jsonObj, model) {
    if (jsonObj.length !== 1)
      throw "layers must have exactly one layer. Will be generalized to support multiple layers in the future.";
    return [Layer.FromJSON(jsonObj[0], model)];
  }


  class VisMEL {
    /**
     * Constructs an empty VisMEL query, or construct a VisMEL query from the given shelves and (single) source.
     * @param shelf
     * @param source
     * @constructor
     * @alias module:VisMEL
     */
    constructor(source) {
      this.sources = new Sources(source);
      this.layout = new Layout();
      this.layers = [new Layer()];
    }


    /**
     * Create VisMEL object from JSON representation.
     *
     * @param jsonStr
     * @constructor
     * @return Returns a promise to a VisMEL object representing the qury in `jsonStr`
     */
    static FromJSON(jsonStr) {
      // stage 1: take str (`jsonStr`) and turn it into JSON object (`jsonObj`)
      let jsonObj = JSON.parse(jsonStr);

      // stage 2: take JSON object (`jsonObj`) and create VisMEL object (`vismelObj`) from it
      // constructing a model from JSON returns a promise!
      jsonutils.assertClass(jsonObj, 'vismel');

      let sourcesPromise = Sources.FromJSON(jsonObj.from);
      return sourcesPromise.then(models => {
        if (models.length > 1)
          throw "not implemented";
        let model = models[0];
        let vismel = new VisMEL(model);
        vismel.layout = Layout.FromJSON(jsonObj.layout, model);
        vismel.layers = Layers_fromJSON(jsonObj.layers, model);
        return vismel;
      });
    }

    toJSON () {
      return jsonutils.removeEmptyElements({
        'class': 'vismel',
        'from': jsonutils.arrayToJSON(this.sources),
        'layout': this.layout.toJSON(),
        'layers': jsonutils.arrayToJSON(this.layers)
      });
    }

    /**
     * Creates and returns a shallow copy of this VisMEL query.
     * 'Shallow' mean that it recreates the whole structure of the VisMEL query however it just references the {@link FieldUsage}s but doesn't deep copy them. In a sense, it copies everything of the VisMEL tree but only references its 'leaves'.
     * @returns {VisMEL}
     */
    shallowCopy() {
      let copy = new VisMEL();
      copy.sources = this.sources.shallowCopy();
      copy.layout = this.layout.shallowCopy();
      copy.layers = this.layers.map(layer => layer.shallowCopy());
      return copy;
    }

    /**
     * @param what A iterable of descriptors to exclude from the collection. Allowed values of the iterable are 'layout', 'details', 'filters', 'aesthetics'.
     * @param mode: either 'include' or 'exclude'.
     * @returns Returns an array of {@link FieldUsage}s of this query.
     *
     */
    fieldUsages(what=[], mode='exclude') {
      let excluded;
      if (mode === 'exclude')
        excluded = new Set(what);
      else if (mode === 'include') {
        const all = ['layout', 'details', 'filters', 'aesthetics', 'defaults'];
        excluded = new Set(_.difference(all, what));
      } else
        throw RangeError("mode must be 'exclude' or 'include'");
      let layer = this.layers[0],
        layout = this.layout,
        aesthetics = layer.aesthetics;
      // VisMEL expressions consist of FieldUsages ...
      let usedVars = _.union(
        excluded.has('layout') ? undefined : layout.rows.fieldUsages(),
        excluded.has('layout') ? undefined : layout.cols.fieldUsages(),
        excluded.has('details') ? undefined : aesthetics.details,
        excluded.has('filters') ? undefined : layer.filters,
        excluded.has('defaults') ? undefined : layer.defaults,
        excluded.has('aesthetics') ? undefined : layer.visualMaps().map(map => map.fu)
      );
      return usedVars.filter(PQL.isFieldUsage);
    }

    /**
     * Rebases this query on a given model. This replaces any {@link Field} of this query by the {@link Field} of the same name of the given model.
     * @param model The model to rebase the query on.
     * @return The modified VisMEL query.
     */
    rebase (model) {
      for (let fu of this.fieldUsages()) {
        if (PQL.isSplit(fu) || PQL.isFilter(fu)) {
          let name = fu.field.name;
          fu.field = model.fields.get(name);
        }
        else if (PQL.isAggregationOrDensity(fu)) {
          fu.fields = fu.fields.map(
            field => model.fields.get(field.name)
          );
        }
        else
          throw TypeError("unknown type of field usage");
      }
    }

    /**
     * Returns a dictionary with keys 'color', 'shape', 'size', 'details', 'x', 'y' and value true or false, where true
     * indicates that the semantic is used in the query.
     */
    usages () {
      let aest = this.layers[0].aesthetics;
      return {
        color: aest.color instanceof ColorMap,
        shape: aest.shape instanceof ShapeMap,
        size: aest.size instanceof SizeMap,
        details:  aest.details.filter( s => s.method !== 'identity').length > 0, // identity splits can be ignored
        x: this.layout.cols[0] !== undefined,
        y: this.layout.rows[0] !== undefined,
        atomic: this.isAtomic()
      };
    }

    /**
     * Returns True iff the VisMEL query is atomic. This is equivalent to:
     *   * the query is not templated
     *   * the expansion of the the table algebra expression on this.layout.rows / cols leads to actually no expansion
     *   * there is at most one FieldUsage on this.layout.rows / cols
     */
    isAtomic () {
      return ((this.layout.cols.length === 1 && PQL.isFieldUsage(this.layout.cols[0])) &&
              (this.layout.rows.length === 1 && PQL.isFieldUsage(this.layout.rows[0])));
    }

    /**
     * Get the model of this query.
     */
    getModel() {
      if (this.sources.length > 1)
        throw "more than one source in vismel queries is not yet implemented.";
      return this.sources[0];
    }
  }

  // delimiter for JSON conversion
  var _delim = '\t';

  // replacer function for JSON conversion
  var _replacer = {
    query : function (key, value) {
      var str = "";
      if (key === "sources")
        str = JSON.stringify(value[0], _replacer.source, _delim);
      if (key === "layers")
        str = JSON.stringify(value[0], _replacer.layer, _delim);
      if (key === "layout")
        str = JSON.stringify(value, _replacer.layout, _delim);
      if (str === "")
        return value;
      else
      return str;
    },

    source : function (key, value) {
      if (PQL.isField(this) && key === "dataSource")
        return undefined;
      return value;
    },

    layout : function (key, value) {
      if (value instanceof TableAlgebra)
        return value.toString();
      return value;
    },

    layer : function (key, value) {
      if (PQL.isField(value))
        return value.name;
      return value;
    }};

  /**
   * @returns {String} Returns a string / JSON representation of the VisMEL query.
   */
  VisMEL.prototype.toString = function () {
    /*var source =  this.sources[0],
      layer = this.layers[0],
      layout = this.layout;*/
    var  str = "";
    str += JSON.stringify(this, _replacer.query, _delim);
    //str += JSON.stringify(source, replacer.source, _delim);
    //str += JSON.stringify(layout, replacer.layout, _delim);
    //str += JSON.stringify(layer, replacer.layer, _delim);
    //todo: hacky...!?
    // problem is: JSON.stringify returns a string that contains the escape characters in front of "special characters"
    return str.replace(/\\n/gi,'\n')
      .replace(/\\t/gi,'\t')
      .replace(/\\"/gi,'"')
      .replace(/}"/gi,'}')
      .replace(/"{/gi,'{');
  };

  /**
    public interface
   */
  return {
    VisMEL,
    Sources,
    Layer,
    Layout,
    BaseMap,
    ColorMap,
    ShapeMap,
    SizeMap,
    FilterMap,
    isMap: isMap,
    isSplitMap,
    toSplitMap,
  };
});