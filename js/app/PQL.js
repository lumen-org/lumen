/**
 * This module defines the components of PQL and provides functionality to construct PQL queries.
 *
 * There is two representations of a PQL query: an 'internal' JS-Object based one, and a 'external' JSON-formatted one.
 * While the former is meant for use with the JS compute environment, it can be turned into the JSON-format by calling
 * appropriate methods. The JSON-format is for cross-compute-environment usage.
 *
 * This module defines FieldUsages and associated method. FieldUsages can be:
 *   * a split of a Field of a Model
 *   * one dimension of an aggregation of a Model
 *   * a density
 *   * a Filter on a Model
 *
 *  Essentially FieldUsages represent an usage of (multiple) Fields of a model.
 *
 *  They also can be converted to suitable 'JSON formatted' PQL symbols by calling {*}toJSON , i.e. a Split becomes a SplitTuple,
 *  an Aggregation becomes an AggregationTuple, etc.
 *  The so created 'JSON' can be serialized into a string using the core modele JSON.stringify function.
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module PQL
 */

define(['lib/emitter','./Domain', './utils'], function (Emitter, domain, utils) {
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
    constructor (name, dataType, domain, extent) {
      if (!_.isString(name)) throw TypeError("name must be a string, but is: " + name.toString());
      if (!_.contains(FieldT.DataType, dataType)) throw RangeError("invalid dataType: " + dataType.toString());
      if (extent.isUnbounded()) throw RangeError("extent may not be unbounded.");

      this.name = name;
      this.dataType = dataType;
      this.domain = domain;
      this.extent = extent;
      //this.dataSource = dataSource;
      Emitter(this);
    }

    toString() {
      var desc = "'" + this.name + "' (" + this.dataType + ') ';
      if (this.dataType === FieldT.DataType.num)
        desc += " domain = " + this.domain;
      return desc;
    }

    isDiscrete() {
      return (this.dataType === FieldT.DataType.string);
    }

    copy () {
      return new Field(this.name, this.dataType, this.domain.copy(), this.extent.copy());
    }
  }

  function isField (obj) {
    return obj ? obj instanceof Field : false;
  }

  var SplitMethod = Object.freeze({
    equiDist: 'equiDist',
    identity: 'identity',
    elements: 'elements'
  });
  //var isSplitMethod = (m) => m === SplitMethod.equiDist || m === SplitMethod.identity;
  var isSplitMethod = (m) => utils.hasValue(SplitMethod, m);

  var AggregationMethods = Object.freeze({
    argmax: 'maximum',
    argavg: 'average'
  });
  var isAggregationMethod = (m) => (m === AggregationMethods.argavg || m === AggregationMethods.argmax);

  var DensityMethod = Object.freeze({
    density: 'density'
  });
  var isDensityMethod = (m) => m === DensityMethod.density;

  var FilterMethod = Object.freeze({
    equals: 'equals',
    in: 'in'
  });
  var isFilterMethod = (m) => m === FilterMethod.equals || m === FilterMethod.in;


  class FieldUsage {
    constructor () {
      Emitter(this);
      this.bubbleEventUp(this, Emitter.InternalChangedEvent, Emitter.ChangedEvent);
    }

    emitInternalChanged() {
      this.emit(Emitter.InternalChangedEvent);
    }

  }

  class Filter extends FieldUsage {
    // TODO: Filter, Density, Aggregation Split: need to emit some internal changed event for visualization synchronization. At the moment this is so rare that emitInternalChanged is simply called from outside when necessary. However, that is obviously not clean.

    constructor (field, method, args) {
      super();
      if (!isField(field))
        throw TypeError("'field' must be a field");
      if (!isFilterMethod(method))
        throw RangeError("invalid method for Filter: " + method.toString());
      if (args === undefined)
        args = new field.domain.constructor();
      if (!(args instanceof domain.Abstract))
        throw TypeError("'args' must be a domain");
      this.field = field;
      this.method = method;
      this.args = args;
    }

    static DefaultFilter (field) {
      return new Filter(field, FilterMethod.in, field.extent);
    }

    get name() {return this.field.name;}

    toJSON() {
      return Filter.toJSON(this);
    }

    static toJSON (f) {
      return {        
        name: f.name,
        operator: f.method,
        value: f.args.value
      };
    }

    toString() {
      return this.field.name + " " + this.method + " " + this.args;
    }

    copy () {
      return new Filter(this.field.copy(), this.method, this.args);
    }
  }

  class Split extends FieldUsage {
    constructor (field, method, args=[]) {
      super();
      if (!isField(field))
        throw TypeError("field must be a Field");
      if (!isSplitMethod(method))
        throw RangeError("invalid method for Split: " + method.toString());
      this.field = field;
      this.method = method;
      this.args = utils.listify(args);
    }

    get name() {return this.field.name;}

    get yieldDataType() {return this.field.dataType;}

    get yields() {return this.field.name;}

    toJSON() {
      return Split.toJSON(this);
    }

    toString() {
      return this.method  + " of " + this.field.name + " with args:" + " " + this.args;
    }

    copy () {
      return new Split(this.field.copy(), this.method, this.args);
    }

    static FromFieldUsage (fu) {
      if (isSplit(fu) || isFilter(fu))
        return Split.DefaultSplit(fu.field);
      else if (isAggregation(fu) || isDensity(fu))
        return Split.DefaultSplit(fu.fields[0]);
      else
        throw new TypeError("fu is not a FieldUsage");
    }

    static DefaultSplit (field) {
      if (field.dataType === FieldT.DataType.string)
        return new Split(field, SplitMethod.elements, []);
      else if (field.dataType === FieldT.DataType.num)
        return new Split(field, SplitMethod.equiDist, [4]);
      else
        throw new RangeError("invalid data type");
    }

    static toJSON (a) {
      return {
        name: a.name,
        split: a.method,
        args: a.args
      };
    }
  }

  class Aggregation extends FieldUsage {
    constructor(fields, method, yields, args = []) {
      super();
      fields = utils.listify(fields);
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      if (!isAggregationMethod(method))
        throw RangeError("invalid method for Aggregation: " + method);
      if (-1 == fields.map(f=>f.name).indexOf(yields))
        throw RangeError("yields is not a name of any of aggregated fields: " + yields);
      this.fields = fields;
      this.method = method;
      this.yields = yields;
      this.args = args;
    }

    static DefaultAggregation (fields) {
      fields = utils.listify(fields);
      return new Aggregation(fields, AggregationMethods.argmax, fields[0].name);
    }

    static FromFieldUsage (fu) {
      if (isSplit(fu) || isFilter(fu))
        return Aggregation.DefaultAggregation(fu.field);
      else if (isAggregation(fu) || isDensity(fu))
        return Aggregation.DefaultAggregation(fu.fields);
      else
        throw new TypeError("fu is not a FieldUsage");
    }

    get names() {
      return this.fields.map(f=>f.name);
    }

    get yieldDataType() {
      return _.find(this.fields, f => f.name === this.yields).dataType;
    }

    toJSON() {
      return Aggregation.toJSON(this);
    }

    copy () {
      return new Aggregation(this.fields.map(field => field.copy()), this.method, this.yields, this.args);
    }

    static toJSON (a) {
      return {
        name: a.names,
        aggregation: a.method,
        yields: a.yields,
        args: a.args
      };
    }

    toString () {
      return this.method  + " of [" + this.names + "] with args: [" + this.args + "]";
    }
  }

  class Density extends FieldUsage {
    constructor(fields) {
      super();
      fields = utils.listify(fields);
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      this.fields = fields;
      this.method = DensityMethod.density;
      this.yieldDataType = FieldT.DataType.num;
    }

    get names() {
      return this.fields.map(f=>f.name);
    }

    get yields() {
      return 'density(' + this.names + ')';
    }

    toJSON() {
      return Density.toJSON(this);
    }

    copy () {
      return new Density(this.fields.map(field => field.copy()));
    }

    static toJSON(d) {
      return {
        name: d.names,
        aggregation: d.method,
        args: d.args
      };
    }

    static FromFieldUsage (fu) {
      if (isSplit(fu) || isFilter(fu))
        return new Density(fu.field);
      else if (isAggregation(fu) || isDensity(fu))
        return new Density(fu.fields);
      else
        throw new TypeError("fu is not a FieldUsage");
    }

    toString () {
      return this.method  + " of [" + this.names + "]";
    }
  }

  function isAggregation (obj) {
    return obj instanceof Aggregation;
  }

  function isSplit (obj) {
    return obj instanceof Split;
  }

  function isDensity (obj) {
    return obj instanceof Density;
  }

  function isAggregationOrDensity (obj) {
    return isAggregation(obj) || isDensity(obj);
  }

  function isFilter (obj) {
    return obj instanceof Filter;
  }

  function isFieldUsage (fu) {
    return fu instanceof FieldUsage;
  }

  function hasDiscreteYield(fu) {
    return fu.yieldDataType === FieldT.DataType.string;
  }

  /**
   * Returns the set of (unique) {@link Field}s implicitly contained in the given array of field usages.
   * Note that uniqueness is decided (and returned) on the level of Field not FieldUsages.
   */
  function fields (fieldUsages) {
    return _.uniq(_.reduce(
      fieldUsages,
      (fields, fu) => {
        if (isAggregation(fu) || isDensity(fu))
          fields.push(...fu.fields);
        else
          fields.push(fu.field);
        return fields;
        },
      []
    ));
  }

  /**
   * PQL: create JSON-formatted queries from internal-format
   */
  var toJSON = {
    /**
     * @param from {String} The name of the modle to predict from.
     * @param predict  A list or a single object of ({@link Aggregation}|{@link Density}|name-of-field|{@link Field})
     * @param where A list or a single object of {@link Filter}
     * @param splitBy A list or a single object of {@link Split}.
     * @returns {Array} A Table containing the predicted values. The table is row based, hence the first index is for the rows, the second for the columns. Moreover the table has a self-explanatory attribute '.header'.
     */
    predict: function (from, predict, where = [], splitBy = [] /*, returnBasemodel=false*/) {
      [predict, where, splitBy] = utils.listify(predict, where, splitBy);
      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      if (!where.every(isFilter)) throw new TypeError("'where' must be all of type Filter.");
      if (!splitBy.every(isSplit)) throw new TypeError("'where' must be all of type Split.");
      return {
        "PREDICT": predict.map(p => {
          if (_.isString(p)) // its just the name of a field then
            return p;
          if (isField(p) || isSplit(p))
            return p.name;
          else if (isAggregation(p) || isDensity(p))
            return p.toJSON();
          else
            throw new TypeError("'predict' must be all of type Aggregation, Density or string.");
        }),
        "FROM": from,
        "WHERE": where.map(Filter.toJSON),
        "SPLIT BY": splitBy.map(Split.toJSON)
      };
    },

    model: function (from, model, as_, where = []) {
      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      if (model !== "*") {
        model = utils.listify(model);
        if(!model.every( o => isField(o) || _.isString(o) )) throw new TypeError("'model' must be all strings or fields");
        model = model.map( o => isField(o) ? o.name : o);
      }
      where = utils.listify(where);
      if(!where.every(isFilter)) throw new TypeError("'where' must be all filters.");
      if(!_.isString(as_)) throw new TypeError("'name' must be a string");

      return {
        "MODEL": model,
        "FROM": from,
        "WHERE": where.map(Filter.toJSON),
        "AS": as_
      };
    },

    copy: function (from, as_) {
      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      if (!_.isString(as_)) throw new TypeError("'as_' must be of type String");
      return {
        "MODEL": "*",
        "FROM": from,
        "AS": as_
      };
    },

    header : function (from) {
      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      return {
        "SHOW": "HEADER",
        "FROM": from
      };
    },

    models: () => ({"SHOW": "MODELS"}),

    drop: function (name) {
      if (!_.isString(name)) throw new TypeError("'name' must be of type String");
      return {"SHOW": name};
    }
  };

  return {
    Field: Field,
    FieldT: FieldT,
    isField: isField,
    Aggregation: Aggregation,
    Density: Density,
    Split: Split,
    Filter: Filter,
    isAggregation: isAggregation,
    isDensity: isDensity,
    isAggregationOrDensity: isAggregationOrDensity,
    isSplit: isSplit,
    isFilter: isFilter,
    isFieldUsage: isFieldUsage,
    fields: fields,
    hasDiscreteYield: hasDiscreteYield,
    toJSON: toJSON
  };

});