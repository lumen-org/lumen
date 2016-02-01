/**
 * This module defines the dimensions/fields/attributes of a model and their usages: Field, FieldUsage and various other types.
 *
 * @author Philipp Lucas
 * @module Field
 */

define(['./utils'], function (utils) {
  "use strict";

  /**
   * Type definitions of a Field.
   * @type {{Type: {string: string, num: string}, Role: {measure: string, dimension: string}, Kind: {cont: string, discrete: string}}}
   * @alias module:Field.FieldT
   */
  var FieldT = {
    Type: {string: 'string', num: 'numerical'},
    Role: {measure: 'measure', dimension: 'dimension'},
    Kind: {cont: 'continuous', discrete: 'discrete'}
  };

  /**
   * Type definitions of a FieldUsage.
   * @type {{Aggregation: {sum: string, avg: string}, Scale: {linear: string, log: string}, Order: {ascending: string, descending: string}}}
   * @alias module:Field.FUsageT
   */
  var FUsageT = {
    Aggregation: {sum: 'sum', avg: 'avg'},
    Scale: {
      linear: 'linear', log: 'log'
    },
    Order: {
      ascending: 'asc', descending: 'desc'
    }
  };

  /**
   * We call {@link Field} and {@link FieldUsage} both attributes.
   */

  /**
   * A {Field} represents a certain dimension in a data source.
   * @param {string|Field} nameOrField - A unique identifier of a dimension in the data source, or the {@link Field} to copy.
   * @param {DataSource|null} dataSource - The data source this is a field of, or null (if a {@link Field} is provided for name).
   * @param [args] Additional optional arguments. They will override those of a given {@link Field}.
   * @constructor
   * @alias module:Field.Field
   */
  var Field; Field = function (nameOrField, dataSource, args) {
    if (!args) args = {};
    var isF = nameOrField instanceof Field;
    var isD = args.kind === FieldT.Kind.discrete;
//    console.assert(isF || (dataSource  && (isD ? typeof args.domain !== 'undefined' : true)) );
    console.assert(isF || (dataSource  && (isD ? typeof args.domain !== 'undefined' : true)) );

    this.name = (isF ? nameOrField.name : nameOrField);
    this.dataSource = utils.selectValue(dataSource, isF, nameOrField.dataSource, {});
    this.dataType = utils.selectValue(args.dataType, isF, nameOrField.dataType, FieldT.Type.num);
    this.role = utils.selectValue(args.role, isF, nameOrField.role, FieldT.Role.measure);
    this.kind = utils.selectValue(args.kind, isF, nameOrField.kind, FieldT.Kind.cont);
    this.domain = utils.selectValue(args.domain, isF, nameOrField.domain, []);
  };

  /**
   * Returns a textual description of this field.
   * @returns {String}
   */
  Field.prototype.toString = function () {
    var desc = "'" + this.name + "': " + this.dataType + ", " + this.kind + " " + this.role;
    if (this.kind === FieldT.Kind.discrete)
      desc += ". domain = [" + this.domain + "]";
    return desc;
  };

  /**
   * A {FieldUsage} represents a certain configuration of a {Field} for use in a VisMEL expression.
   * It details how the data of a certain dimension of a data source is mapped to some numerical output range.
   * @param {Field|FieldUsage} base - The field or fieldUsage this field usage is based on. If a {@link FieldUsage} is provided a copy of it will be created.
   * @param [args] Optional parameters for scale and aggregation function of the new {@link FieldUsage}. If set, it overrides the settings of base, in case base is a {@link FieldUsage}.
   * @constructor
   * @alias module:Field.FieldUsage
   */
  var FieldUsage; FieldUsage = function (base, args) {
    console.assert(base instanceof Field || base instanceof FieldUsage);
    Field.call(this, base.name, base.dataSource, base);
    if (!args) args = {};
    var isFU = base instanceof FieldUsage;
    this.base = (isFU ? base.base : base);
    // todo: find proper defaults?
    this.aggr = utils.selectValue(args.aggr, isFU, base.aggr, FUsageT.Aggregation.sum);
    this.scale = utils.selectValue(args.scale, isFU, base.scale, FUsageT.Scale.linear);
  };
  FieldUsage.prototype = Object.create(Field.prototype);
  FieldUsage.prototype.constructor = FieldUsage;

  FieldUsage.prototype.toString = function () {
     return (this.role === FieldT.Role.measure ?
      this.aggr + '(' + this.name + ')' :
      this.name);
  };

  return {
    FieldT : FieldT,
    FUsageT : FUsageT,
    Field: Field,
    FieldUsage: FieldUsage
  };

});