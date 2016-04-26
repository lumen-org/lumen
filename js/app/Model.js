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
  class Model {

    constructor(name) {
      this.name = name
      this.fields = [] // array of {@link F.Field}s
    }

    /**
     * Conditions variable v of this model on the given range and returns the resulting model.
     * Does not change this model.
     * @param v A variable of the model, specified by their index, name, or the field of the model itself.
     * @param value
     */
    condition(v, value) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Marginalizes v out of this model and returns the resulting model.
     * @param v A single variable or an array of variables of this model, specified by their index, name, or the field of the model itself.
     */
    marginalize(v) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Returns the density of this model for the given values, or 'undefined' if values does not specify all required variable values.
     * @param values
     */
    density(values) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Returns the aggregation of this model on the given target field(s). The remaining fields of the model are marginalized.
     *
     * if: what to aggregate: one or more fields
     * how to aggregate: which aggregation do we want?
     * conditionals/domains: restrict domains of fields
     */
    aggregate(id, aggregation) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Restricts the domain as given in the arguments.
     * @param v One or more domain restrictions as its parameters
     */
    restrict (...v) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * @returns Returns a copy of this model.
     * @param {string} [name] - the new name of the model.
     * @constructor
     */
    copy(name) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Returns the number of fields in the model.
     * @returns {*}
     */
    size() {
      return this.fields.length
    }

    /**
     * Returns true iff idx is a valid index of a field of this model.
     * @param idx
     */
    isIndex(idx) {
      return (_.isNumber(idx) && (idx < this.size()) && (idx >= 0))
    }

    /**
     * Returns true iff name is a valid name of a field of this model.
     * @param name
     */
    isName(name) {
      return (_.isString(name) && this.fields.some(function (f) {
        return f.name === name;
      }) )
    }

    /**
     * Returns true iff field is a field of this model. Note that it returns false, if it is a FieldUsage that is based on a Field of this model.
     * @param field
     */
    isField(field) {
      return field instanceof F.Field && (-1 !== this.fields.indexOf(field))
    }

    /**
     * Returns true iff fu is a {@link FieldUsage} that is based on a {@link Field} of this model.
     * @param fu
     */
    isFieldUsage(fu) {
      return fu instanceof F.FieldUsage && (-1 !== this.fields.indexOf(fu.base))
    }

    /**
     * Returns the index that belongs to the given id in this model.
     * @param id - Either a index, a name, or a field of this model.
     * @private
     */
    _asIndex(id) {
      if (this.isIndex(id))
        return id;
      if (this.isName(id))
        return _.findIndex(this.fields, function (f) {
          return f.name === id;
        });
      if (this.isFieldUsage(id))
        return this.fields.indexOf(id.base);
      if (this.isField(id))
        return this.fields.indexOf(id);
      throw new RangeError("argument is neither a valid field index, nor a valid field name, nor a valid Field of this model.");
    }

    /**
     * Returns the field of this model that belongs to the given id
     * @param id - Either a index, a name, or a field of this model.
     * @private
     */
    _asField(id) {
      return this.fields[this._asIndex(id)];
    }

    /**
     * Returns a textual description of the model.
     * @returns {String}
     */
    describe() {
      var desc = "-- Model '" + this.name + "' --\n" +
        "consists of " + this.size() + " fields, as follows\n";
      return this.fields.reduce(
        function (str, field) {
          return str + field.toString() + "\n";
        },
        desc
      );
    }

    /**
     * Returns an array of all {@link F.Field}s of this model, which are dimensions.
     */
    dimensions() {
      return this.fields.filter(F.isDimension);
    }

    measures() {
      return this.fields.filter(F.isMeasure);
    }

  }

  return Model;
});



