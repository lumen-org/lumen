/**
 * This module defines the components of PQL and provides functionality to construct PQL queries.
 *
 * There is two representations of a PQL query: an 'internal' Python-Object based one, and a 'external' JSON-formatted one.
 * While the latter is meant for use with the Python compute environment, it can be turned into the JSON-format calling
 * appropiate methods. The JSON-format is for cross-compute-environment usage.
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
 * @module PQL
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

  class Filter {
    constructor (field, method, args={}) {
      if (!isField(field))
        throw TypeError("'field' must be a field");
      if (!isFilterMethod(method))
        throw RangeError("invalid method for Filter: " + method.toString());
      this.field = field;
      this.method = method;
      this.args = args;
    }

    get name() {return this.field.name;}

    toJSON() {
      return Filter.toJSON(this);
    }

    static toJSON (f) {
      return {
        name: f.name,
        operator: f.method,
        value: f.args
      };
    }
  }

  class Split {
    constructor (field, method, args={}) {
      if (!isField(field))
        throw TypeError("name must be string identifier of a field");
      if (!isSplitMethod(method))
        throw RangeError("invalid method for Split: " + method.toString());
      this.field = field;
      this.method = method;
      this.args = args;
      //get yieldName() {return field.name;},
    }

    get name() {return this.field.name;}

    get yieldDataType() {return this.field.dataType;}

    toJSON() {
      return Split.toJSON(this);
    }

    static toJSON (a) {
      return {
        name: a.name,
        split: a.method,
        args: a.args
      };
    }
  }

  class Aggregation {
    constructor(fields, method, yields, args = {}) {
      fields = utils.listify(fields);
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      if (isAggregationMethod(method))
        throw RangeError("invalid method for Aggregation: " + method);
      if (-1 == fields.map(f=>f.name).indexOf(yields))
        throw RangeError("yields is not a name of any of aggregated fields: " + yields);
      this.fields = fields;
      this.method = method;
      this.yields = yields;
      this.args = args;
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

    static toJSON (a) {
      return {
        name: a.names,
        aggregation: a.method,
        yields: a.yields,
        args: a.args
      };
    }
  }

  class Density {
    constructor(fields) {
      fields = utils.listify(fields);
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      this.fields = fields;
      this.method = DensityMethod.density;
      //get yieldDataType() {return FieldT.DataType.num;}
      this.yieldDataType = FieldT.DataType.num;
    }

    get names() {
      return this.fields.map(f=>f.name);
    }

    toJSON() {
      return Density.toJSON(this);
    }

    static toJSON(d) {
      return {
        name: d.names,
        aggregation: d.method,
        args: d.args
      };
    }
  }

  function isAggregation (obj) {
    return obj instanceof Aggregation;
    //return utils.hasProperty(obj, 'method') && isAggregationMethod(obj.method);
  }

  function isSplit (obj) {
    //return utils.hasProperty(obj, 'method') && isSplitMethod(obj.method);
    return obj instanceof Split;
  }

  function isDensity (obj) {
    //return utils.hasProperty(obj, 'method') && isDensityMethod(obj.method);
    return obj instanceof Density;
  }

  function isFilter (obj) {
    //return utils.hasProperty(obj, 'method') && isFilterMethod(obj.method);
    return obj instanceof Filter;
  }

  function isFieldUsage (fu) {
    return fu instanceof Aggregation || fu instanceof Split || fu instanceof Density ||fu instanceof Filter;
  }

  /*
   TODO: separation of concerns:
   * inteface that takes internal PQL an gives JSON PQL
     * should be implemented here
   * interface that takes JSON PQL and returns the answer in JSON
     * should be implemented in remoteModelling.js
     * maybe rename remoteModelling js as PQLModelBaseConnector
   * interface that takes internal PQL and returns the answer in python stuff
     * should be implemented in remoteModelling.js
   */

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
          if (p instanceof Field)
            return p.name;
          else if (p instanceof Aggregation || p instanceof Density)
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
        if(!model.every(_.isString)) throw new TypeError("'model' must be all strings");
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

    predict_: function (predict, from, where, as_) {
      var pql = {
        "PREDICT": predict,
        "FROM": from,
      };
      if (where)
        pql.where = where;
      if (as_)
        pql.as = as_;
      return pql;
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
    isSplit: isSplit,
    isFilter: isFilter,
    isFieldUsage: isFieldUsage,
    toJSON: toJSON
  };

});
