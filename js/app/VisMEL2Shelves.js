/**
 *
 * Extends the prototypes of VisMEL to allow conversion to and from shelves.
 *
 * @module VisMEL2Shelves
 * @author Philipp Lucas
 * @copyright © 2019 Philipp Lucas (philipp.lucas@dlr.de)
 */
//define(['lib/emitter', 'lib/logger', './utils', './PQL',], function (E, Logger, utils, PQL) {
define(['lib/logger', './shelves', './VisMEL',], function (Logger, sh, VisMEL) {
  'use strict';


  VisMEL.Layer.FromShelves = function (shelves) {
    // construct from shelves
    let layer = new VisMEL.Layer();
    layer.filters = shelves.filter.content();
    layer.defaults = ('defaults' in shelves) ? shelves.defaults.content() : [];
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
  };

  VisMEL.Layer.prototype.toShelves = function (shelves) {
    shelves.filters.extend(this.filters);
    shelves.defaults.extend(this.defaults);
    shelves.color.append(this.color);
    shelves.shape.append(this.shape);
    shelves.size.size(this.size);
    shelves.details.extend(this.details);
    return shelves
  };

  /**
   * Constructs a VisMEL query from given shelves and a source.
   * @param shelves A dictionary of shelves, as used in 'lumen.js'. see the code for all 'keys'. Too lazy to document here.
   * @param source A model to be used for the query. Note that this model should the same model which the entries of the shelves refer to eventually (i.e. shelves contain FieldUsages, which refer to Fields, which are part of a model). However, this is NOT validated. You can however use the method VisMEL.rebase(model) to rebase all FieldUsages on another model. This might be useful to prevent changes to prevent changes to the original model in course of the execution of the query.
   * @returns {VisMEL}
   * @constructor
   */
  VisMEL.VisMEL.FromShelves = function (shelves, source) {
    let vismel = new VisMEL.VisMEL();
    vismel.sources = new VisMEL.Sources(source);
    vismel.layout = new VisMEL.Layout(shelves.row.content(), shelves.column.content());
    vismel.layers = [VisMEL.Layer.FromShelves(shelves)];
    return vismel;
  };

  VisMEL.VisMEL.prototype.toShelves = function () {
    let shelves = sh.construct();
    this.layout.toShelves(shelves);
    if (this.layers.length > 1)
      throw "multiple layers not implemented.";
    this.layers[0].toShelves(shelves);
    return shelves;
  };

  // returns nothing as it just extends prototypes and classes
  return {};

});