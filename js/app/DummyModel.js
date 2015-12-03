/**
 * "Dummy Model" module.
 *
 * @module DummyModel
 * @author Philipp Lucas
 */

define(['lib/logger', './Field', './Model'], function (Logger, F, Model) {
  "use strict";

  var logger = Logger.get('pl-DummyModel');
  logger.setLevel(Logger.DEBUG);

  /**
   * Creates and returns an empty dummy model with given name
   * @param name Name for the model.
   * @returns {DummyModel}
   * @constructor
   * @alias module:DummyModel
   */
  var DummyModel = function (name) {
    Model.call(this, name);
  };
  DummyModel.prototype = Object.create(Model.prototype);
  DummyModel.prototype.constructor = DummyModel;


  /**
   * Collection of generators of dummy models.
   */
  DummyModel.generator = {

    /**
     * generates a dummy model about census data
     * @returns {DummyModel}
     */
    census : function () {
      var myModel = new DummyModel('census');

      var ageField = new F.Field(
        'age', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          kind: F.FieldT.Kind.cont
        });
      var weightField = new F.Field(
        'weight', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          kind: F.FieldT.Kind.cont
        });
      var incomeField = new F.Field(
        'income', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          kind: F.FieldT.Kind.cont
        });
      var childrenField = new F.Field(
        'children', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          kind: F.FieldT.Kind.discrete,
          // todo: future feature: domain: {min: 0, max: 6}
          domain: [0, 1, 2, 3, 4, 5, 6]
        });
      var sexField = new F.Field(
        'sex', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.dimension,
          kind: F.FieldT.Kind.discrete,
          domain: [0, 1]
        });
      var nameField = new F.Field(
        'name', myModel, {
          dataType: F.FieldT.Type.string,
          role: F.FieldT.Role.dimension,
          kind: F.FieldT.Kind.discrete,
          domain: ['John', 'Philipp', 'Maggie']
        });
      var cityField = new F.Field(
        'city', myModel, {
          dataType: F.FieldT.Type.string,
          role: F.FieldT.Role.dimension,
          kind: F.FieldT.Kind.discrete,
          domain: ['Jena', 'Weimar', 'Berlin']
        });

      myModel.fields = [
        ageField,
        weightField,
        incomeField,
        childrenField,
        sexField,
        nameField,
        cityField
      ];

      return myModel;
    },

    empty : function () {
      return new DummyModel('empty');
    }
  };


  /**
   * Conditions variable v of this model on the given range and returns the modified model.
   * @param v - A variable of the model, given by its index (a number) or its name (a string).
   * @param value - The value to condition v on.
   * @returns {DummyModel}
   */
  DummyModel.prototype.condition = function (v, value) {
    // dummy model: don't do anything with value, but remove the conditioned field
    this.fields = _.without(this.fields, this.fields[this._asIndex(v)]);
    return this;
  };


  /**
   * Marginalizes v out of this model and returns the modified model.
   * @param v A single variable or an array of variables of this model, each specified either by their name or their index.
   * @returns {DummyModel}
   */
  DummyModel.prototype.marginalize = function (v) {
    if (!Array.isArray(v))
      v = [v];
    v.forEach( function(e) {
      // dummy model: don't do anything with value, but remove the marginalized field
      this.fields = _.without(this.fields, this.fields[ this._asIndex(e)] );
    }, this);
/*
    for (var i=0; i< v.length; ++i) {
      this.fields = _.without(this.fields, this.fields[ this._asIndex(v[i])] );
    }*/
    return this;
  };


  /**
   * Returns the density of this model for the given values.
   * @param {Array} values - The values to evaluate the model for.
   * @returns {Number}
   */
  DummyModel.prototype.density = function (values) {
    if (!(Array.isArray(values) && this.size() <= values.length))
      throw new Error("invalid number of arguments");
    // todo: implement something smarter?
    return Math.random();
  };


  /**
   * @param {string} [name] - the new name of the model.
   * @returns Returns a copy of this model.
   * @constructor
   */
  DummyModel.prototype.copy = function (name) {
    if (!name)
      name = this.name;
    var myCopy = new DummyModel(name);
    myCopy.fields = this.fields.slice();
    return myCopy;
  };

  return DummyModel;

});
