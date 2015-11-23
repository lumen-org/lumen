/**
 * "Dummy Model" module.
 *
 * @author Philipp Lucas
 * @module
 */

define(['./Model'], function (Model) {
  "use strict";

  var logger = Logger.get('pl-DummyModel');
  logger.setLevel(Logger.DEBUG);

  /**
   * Createas and returns a dummy model with given name and size
   * @param name Name for the model.
   * @param size Number of variables in the model.
   * @param variables An array of length size. Each element is a string that is the name of a variable of the dummy model.
   * @returns Model
   * @constructor
   */
  var DummyModel = function (name, size, variables) {
    console.assert(_.isNumber(size) && _.isArray(variables) && _.isString(name));
    console.assert(variables.length === size);

    this.name = name;
    this.fields = variables;
  };

  /**
   * Returns the number of free fields in the model.
   * @returns {*}
   */
  DummyModel.prototype.size = function () {
    return this.fields.length;
  };


  /**
   * Conditions variable v of this model on the given range and returns the modified model.
   * @param v - A variable of the model, given by its index (a number) or its name (a string).
   * @param value - The value to condition v on.
   */
  DummyModel.prototype.condition = function (v, value) {
    var idx = this._asIndex(v);
    // dummy model: don't do anything with value, but remove the conditioned field
    this.fields = _.without(this.fields, this.fields[idx]);
  };


  /**
   * Marginalizes v out of this model and returns the modified model.
   * @param v A single variable or an array of variables of this model, each specified either by their name or their index.
   */
  DummyModel.prototype.marginalize = function (v) {
    var idx = this._asIndex(v);
    // dummy model: don't do anything with value, but remove the marginalized field
    this.fields = _.without(this.fields, this.fields[idx]);
  };


  /**
   * Returns the density of this model for the given values.
   * @param {Array} values - The values to evaluate the model for.
   */
  DummyModel.prototype.density = function (values) {
    console.assert(_.isArray(values) && this.size() === values.length);
    // todo: implement something smarter?
    return Math.random();
  };

  return DummyModel;

});
