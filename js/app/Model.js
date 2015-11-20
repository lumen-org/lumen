/**
 * Model module.
 *
 * This module describes the API to models and allows to train models from data.
 *
 * todo: a lot!
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
    this.fields = [];
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
   * Createas and returns a dummy model with given name and size
   * @param name Name for the model.
   * @param size Number of variables in the model.
   * @param variables An array of length size. Each element is a string that is the name of a variable of the dummy model.
   * @returns Model
   * @constructor
   */
  Model.dummyModel = function (name, size, variables) {
    console.assert(_.isNumber(size) && _.isArray(variables) && _.isString(name));
    console.assert(variables.length === size);
    var myModel = new Model(name);
    myModel.size = size;
    myModel.fields = variables;
    return myModel;
  };

  return Model;
});



