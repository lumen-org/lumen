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

define(['./utils'], function (utils) {
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

      this.name = name;
      this.dataType = dataType;
      this.domain = domain;
      this.dataSource = dataSource;
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

  var SplitMethod = Object.freeze({
    equiDist: 'equiDist'
  });
  var isSplitMethod = (m) => m === SplitMethod.equiDist;

  var AggregationMethods = Object.freeze({
    argmax: 'max',
    argavg: 'avg'
  });
  var isAggregationMethod = (m) => m === AggregationMethods.argavg || m === AggregationMethods.argmax;    

  var DensityMethod = Object.freeze({
    density: 'density'
  });
  var isDensityMethod = (m) => m === DensityMethod.density;

  var FilterMethod = Object.freeze({
    equals: 'equals'
  });
  var isFilterMethod = (m) => m === FilterMethod.equals;


  function Filter (field, method, args={}) {
    if (!isField(field))
      throw TypeError("name must be string identifier of a field");
    if (!isFilterMethod(method))
      throw RangeError("invalid method for Filter: " + method.toString());
    return {
      field: field,
      get name() {return field.name;},
      method: method,
      args: args
    };
  }

  function filterToPQL (f) {
    return {
      name: f.name,
      operator: f.method,
      value: f.args
    };
  }

  function Split (field, method, args={}) {
    if (!isField(field))
      throw TypeError("name must be string identifier of a field");
    if (!isSplitMethod(method))
      throw RangeError("invalid method for Split: " + method.toString());
    return {
      field: field,
      get name() {return field.name;},
      method: method,
      args: args
    };
  }

  function splitToPQL (a) {
    return {
      name: a.name,
      split: a.method,
      args: a.args
    };
  }

  function Aggregation (fields, method, yields, args={}) {
    fields = utils.listify(fields);
    if (!fields.every(isField))
      throw TypeError("all names must be string identifier of fields");
    if (isAggregationMethod(method))
      throw RangeError("invalid method for Aggregation: " + method.toString());
    return {
      fields: fields,
      get names() {return this.fields.map(f=>f.name);},
      method: method,
      yields: yields,
      args: args
    };
  }

  function aggregationToPQL (a) {
    return {
      name: a.names,
      aggregation: a.method,
      yields: a.yields,
      args: a.args
    };
  }

  function Density (fields) {
    fields = utils.listify(fields);
    if (!fields.every(isField))
      throw TypeError("all names must be string identifier of fields");
    return {
      fields: fields,
      get names() {return this.fields.map(f=>f.name);},
      method: DensityMethod.density
    };
  }

  function densityToPQL (d) {
    return {
      name: d.names,
      aggregation: d.method,
      args: d.args
    };
  }

  function isAggregation (obj) {
    return utils.hasProperty(obj, 'method') && isAggregationMethod(obj.method);
  }

  function isSplit (obj) {
    return utils.hasProperty(obj, 'method') && isSplitMethod(obj.method);
  }

  function isDensity (obj) {
    return utils.hasProperty(obj, 'method') && isDensityMethod(obj.method);
  }

  function isFilter (obj) {
    return utils.hasProperty(obj, 'method') && isFilterMethod(obj.method);
  }

  function isFieldUsage (fu) {
    return isAggregation(fu) || isSplit(fu) || isDensity(fu) || isFilter(fu);
  }

  return {
    Field: Field,
    FieldT: FieldT,
    Aggregation: Aggregation,
    Density: Density,
    Split: Split,
    Filter: Filter,
    aggregationToPQL: aggregationToPQL,
    densityToPQL: densityToPQL,
    splitToPQL: splitToPQL,
    filterToPQL: filterToPQL,
    isAggregation: isAggregation,
    isDensity: isDensity,
    isSplit: isSplit,
    isFilter: isFilter,
    isFieldUsage: isFieldUsage
  };

});