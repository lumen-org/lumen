/**
 * VisMEL query module.
 *
 * This module allows to construct VisMEL queries from shelves and sources, and defines utility functions on VisMEL queries.
 *
 *
 * @module VisMEL
 */

define(['./Field', './TableAlgebra'], function(F, TableAlgebra) {
  'use strict';

  /**
   * Constructs the sources part of a VisMEL query from a given source.
   * If no argument is given, an empty source is constructed.
   * @param [source]
   * @constructor
   */
  var Sources = function (source) {
    Array.call(this);
    if (arguments.length !== 0)
      this.push(source);
  };
  Sources.prototype = Object.create(Array.prototype);
  Sources.prototype.constructor = Sources;

  Sources.prototype.shallowCopy = function () {
    var copy = new Sources();
    this.forEach(function(e){copy.push(e);});
    return copy;
  };

  Sources.prototype.toString = function () {
    return JSON.stringify(sources, _replacer.source, _delim);
  };

  /*
   * Extract the source part of a VisMEL query from the given arguments
   * @param source
   * @returns {Array} Array that contains all sources of this VisMEL query
   *
  function _getSources(source) {
    var sources = [source];
    sources.toString = function () {
      return JSON.stringify(sources, _replacer.source, _delim);
    };
    return sources; // todo: in the future there might be multiple sources supported
  }*/

  /**
   * Constructs an empty Layout or creates a Layout from the given shelf.
   * @param [shelf]
   * @constructor
   */
  var Layout = function (shelf) {
    if (arguments.length === 0) {
      this.rows = new TableAlgebra();
      this.cols = new TableAlgebra();
      return;
    }
    this.rows = new TableAlgebra(shelf.row);
    this.cols =  new TableAlgebra(shelf.column);
  };

  Layout.prototype.shallowCopy = function () {
    var copy = new Layout();
    copy.rows = this.rows.shallowCopy();
    copy.cols = this.cols.shallowCopy();
    return copy;
  };

  Layout.prototype.toString = function () {
    return JSON.stringify(this, _replacer.layout, _delim);
  };

  //noinspection JSValidateJSDoc
  /*
   * Extracts the layout part of a VisMEL query from the given arguments
   * @param shelf
   * @returns {{rows: (Returns|*), cols: (Returns|*)}}
   *
  function _getLayout(shelf) {
    var layout = {
      // layout shelves
      rows: new TableAlgebra(shelf.row),
      cols: new TableAlgebra(shelf.column),
      toString: function () {
        return JSON.stringify(layout, _replacer.layout, _delim);
      }

      // states equivalence between two fields in two different data sources
      // ... required to support multiple sources

      //"field_mappings" : [ FIELD_MAPPING*], //future feature

      // define names for those field usages that are on global scope, i.e. in table algebra expressions.
      // ... required to be able to uniquely refer to a field usage (e.g. in pane specializations)

       //I think I don't need that anymore, as I do not work with names to identify field usages, but with references
       //"field_usages" :[
       //FIELD_USAGE*
       //]
    };
    return layout;
    // todo: don't include if it doesn't turn out to be needed multiple times...
    //layout.fieldUsages = layout.rows.uniqueOperands().concat(layout.rows.uniqueOperands());
  }*/

  /**
   * Constructs an empty Layer or constructs a Layer from the given 'aesthetics shelf'.
   * @param shelf
   * @constructor
   */
  var Layer = function (shelf) {
    // empty constructor
    if (arguments.length === 0) {
      this.filters = [];
      this.aesthetics = {
        mark: "auto",
        color: {},
        shape: {},
        size: {},
        details: {}
      };
      return;
    }

    // construct from shelf
    this.filters = _.map(shelf.filter.records, function (r) {
      return r.content;
    }); //todo: implement fully: what range do we condition on

    this.aesthetics = {
      mark: "auto",
      // shelves that hold a single field usages
      color: shelf.color.contentAt(0),
      shape: shelf.shape.contentAt(0),
      size: shelf.size.contentAt(0),
      //orientation: FIELD_USAGE_NAME, //future feature
      // shelves that may hold multiple field usages
      details: _.map(shelf.detail.records, function (r) {
        return r.content;
      })
      //label:   { FIELD_USAGE_NAME* },//future feature
      //hover:   { FIELD_USAGE_NAME* } //future feature
    };
    //specializations: [] // future feature
  };

  Layer.prototype.shallowCopy = function () {
    var copy = new Layer();
    copy.filters = this.filters.slice();
    copy.aesthetics.mark = this.aesthetics.mark;
    copy.aesthetics.color = this.aesthetics.color;
    copy.aesthetics.shape = this.aesthetics.shape;
    copy.aesthetics.size = this.aesthetics.size;
    copy.aesthetics.details = this.aesthetics.details.slice();
    return copy;
  };

  Layer.prototype.toString = function () {
    return JSON.stringify(this, _replacer.layer, _delim);
  };

  /*
   * Extracts the layers part of a VisMEL query from the given arguments
   * @param shelf
   * @returns {Array}
   *
  function _getLayers(shelf) {
    // todo: in the future there might be multiple sources supported
    var layer = {
      //source: source[0], //not necessarily needed, as we use references for the fieldUsages and can get the source from there
      filters: _.map(shelf.filter.records, function (r){return r.content;} ), //todo: implement fully: what range do we condition on
      //field_usages: not needed, as we use references

      aesthetics: {
        mark: "auto",
        // shelves that hold a single field usages
        color: shelf.color.contentAt(0),
        shape: shelf.shape.contentAt(0),
        size: shelf.size.contentAt(0),
        //orientation: FIELD_USAGE_NAME, //future feature
        // shelves that may hold multiple field usages
        details: _.map(shelf.detail.records, function (r){return r.content;} )
        //label:   { FIELD_USAGE_NAME* },//future feature
        //hover:   { FIELD_USAGE_NAME* } //future feature
      },
      toString : function () {
        return JSON.stringify(layer, _replacer.layer, _delim);
      }
      //specializations: [] // future feature
    };
    return [layer];
  }*/


  /**
   * Constructs an empty VisMEL query, or construct a VisMEL query from the given shelves and (single) source.
   * @param shelf
   * @param source
   * @constructor
   * @alias module:VisMEL
   */
  var VisMEL; VisMEL = function (shelves, source) {
    // empty constructor
    if (arguments.length === 0) {
      this.sources = new Sources();
      this.layout = new Layout();
      this.layers = [new Layer()];
      return;
    }

    // construct from shelves and sources
    this.sources = new Sources(source);
    this.layout = new Layout(shelves);
    this.layers = [new Layer(shelves)];
  };

  /**
   * Creates and returns a shallow copy of this VisMEL query.
   * 'Shallow' mean that it recreates the whole structure of the VisMEL query however it just references the {@link FieldUsage}s but doesn't deep copy them. In a sense, it copies everything of the VisMEL tree but only references its 'leaves'.
   * @returns {VisMEL}
   */
  VisMEL.prototype.shallowCopy = function () {
    var copy = new VisMEL();
    copy.sources = this.sources.shallowCopy();
    copy.layout = this.layout.shallowCopy();
    copy.layers = this.layers.map( function(layer) {
      return layer.shallowCopy();
    } );
    return copy;
  };


  /**
   * Returns the set of (unique) variables (i.e. {@link Field} that are used in this VisMEL query.
   */
  VisMEL.prototype.fields = function () {
    var layer = this.layers[0];
    var usedVars = _.union(
      this.layout.rows.fields(),
      this.layout.cols.fields(),
      _.map(layer.aesthetics.details, function(e){return e.base;}),
      _.map(layer.filters, function(e){return e.base;}),
      [layer.aesthetics.color.base, layer.aesthetics.shape.base, layer.aesthetics.size.base]
    );
    return usedVars.filter( function(e){return e instanceof F.Field;} );
  };

  /**
   * @returns Returns the set of {@link FieldUsage}s of this query.
   */
  VisMEL.prototype.fieldUsages = function () {
    var layer = this.layers[0];
    var usedVars = _.union(
      this.layout.rows.fieldUsages(),
      this.layout.cols.fieldUsages(),
      layer.aesthetics.details,
      [ layer.filters, layer.aesthetics.color.base, layer.aesthetics.shape.base, layer.aesthetics.size.base ]
    );
    return usedVars.filter( function(e){return e instanceof F.Field;} );
  };


  /**
   * @returns Returns the set of {@link FieldUsage}s of this query which are measures.
   */
  VisMEL.prototype.measureUsages = function () {
    return this.fieldUsages()
      .filter( function(field) {return field.role === F.FieldT.Role.measure;});
  };

  /**
   * @returns Returns the set of {@link FieldUsage}s of this query that are common among all implied submodels, i.e. all field usages except those of the layout part of the query.
   */
  VisMEL.prototype.commonMeasureUsages = function () {
    return _.without( this.measureUsages(),
      ...this.layout.rows.fieldUsages(), ...this.layout.cols.fieldUsages() );
  };

  /**
   * Returns the set of all unqiue {@link FieldUsage}s of this query that:
   *  (1) are dimensions, and
   *  (2) marks per pane are split by
   * i.e.: all dimension usages on color, shape, size, orientation, details, ... but not on rows, columns, filters.
   * note: 'Unique' means only one FieldUsage per Field is kept, e.g. if there is several dimension usages of a field with name "age" only the first one is kept. This convention is applied, as multiple dimension usages of the same field do NOT lead to more splitting of marks.
   */
  VisMEL.prototype.splittingDimensionUsages = function () {
    var layer = this.layers[0];
    return _.unique( _.filter(
      _.union(
          layer.aesthetics.details,
          [ layer.aesthetics.color, layer.aesthetics.shape, layer.aesthetics.size]
        ),
        function (e) {
          return e instanceof F.FieldUsage && e.role === F.FieldT.Role.dimension;
        }),
      function (dim) {return dim.name;});
  };

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
      if (this instanceof F.Field && key === "dataSource")
        return undefined;
      return value;
    },

    layout : function (key, value) {
      if (value instanceof TableAlgebra)
        return value.toString();
      return value;
    },

    layer : function (key, value) {
      if (value instanceof F.Field)
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
  return VisMEL;
});