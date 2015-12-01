/**
 * Model module.
 * @module Model
 * @author Philipp Lucas
 */
define(['./Field'], function (F) {
  "use strict";

  /**
   * This module describes the API to models and allows to train models from data.
   * So far this module only describes the API for querying a model, which must be implemented by all actual model classes.
   * @alias module:Model
   * @constructor
   */
  var Model; Model = function (name) {
    console.assert(_.isString(name));
    this.name = name;
    this.fields = []; // array of Fields
  };

  /**
   * Conditions variable v of this model on the given range and returns the resulting model.
   * Does not change this model.
   * @param v A variable of the model, specified by their index, name, or the field of the model itself.
   * @param value
   */
  Model.prototype.condition = function (v, value) {
    throw new Error("You have to implement this function in your subclass");
  };

  /**
   * Marginalizes v out of this model and returns the resulting model.
   * @param v A single variable or an array of variables of this model, specified by their index, name, or the field of the model itself.
   */
  Model.prototype.marginalize = function (v) {
    throw new Error("You have to implement this function in your subclass");
    // implement
  };

  /**
   * Returns the density of this model for the given values, or 'undefined' if values does not specify all required variable values.
   * @param values
   */
  Model.prototype.density = function (values) {
    throw new Error("You have to implement this function in your subclass");
  };

  /**
   * @returns Returns a copy of this model.
   * @param {string} [name] - the new name of the model.
   * @constructor
   */
  Model.prototype.copy = function (name) {
    throw new Error("You have to implement this function in your subclass");
  };

  /**
   * Returns the number of free fields in the model.
   * @returns {*}
   */
  Model.prototype.size = function () {
    return this.fields.length;
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
    return field instanceof F.Field && (-1 !== this.fields.indexOf(field));
    /* version including FieldUsages:
    return ( (field instanceof F.Field && (-1 !== this.fields.indexOf(field))) ||
             (field instanceof F.FieldUsage && (-1 !== this.fields.indexOf(field.base))) );*/
  };

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
    throw new Error("argument is neither a valid field index, nor a valid field name, nor a valid Field of this model.");
  };

  /**
   * Returns the field of this model that belongs to the given id
   * @param id - Either a index, a name, or a field of this model.
   * @private
   */
  Model.prototype._asField = function (id) {
    return this.fields[this._asIndex(id)];
  };

  /**
   * Returns a textual description of the model.
   * @returns {String}
   */
  Model.prototype.describe = function () {
    var desc = "-- Model '" + this.name + "' --\n" +
      "consists of " + this.size() + " fields, as follows\n";

    return this.fields.reduce(
      function(str, field) {
        return str + field.toString() + "\n";
      },
      desc
    );
  };

  return Model;
});



