/**
 * Model module.
 *
 * This module describes the API to models and allows to train models from data.
 *
 * todo: a lot!
 *
 * So far this module only describes the API for querying a model, which must be implemented by all actual model classes.
 *
 * @module
 * @author Philipp Lucas
 */
define([], function () {
  "use strict";

  /**
   * @constructor
   */
  var Model; Model = function (name) {
    this.name = name;
    this.size = 0;
    this.fields = []; // array of Fields
  };

  /**
   * Conditions variable v of this model on the given range and returns the resulting model.
   * Does not change this model.
   * @param v A variable of the model, given by its index (a number) or its name (a string).
   * @param range A
   */
  Model.prototype.condition = function (v, range) {
    // todo: implement
  };


  /**
   * Marginalizes v out of this model and returns the resulting model.
   * @param v A single variable or an array of variables of this model, each specified either by their name or their index.
   */
  Model.prototype.marginalize = function (v) {
    // todo: implement
  };


  /**
   * Returns the density of this model for the given values, or 'undefined' if values does not specify all required variable values.
   * @param values
   */
  Model.prototype.density = function (values) {
    // todo: implement
    return Math.random();
  };


  /**
   * Returns true iff idx is a valid index of a field of this model.
   * @param idx
   */
  Model.prototype.isIndex = function(idx) {
    return (_.isNumber(idx) && (this.size < idx) );
  };

  /**
   * Returns true iff name is a valid name of a field of this model.
   * @param name
   */
  Model.prototype.isName = function(name) {
    return (_.isString(name) && this.fields.some( function(f){return f.name === name;}) );
  };

  /**
   * Returns true iff field is a field of this model.
   * @param field
   */
  Model.prototype.isField = function (field) {
    return (field instanceof Field && (-1 !== this.fields.indexOf(field)) );
  }

  /**
   * Returns the index that belongs to the given id in this model.
   * @param id - Either a index, a name, or a field of this model.
   * @private
   */
  Model.prototype._asIndex = function(id) {
    if (this.isIndex(id))
      return id;
    if (this.isName(id))
      return _.findIndex(this.fields, function(f){return f.name === id;});
    if (this.isField(id))
      return this.fields.indexOf(id);
    throw new Error("argument is neither an valid field index nor a valid field name for this model.");
  };

  /**
   * Returns the field of this model that belongs to the given id
   * @param id - Either a index, a name, or a field of this model.
   * @private
   */
  Model.prototype._asField = function (id) {
    return this.fields[this._asIndex(id)];
  }

  /*Model.prototype.isRange =function (range) {

  }*/


  return Model;
});



