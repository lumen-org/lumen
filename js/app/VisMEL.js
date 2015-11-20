/**
 VisMEL query module.

 This module allows to construct VisMEL queries from shelves and sources, and defines utility functions on VisMEL queries.
 */

define(['app/shelves', 'app/TableAlgebra'], function(sh, TableAlgebra) {
  'use strict';

  /**
   * Extract the source part of a VisMEL query from the given arguments
   * @param source
   * @returns {Array} Array that contains all sources of this VisMEL query
   */
  function _getSources(source) {
    return [source]; // todo: in the future there might be multiple sources supported
  }


  //noinspection JSValidateJSDoc
  /**
   * Extracts the layout part of a VisMEL query from the given arguments
   * @param shelf
   * @returns {{rows: (Returns|*), cols: (Returns|*)}}
   */
  function _getLayout(shelf) {
    return {
      // layout shelves
      rows: new TableAlgebra(shelf.row),
      cols: new TableAlgebra(shelf.column)

      // states equivalence between two fields in two different data sources
      // ... required to support multiple sources

      //"field_mappings" : [ FIELD_MAPPING*], //future feature

      // define names for those field usages that are on global scope, i.e. in table algebra expressions.
      // ... required to be able to uniquely refer to a field usage (e.g. in pane specializations)
      /*
       I think I don't need that anymore, as I do not work with names to identify field usages, but with references
       "field_usages" :[
       FIELD_USAGE*
       ]*/
    };
    // todo: don't include if it doesn't turn out to be needed multiple times...
    //layout.fieldUsages = layout.rows.uniqueOperands().concat(layout.rows.uniqueOperands());
  }


  /**
   * Extracts the layers part of a VisMEL query from the given arguments
   * @param shelf
   * @returns {Array}
   */
  function _getLayers(shelf) {
    // todo: in the future there might be multiple sources supported
    var layer = {
      //source: source[0], //not necessarily needed, as we use references for the fieldUsages and can get the source from there
      filters: _.map(shelf.filter.records, function (r){return r.content;} ), //todo: implement fully: what range do we condition on
      //field_usages: not needed, as we use references

      aestetics: {
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
      }

      //specializations: [] // future feature
    };
    return [layer];
  }


  /**
   * Constructs a VisMEL query from the given shelves and (single) source
   * @param shelf
   * @param source
   * @constructor
   */
  var VisMEL; VisMEL = function (shelf, source) {
    this.sources = _getSources(source);
    this.layout = _getLayout(shelf);
    this.layers = _getLayers(shelf);
  };


  /**
   * Returns the set of variables (i.e. {@link Field} that are used in this VisMEL query.
   */
  VisMEL.prototype.allUsedVariables = function () {
    var layer = this.layers[0];

    var usedVars = _.union(
      this.layout.rows.uniqueFields(),
      this.layout.cols.uniqueFields(),
      _.map(layer.aestetics.details, function(e){return e.base;}),
      _.map(layer.filters, function(e){return e.base;}),
      // todo: make it cleaner: make only the aesthetics enumerable, such that you can do:
      //.map(layer.aestetics, function(e){return e.base;}), ???
      [layer.aestetics.color.base, layer.aestetics.shape.base, layer.aestetics.size.base]
    );
    return _.filter(usedVars, function(e){return (e instanceof sh.Field);} );
  };

  /**
    public interface
   */
  return VisMEL;
});