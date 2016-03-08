/**
 * This module defines the dimensions/fields/attributes of a model and their usages: Field, FieldUsage and various other types.
 *
 * todo: at the moment I am restricted to splits/samplings that result in singular values, for both continuous and discrete domains. problem is that i cannot handle the implications of dealing with intervals, i.e. there are intervals in the results table, and hence the scales used for visualization in the view table get intervals as inputs...
 *
 * @author Philipp Lucas
 * @module Field
 */

define(['./utils', './SplitSample'], function (utils, S) {
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
   * @param {Model|null} dataSource - The data source this is a field of, or null (if a {@link Field} is provided for name).
   * @param [args] Additional optional arguments. They will override those of a given {@link Field}.
   * @constructor
   * @alias module:Field.Field
   */
  var Field;
  Field = function (nameOrField, dataSource, args) {
    if (!args) args = {};
    var isF = nameOrField instanceof Field;
    console.assert(isF || (dataSource && (this.isDiscrete() ? typeof args.domain !== 'undefined' : true)));

    this.name = (isF ? nameOrField.name : nameOrField);
    this.dataSource = utils.selectValue(dataSource, isF, nameOrField.dataSource, {});
    this.dataType = utils.selectValue(args.dataType, isF, nameOrField.dataType, FieldT.Type.num);
    this.role = utils.selectValue(args.role, isF, nameOrField.role, FieldT.Role.measure);
    this.kind = utils.selectValue(args.kind, isF, nameOrField.kind, FieldT.Kind.cont);
    this.domain = utils.selectValue(args.domain, isF, nameOrField.domain, []);
  };

  Field.prototype.isDimension = function () {
    return isDimension(this);
  };

  Field.prototype.isMeasure = function () {
    return isMeasure(this);
  };

  Field.prototype.isDiscrete = function () {
    return this.kind === FieldT.Kind.discrete;
  };

  Field.prototype.isContinuous = function () {
    return this.kind === FieldT.Kind.cont;
  };

  /**
   * Returns a textual description of this field.
   * @returns {String}
   */
  Field.prototype.toString = function () {
    var desc = "'" + this.name + "': " + this.dataType + ", " + this.kind + " " + this.role;
    if (this.isDiscrete())
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
  var FieldUsage;
  FieldUsage = function (base, args) {
    console.assert(base instanceof Field || base instanceof FieldUsage);
    Field.call(this, base.name, base.dataSource, base);
    if (!args) args = {};
    var isFU = base instanceof FieldUsage;
    this.base = (isFU ? base.base : base);
    this.aggr = utils.selectValue(args.aggr, isFU, base.aggr, FUsageT.Aggregation.sum);
    // todo: remove/change/merge scale?
    this.scale = utils.selectValue(args.scale, isFU, base.scale, FUsageT.Scale.linear);
    this.splitter = utils.selectValue(args.splitter,
      isFU, base.splitter,
      this.isDiscrete(), S.plitter.singleElements,
      //S.plitter.equiIntervals);
      S.ampler.equiDistance);
  };
  FieldUsage.prototype = Object.create(Field.prototype);
  FieldUsage.prototype.constructor = FieldUsage;

  FieldUsage.prototype.splitToValues = function () {
    // todo: 10 is a magic number. introduce a configuration variable to allow custom splitting
    return this.splitter(this.domain, true, 10);
  };

  FieldUsage.prototype.split = function () {
    // split domain
    var domains = this.splitter(this.domain, false);
    // create copies of this field usage but use the just created 'split domains'
    return domains.map( function (domain) {
      var copy = new FieldUsage(this);
      copy.domain = domain;
      return copy;
    }, this);
  };

  FieldUsage.prototype.toString = function () {
    return (this.role === FieldT.Role.measure ?
    this.aggr + '(' + this.name + ')' :
      this.name);
  };

  //var EmptyField = new Field("empty", {role: "none",  kind:"none", domain:"none", dataType:"none"});

  /**
   * Returns true iff obj is a {@Field} that is a measure.
   * @param obj
   */
  function isMeasure(obj) {
    return obj instanceof Field && obj.role === FieldT.Role.measure;
  }

  /**
   * Returns true iff obj is a {@Field} that is a dimension.
   * @param obj
   */
  function isDimension(obj) {
    return obj instanceof Field && obj.role === FieldT.Role.dimension;
  }

  /**
   * Returns true iff obj is a {@link FieldUsage}
   * @param obj
   * @returns {boolean}
   */
  function isFieldUsage(obj) {
    return obj instanceof FieldUsage;
  }

  /**
   * Returns true iff obj is a {@link Field}
   * @param obj
   * @returns {boolean}
   */
  function isField(obj) {
    return obj instanceof Field;
  }

  function nameMap (field) {
    return field.name;
  }


  return {
    FieldT: FieldT,
    FUsageT: FUsageT,
    Field: Field,
    FieldUsage: FieldUsage,
    isMeasure: isMeasure,
    isDimension: isDimension,
    isFieldUsage: isFieldUsage,
    isField: isField,
    nameMap: nameMap
    //EmptyField :EmptyField
  };

});