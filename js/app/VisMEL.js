/**
 * VisMEL query module.
 *
 * This module allows to construct VisMEL queries from shelves and sources, and defines utility functions on VisMEL queries.
 *
 * @module VisMEL
 */

define(['lib/emitter', './utils', './PQL', './TableAlgebra'], function(Emitter, utils, PQL, TableAlgebra) {
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

    static DefaultMap(fu) {
      return new ColorMap(fu, 'rgb');
    }
  }

  //var DetailMap = BaseMap;
  var ShapeMap = BaseMap;
  var SizeMap = BaseMap;
  var FilterMap = BaseMap;
  //var LayoutMap = BaseMap;


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

  Sources.prototype.toString = function () {
    return JSON.stringify(sources, _replacer.source, _delim);
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
  }


  /**
   * Constructs an empty Layer or constructs a Layer from the given 'aesthetics shelf'.
   * @param shelf
   * @constructor
   */
  class Layer {
    constructor() {
      // empty constructor

      /**
       * @returns an array of all visual maps in this aesthetics object. Note that there are never any visual maps on the details shelf, as this contains field usages.
       */
      function visualMaps () {
        var collection = [];
        if (aesthetics.color && aesthetics.color instanceof ColorMap)
          collection.push(aesthetics.color);
        if (aesthetics.shape && aesthetics.shape instanceof ShapeMap)
          collection.push(aesthetics.shape);
        if (aesthetics.size && aesthetics.size instanceof SizeMap)
          collection.push(aesthetics.size);
        return collection;
      }

      var aesthetics = {
        mark: "auto",
        color: {},
        shape: {},
        size: {},
        details: [],
        visualMaps: visualMaps
      };

      this.filters = [];
      this.aesthetics = aesthetics;
    }

    static FromShelves(shelves) {
      // construct from shelves
      var layer = new Layer();
      layer.filters = shelves.filter.content();
      layer.aesthetics = {
        mark: "auto",
        // shelves that hold a single field usages
        color: shelves.color.contentAt(0),
        shape: shelves.shape.contentAt(0),
        size: shelves.size.contentAt(0),
        //orientation: FIELD_USAGE_NAME, //future feature
        // shelves that may hold multiple field usages
        details: shelves.detail.content()
        //label:   { FIELD_USAGE_NAME* },//future feature
        //hover:   { FIELD_USAGE_NAME* } //future feature
      };
      //specializations: [] // future feature
      return layer;
    }

    shallowCopy() {
      var copy = new Layer();
      copy.filters = this.filters.slice();
      copy.aesthetics.mark = this.aesthetics.mark;
      copy.aesthetics.color = this.aesthetics.color;
      copy.aesthetics.shape = this.aesthetics.shape;
      copy.aesthetics.size = this.aesthetics.size;
      copy.aesthetics.details = this.aesthetics.details.slice();
      return copy;
    }

    toString() {
      return JSON.stringify(this, _replacer.layer, _delim);
    }
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

    static FromShelves(shelves, source) {
      // construct from shelves and sources
      var vismel = new VisMEL();
      vismel.sources = new Sources(source);
      vismel.layout = new Layout(shelves.row.content(), shelves.column.content());
      vismel.layers = [Layer.FromShelves(shelves)];
      return vismel;
    }

    /**
     * Creates and returns a shallow copy of this VisMEL query.
     * 'Shallow' mean that it recreates the whole structure of the VisMEL query however it just references the {@link FieldUsage}s but doesn't deep copy them. In a sense, it copies everything of the VisMEL tree but only references its 'leaves'.
     * @returns {VisMEL}
     */
    shallowCopy() {
      var copy = new VisMEL();
      copy.sources = this.sources.shallowCopy();
      copy.layout = this.layout.shallowCopy();
      copy.layers = this.layers.map(layer => layer.shallowCopy());
      return copy;
    }

    /**
     * @param exclude A iterable of descriptors to exclude from the collection. Allowed values of the iterable are 'layout', 'details', 'filters', 'aesthetics'.
     * @returns Returns the set of {@link FieldUsage}s of this query.
     *
     */
    fieldUsages(exclude=[]) {
      exclude = new Set(exclude);
      let layer = this.layers[0],
        layout = this.layout,
        aesthetics = layer.aesthetics;
      // vismel expressions consist of fieldusages ...
      let usedVars = _.union(
        exclude.has('layout') ? undefined : layout.rows.fieldUsages(),
        exclude.has('layout') ? undefined : layout.cols.fieldUsages(),
        exclude.has('details') ? undefined : aesthetics.details,
        exclude.has('filters') ? undefined : layer.filters,
        exclude.has('aesthetics') ? undefined : aesthetics.visualMaps().map(map => map.fu)
      );

      return usedVars.filter(PQL.isFieldUsage);
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
    VisMEL: VisMEL,
    Sources: Sources,
    Layers: Layer,
    Layout: Layout,
    BaseMap: BaseMap,
    ColorMap: ColorMap,
    ShapeMap: ShapeMap,
    SizeMap: SizeMap,
    FilterMap: FilterMap
  };
});