/**
 * This module defines the dimensions/fields/attributes of a model and their usages: Field, FieldUsage and various other types.
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
  var FieldT = Object.freeze({
    Type: {string: 'string', num: 'numerical'},
    Role: {measure: 'measure', dimension: 'dimension'}
  });

  /**
   * Type definitions of a FieldUsage.
   * @type {{Aggregation: {sum: string, avg: string}, Scale: {linear: string, log: string}, Order: {ascending: string, descending: string}}}
   * @alias module:Field.FUsageT
   */
  var FUsageT = Object.freeze({
    Aggregation: {sum: 'maximum', avg: 'average', density: 'density'},
    Scale: {linear: 'linear', log: 'log'},
    Order: {ascending: 'asc', descending: 'desc'}
  });

  /**
   * We call {@link Field} and {@link FieldUsage} both attributes.
   */

  /**
   * A {Field} represents a dimension in a (remote) data source.
   *
   * Note that you should not modify the attributes of a Field directly, as such modification is NOT forwarded to the remote model.
   *
   * @param {string|Field} nameOrField - A unique identifier of a dimension in the data source, or the {@link Field} to copy.
   * @param {Model|null} dataSource - The data source this is a field of, or null (if a {@link Field} is provided for name).
   * @param [args] Additional optional arguments. They will override those of a given {@link Field}.
   * @constructor
   * @alias module:Field.Field
   */
  var Field;
  Field = function (nameOrField, dataSource, args = {}) {
    //if (!args) args = {};
    var isF = nameOrField instanceof Field;
    console.assert(isF || (dataSource && (this.isDiscrete() ? typeof args.domain !== 'undefined' : true)));

    this.name = (isF ? nameOrField.name : nameOrField);
    this.dataSource = utils.selectValue(dataSource, isF, nameOrField.dataSource, {});
    this.dataType = utils.selectValue(args.dataType, isF, nameOrField.dataType, FieldT.Type.num);
    this.role = utils.selectValue(args.role, isF, nameOrField.role, FieldT.Role.measure); //! the fields default role, when used as a FieldUsage
    this.domain = utils.selectValue(args.domain, isF, nameOrField.domain, []);
  };

  Field.prototype.isDimension = function () {
    return isDimension(this);
  };

  Field.prototype.isMeasure = function () {
    return isMeasure(this);
  };

  Field.prototype.isDiscrete = function () {
    return this.dataType === FieldT.Type.string;
  };

  /**
   * Returns a textual description of this field.
   * @returns {String}
   */
  Field.prototype.toString = function () {
    var desc = "'" + this.name + "': " + this.dataType + ", " + this.kind + " " + this.role;
    if (this.dataType === FieldT.Type.num)
      desc += ". domain = [" + this.domain + "]";
    return desc;
  };

  /**
   * A {FieldUsage} represents a configuration of a {Field} for use in a VisMEL expression.
   * It details how the data of a dimension of a data source is mapped to some numerical output range.
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
    this.aggr = utils.selectValue(args.aggr, isFU, base.aggr, FUsageT.Aggregation.density);
    // todo: remove/change/merge scale?
    this.scale = utils.selectValue(args.scale, isFU, base.scale, FUsageT.Scale.linear);
    this.splitter = utils.selectValue(args.splitter,
      isFU, base.splitter,
      this.isDiscrete(), S.plitter.singleElements,
      //S.plitter.equiIntervals);
      S.ampler.equiDistance);

    // todo: this is kinda ugly and so far it doesn't even help...
    if (isFU && base.origin) this.origin = base.origin;
  };
  FieldUsage.prototype = Object.create(Field.prototype);
  FieldUsage.prototype.constructor = FieldUsage;

  /**
   * @returns {*} Returns the split of the domain. For that the field's splitter is called on the field's domain. 
   */
  FieldUsage.prototype.splitToValues = function () {
    // todo: 5 is a magic number. introduce a configuration variable to allow custom splitting
    return this.splitter(this.domain, true, 10);
  };

  /**
   * @returns {Array|*} Splits the field's domain into subdomains according to the field's splitter and returns
   * this FieldUsages with these subdomains as their domains.
   */
  FieldUsage.prototype.split = function () {
    // split domain
    // todo: 10 is a magic number. introduce a configuration variable to allow custom splitting
    var domains = this.splitter(this.domain, false, 10);
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

  FieldUsage.prototype.asModelTuple = function () {
    if (this.role === FieldT.Role.measure) {
      return {
        name: this.name,
        aggregation: this.aggr,
        args: [] //TODO MAGIC NUMBER!
      };
    } else {
      return this.name;
    }
  };

  FieldUsage.prototype.asSplitTuple = function () {
    if (this.role !== FieldT.Role.dimension)
      throw RangeError("Cannot make split tuple if the field usage is not a dimension.");
    return {name:this.name, split:"equidist", args:[10]}; //TODO MAGIC NUMBER! // TODO GET actual split fct
  };

  function asModelTuple (fu) {
    if (!isFieldUsage(fu))
      throw TypeError("parameter not of type FieldUsage");
    return fu.asModelTuple();
  }

  function asSplitTuple (fu) {
    if (!isFieldUsage(fu))
      throw TypeError("parameter not of type FieldUsage");
    return fu.asSplitTuple();
  }

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

  function _nameMap (field) {
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
    asModelTuple: asModelTuple,
    asSplitTuple: asSplitTuple
  };

});