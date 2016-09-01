/**
 * This module defines FieldUsages and associated method. FieldUsages can be:
 *   * a split of a Field of a Model
 *   * one dimension of an aggregation of a Model
 *   * a density
 *   * a Filter on a Model ???
 *
 *  Essentially FieldUsages represent an usage of (multiple) Fields of a model.
 *
 *  They also can be converted to a suitable PQL symbols by calling {*}toPQL , i.e. a Split becomes a SplitTuple,
 *  an Aggregation becomes an AggregationTuple, etc.
 *
 * @author Philipp Lucas
 * @module Field
 */

define(['./utils', './Model'], function (utils, gm) {
  "use strict";



  /**
   * Type definitions of a Field.
   * @type {{Type: {string: string, num: string}, Role: {measure: string, dimension: string}, Kind: {cont: string, discrete: string}}}
   * @alias module:Field.FieldT
   */
  var FieldT = Object.freeze({
    DataType: {string: 'string', num: 'numerical'},
    Role: {measure: 'measure', dimension: 'dimension'}
  });

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
  class Field {
    constructor (name, dataType, domain, dataSource) {
      if (!_.isString(name)) throw TypeError("name must be a string, but is: " + name.toString());
      if (!_.contains(FieldT.DataType, dataType)) throw RangeError("invalid dataType: " + dataType.toString());
      if (!(dataSource instanceof gm.Model)) throw TypeError("dataSource must be a Model.");

      this.name = name;
      this.dataType = dataType;
      this.domain = domain;
      this.dataSource = dataSource;

      // this.name = (isF ? nameOrField.name : nameOrField);
      // this.dataSource = utils.selectValue(dataSource, isF, nameOrField.dataSource, {});
      // this.dataType = utils.selectValue(args.dataType, isF, nameOrField.dataType, FieldT.Type.num);
      // this.role = utils.selectValue(args.role, isF, nameOrField.role, FieldT.Role.measure); //! the fields default role, when used as a FieldUsage
      // this.domain = utils.selectValue(args.domain, isF, nameOrField.domain, []);
    }
  }

  function isField (obj) {
    return obj ? obj instanceof Field : false;
  }

  // Field.prototype.isDiscrete = function () {
  //   return this.dataType === FieldT.Type.string;
  // }

  // /**
  //  * Returns a textual description of this field.
  //  * @returns {String}
  //  */
  // Field.prototype.toString = function () {
  //   var desc = "'" + this.name + "': " + this.dataType;
  //   if (this.dataType === FieldT.Type.num)
  //     desc += ". domain = [" + this.domain + "]";
  //   else if (this.dataType === FieldT.Type.string)
  //     desc += ". domain = " + this.domain;
  //   return desc;
  // };


  var SplitMethods = Object.freeze({
    equiSplit: 'equiSplit'
  });

  var AggregationMethods = Object.freeze({
    argmax: 'max',
    argavg: 'avg'
  });

  var DensityMethods = Object.freeze({
    density: 'density'
  });

  var FilterMethods = Object.freeze({
    equals: 'equals'
  });

  function Filter (field, method, args={}) {
    if (!isField(field))
      throw TypeError("name must be string identifier of a field");
    if (-1 === FilterMethods.keys.indexOf(method))
      throw RangeError("invalid method for Filter: " + split.toString());
    return {
      field: field,
      get name() {return field.name;},
      method: method,
      args: args
    };
  }

  function Split (field, method, args={}) {
    if (!isField(field))
      throw TypeError("name must be string identifier of a field");
    if (-1 === SplitMethods.keys.indexOf(method))
      throw RangeError("invalid method for Split: " + split.toString());
    return {
      field: field,
      get name() {return field.name;},
      method: method,
      args: args
    };
  }

  function Aggregation (fields, method, yields, args={}) {
    fields = utils.listify(fields);
    if (!fields.all(isField(fields)))
      throw TypeError("all names must be string identifier of fields");
    if (-1 === AggregationMethods.keys.indexOf(method))
      throw RangeError("invalid method for Aggregation: " + split.toString());
    return {
      fields: fields,
      get names() {return this.fields.map(f=>f.name);},
      method: method,
      yields: yields,
      args: args
    };
  }

  function Density (fields) {
    fields = utils.listify(fields);
    if (!fields.all(isField(fields)))
      throw TypeError("all names must be string identifier of fields");
    return {
      fields: fields,
      get names() {return this.fields.map(f=>f.name);},
      method: DensityMethods.density
    };
  }

  function AggregationToPQL (aggr) {
    throw "Not implemented";
  }

  function isAggregation (obj) {
    return utils.hasProperty(obj, 'method') && -1 === AggregationMethods.keys.indexOf(obj.method);
  }

  function isSplit (obj) {
    return utils.hasProperty(obj, 'method') && -1 === SplitMethods.keys.indexOf(obj.method);
  }

  function isDensity (obj) {
    return utils.hasProperty(obj, 'method') && -1 === DensityMethods.keys.indexOf(obj.method);
  }

  function isFilter (obj) {
    return utils.hasProperty(obj, 'method') && -1 === FilterMethods.keys.indexOf(obj.method);
  }

  function isFieldUsage (fu) {
    return isAggregation(fu) || isSplit(fu) || isDensity(fu) || isFilter(fu);
  }

  return {
    Aggregation: Aggregation,
    Density: Density,
    Split: Split,
    Filter: Filter,
    isAggregation: isAggregation,
    isDensity: isDensity,
    isSplit: isSplit,
    isFilter: isFilter,
    isFieldUsage: isFieldUsage
  };

});