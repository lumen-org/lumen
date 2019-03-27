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
 * Essentially FieldUsages represent an usage of (multiple) Fields of a model.
 *
 *  They also can be converted to suitable 'JSON formatted' PQL symbols by calling {*}toJSON , i.e. a Split becomes a SplitTuple,
 *  an Aggregation becomes an AggregationTuple, etc.
 *  The so created 'JSON' can be serialized into a string using the core modele JSON.stringify function.
 *
 * @author Philipp Lucas
 * @copyright © 2016-2019 Philipp Lucas (philipp.lucas@uni-jena.de, philipp.lucas@dlr.de)
 * @module PQL
 */

/**
 * The following is the internal PQL query structure:
 *
 * * A PQL query is a object (i.e. of type Object!) that has at least a property "type", with one of the following values:
 *   'predict', 'select', 'model', 'header', 'copy', 'drop'
 *
 * Depending on the value of "type" it may have more properties, which in turn contain FieldUsages, Fields or names of fields, as appropriate:
 *
 * Predictions, i.e. type === 'predict':
 *    predict
 *    splitby
 *    where
 *    mode
 *
 * Selections, i.e. type === 'select':
 *   select
 *   where
 *   mode
 *
 * Modelling, i.e. type === 'model':
 *   model
 *   where
 *   as
 *
 */

define(['lib/emitter', 'lib/logger', './Domain', './utils', './ViewSettings'], function (Emitter, Logger, domain, utils, config) {
  "use strict";

  var logger = Logger.get('pl-PQL');
  logger.setLevel(Logger.DEBUG);


  function getFieldFromModel(name, model) {
    let field = model.fields.get(jsonObj.name);
    if (field === undefined)
      throw `field with name ${jsonObj.name} is not in model.`;
  }


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

   * @alias module:Field.Field
   */
  class Field {

    /**
     *
     * @param name {String} The name of the Field
     * @param dataType {String} The desired data type. Either 'string' or 'numerical'. For convinience use FieldT
     * @param domain {Domain} The domain of the Field, i.e. the values it may take
     * @param extent {Domain} A finite range/set of values, that it typical.
     * @param model {Model} Optional. The model this field belongs to.
     */
    constructor (name, dataType, domain, extent, model=undefined) {
      if (!_.isString(name)) throw TypeError("name must be a string, but is: " + name.toString());
      if (!_.contains(FieldT.DataType, dataType)) throw RangeError("invalid dataType: " + dataType.toString());
      if (extent.isUnbounded()) throw RangeError("extent may not be unbounded.");

      this.name = name;
      this.dataType = dataType;
      this.domain = domain;
      this.extent = extent;
      this.model = model;
      Emitter(this);
    }

    toString() {
      let desc = "'" + this.name + "' (" + this.dataType + ') ';
      if (this.dataType === FieldT.DataType.num)
        desc += " domain = " + this.domain;
      return desc;
    }

    isDiscrete() {
      return (this.dataType === FieldT.DataType.string);
    }

    copy () {
      return new Field(this.name, this.dataType, this.domain.copy(), this.extent.copy(), this.model);
    }

    toJSON () {
      return utils.jsonRemoveEmptyElements({
        class: 'Field',
        name: this.name,
        dataType: this.dataType,
        model: this.model.name,
      });
    }

    static
    fromJSON (jsonObj, model) {
      if (jsonObj.class !== 'Field')
        throw `json object is not a Field, as it's 'class' attribute has value ${jsonObj.class}`;

      if (jsonObj.model !== model.name)
        throw "name of model of field in JSON and of reference model do not match.";

      field = getFieldFromModel(jsonObj.name, model);

      if (field.dataType !== jsonObj.dataType)
        throw  `data types of field in json (${jsonObj.dataType}) and model (${field.dataType}) do not match.`;

      return field;
    }

  }

  function isField (obj) {
    return obj ? obj instanceof Field : false;
  }

  let SplitMethod = Object.freeze({
    equidist: 'equidist',
    identity: 'identity',
    elements: 'elements',
    equiinterval: 'equiinterval',
    data: 'data'
  });
  let isSplitMethod = (m) => utils.hasValue(SplitMethod, m);

  let AggregationMethods = Object.freeze({
    argmax: 'maximum',
    argavg: 'average'
  });
  let isAggregationMethod = (m) => (m === AggregationMethods.argavg || m === AggregationMethods.argmax);

  let DensityMethodT = Object.freeze({
    density: 'density',
    probability: 'probability'
  });
  let isDensityMethod = (m) => m === DensityMethodT.density;

  let FilterMethodT = Object.freeze({
    equals: 'equals',
    in: 'in'
  });
  let isFilterMethod = (m) => m === FilterMethodT.equals || m === FilterMethodT.in;


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

    /**
     * Sets a new domain to filter on.
     * @param newDomain
     */
    setDomain (newDomain) {
      // OLD: need to convert method?
      // if (this.method == FilterMethodT.in && newDomain.isSingular())
      //   this.method = FilterMethodT.equals;
      // else if (this.method == FilterMethodT.equals && !newDomain.isSingular())
      //   this.method = FilterMethodT.in;
      this.args = newDomain;
    }

    static DefaultFilter (field) {
      let extent = field.extent;
      let method = extent.isSingular() ? FilterMethodT.equals : FilterMethodT.in;
      return new Filter(field, method, extent);
    }

    get name() {return this.field.name;}

    toJSON() {
      return Filter.toJSON(this);
    }

    static toJSON (f) {
      return utils.jsonRemoveEmptyElements({
        name: f.name,
        operator: f.method,
        value: f.args.values,
        class: 'Filter',
      });
    }

    static
    FromJSON (jsonObj, model) {
      if (jsonObj.class !== 'Filter')
        throw `json object is not a Filter, as its 'class' attribute has value ${jsonObj.class}`;
      let field = getFieldFromModel(jsonObj.name, model);
      return new Filter(field, jsonObj.operator, jsonObj.value);
    }

    toString() {
      return "FILTER: " + this.field.name + " " + this.method + " " + this.args;
    }

    /**
     * Apply the filter
     * , i.e. restrict the domain of the field stored in the filter as specified by the filter.
     */
    apply () {
      let newDomain;
      if (this.method == FilterMethodT.in || this.method == FilterMethodT.equals)
        newDomain = this.field.domain.intersection(this.args);
      // else if (this.method = FilterMethodT.equals)
      //   newDomain = this.field.domain;
      else
        throw Error("not implemented yet. PQL.js line ~170"); // TODO: implement more methods
      this.field.domain = newDomain;
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

    get yieldField() {return this.field;}

    get yields() {return this.field.name;}

    toJSON() {
      return Split.toJSON(this);
    }

    toString() {
      return "SPLIT " + this.method  + " of " + this.field.name + " with args:" + " " + this.args;
    }

    copy () {
      return new Split(this.field.copy(), this.method, this.args);
    }

    static FromFieldUsage (fu, mode = "layout") {
      if (isSplit(fu) || isFilter(fu))
        return Split.DefaultSplit(fu.field, mode);
      else if (isAggregation(fu) || isDensity(fu))
        return Split.DefaultSplit(fu.fields[0], mode);
      else
        throw new TypeError("fu is not a FieldUsage");
    }

    /**
     * Returns a split with decent values for the chose usage mode.
     * The defaults of the modes are as follows:
     *   * aggregations and density: split to elements or 25 equiintervals
     *   * layout: split to elements or 5 equiintervals
     * @param field
     * @param mode Optional. One of: 'aggregation', 'density', 'layout'
     * @returns {Split}
     * @constructor
     */
    static
    DefaultSplit (field, mode = "layout") {
      // TODO: move to settings.
      let split_cnt = config.tweaks.splitCnts[mode];
      if (field.dataType === FieldT.DataType.string)
        return new Split(field, SplitMethod.elements, []);
      else if (field.dataType === FieldT.DataType.num)
          return new Split(field, SplitMethod.equiinterval, [split_cnt]);
      else
        throw new RangeError("invalid data type");
    }

    static
    toJSON (a) {
      return utils.jsonRemoveEmptyElements({
        name: a.name,
        split: a.method,
        args: a.args,
        class: 'Split',
      });
    }

    static
    FromJSON (jsonObj, model) {
      if (jsonObj.class !== 'Split')
        throw `json object is not a Split, as its 'class' attribute has value ${jsonObj.class}`;
      let field = getFieldFromModel(jsonObj.name, model);
      return new Split(field, jsonObj.split, jsonObj.args);
    }
  }

  class Aggregation extends FieldUsage {
    constructor(fields, method, yields, args = []) {
      super();
      fields = _.sortBy(utils.listify(fields), 'name');
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      if (!isAggregationMethod(method))
        throw RangeError("invalid method for Aggregation: " + method);
      if (-1 == fields.map(f=>f.name).indexOf(yields))
        throw RangeError("yields is not a name of any field: " + yields);
      this.fields = fields;
      this.method = method;
      this.yields = yields;
      this.args = args;
    }

    static
    DefaultAggregation (fields) {
      fields = utils.listify(fields);
      return new Aggregation(fields, AggregationMethods.argmax, fields[0].name);
    }

    static
    FromFieldUsage (fu) {
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
      return this.yieldField.dataType;
    }

    get yieldField() {
      return _.find(this.fields, f => f.name === this.yields);
    }

    toJSON() {
      return Aggregation.toJSON(this);
    }

    copy () {
      return new Aggregation(this.fields.map(field => field.copy()), this.method, this.yields, this.args);
    }

    static
    FromJSON (jsonObj, model) {
      if (jsonObj.class !== 'Aggregation')
        throw `json object is not a Aggregation, as its 'class' attribute has value ${jsonObj.class}`;
      let fields = jsonObj.name.map( name => getFieldFromModel(name, model));
      return new Aggregation(fields, jsonObj.aggregation, jsonObj.yields, jsonObj.args);
    }

    static
    toJSON (a) {
      return utils.jsonRemoveEmptyElements({
        name: a.names.sort(),
        aggregation: a.method,
        yields: a.yields,
        args: a.args,
        class: 'Aggregation',
      });
    }

    toString () {
      return this.method  + " of [" + this.names.sort() + "] with args: [" + this.args + "]";
    }
  }

  class Density extends FieldUsage {
    constructor(fields, method=DensityMethodT.density) {
      super();
      fields = _.sortBy(utils.listify(fields), 'name');
      if (!fields.every(isField))
        throw TypeError("fields must be a single or an array of fields");
      this.fields = fields;
      this.method = method;
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

    static
    toJSON(d) {
      return utils.jsonRemoveEmptyElements({
        name: d.names.sort(),
        aggregation: d.method,
        args: d.args,
        class: 'Density',
      });
    }

    static
    FromJSON (jsonObj, model) {
      if (jsonObj.class !== 'Density')
        throw `json object is not a Density, as its 'class' attribute has value ${jsonObj.class}`;
      let fields = jsonObj.name.map( name => getFieldFromModel(name, model));
      return new Density(fields, jsonObj.aggregation);
    }

    static
    FromFieldUsage (fu) {
      if (isSplit(fu) || isFilter(fu))
        return new Density(fu.field);
      else if (isAggregation(fu) || isDensity(fu))
        return new Density(fu.fields);
      else
        throw new TypeError("fu is not a FieldUsage");
    }

    toString () {
      return this.method  + " of [" + this.names.sort() + "]";
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

  function hasNumericYield(fu) {
    return fu.yieldDataType === FieldT.DataType.num;
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
   * Returns a subset of the given FieldUsages in fus.
   * This method is stable, i.e. the order of FieldUsages in fus is maintained.
   *
   * @param fus
   * @return {Array}
   * @private
   */
  function cleanFieldUsages(fus) {

    // there may be no two Splits on the same Field. Exception: one has split method 'identity'
    let cleanedFus = [],
      usedSplits = new Map();

    for (let fu of fus) {
      if (isSplit(fu) && (fu.method !== SplitMethod.identity)) {
        let name = fu.field.name,
          used = usedSplits.get(name);
        if (used == undefined) {
          usedSplits.set(name, fu);
          cleanedFus.push(fu);
        }
        else {
          // TODO: I'm not entirely sure if this is a sane way of dealing with the underlying problem...
          // TODO: no it's not. Instead the two identical splits should actually be the same...
          // Problem is, for example: if we change the split count in one - which one will be used?
          if (used.method !== fu.method) {
            // turn into identity split if methods equal the one saved
            throw ConversionError("Conflicting splits of the same field, i.e. splits with unequal")
          }
          // else {
          //   same method. simply remove it from the field usages, i.e. don't push it to cleanedFus
          // }
        }
      } else {
        cleanedFus.push(fu);
      }
    }

    // TODO: more checks for correctness of query

    return cleanedFus;
  }


  /**
   * PQL: create JSON-formatted queries from internal-format
   */
  let toJSON = {
    /**
     * @param from {String} The name of the modle to predict from.
     * @param predict  A list or a single object of ({@link Aggregation}|{@link Density}|name-of-field|{@link Field})
     * @param where A list or a single object of {@link Filter}
     * @param splitBy A list or a single object of {@link Split}.
     * @returns {Object} A Table containing the predicted values. The table is row based, hence the first index is for the rows, the second for the columns. Moreover the table has a self-explanatory attribute '.header'.
     */
    predict: function (from, predict, where = [], splitBy = [] /*, returnBasemodel=false*/) {
      let json = {};

      [predict, where, splitBy] = utils.listify(predict, where, splitBy);

      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      json.FROM = from;

      if (!where.every(isFilter)) throw new TypeError("'where' must be all of type Filter.");
      if (where.length > 0)
        json.WHERE = where.map(Filter.toJSON);

      if (!splitBy.every(isSplit)) throw new TypeError("'splitby' must be all of type Split.");
      if (splitBy.length > 0)
        json["SPLIT BY"] = splitBy.map(Split.toJSON);

      predict = predict.map(p => {
        if (_.isString(p)) // its just the name of a field then
          return p;
        if (isField(p) || isSplit(p))
          return p.name;
        else if (isAggregation(p) || isDensity(p))
          return p.toJSON();
        else
          throw new TypeError("'predict' must be all of type Aggregation, Density or string.");
      });
      json.PREDICT = predict;
      return json;
    },

    select: function (from, select, where=undefined, opts=undefined) {
      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      if (!select.every(_.isString)) throw new TypeError("'select' must be all of type string.");

      let jsonQuery =  {
        "SELECT": select,
        "FROM": from
      };

      if (where !== undefined) {
        where = utils.listify(where);
        if (!where.every(isFilter))
          throw new TypeError("'where' must be all of type Filter.");
        jsonQuery.WHERE = where.map(Filter.toJSON);
      }

      if (opts !== undefined)
        jsonQuery.OPTS = opts;

      return jsonQuery;
    },

    model: function (from, model, as_, where = [], defaults = []) {
      let json = {};

      if (!_.isString(from)) throw new TypeError("'from' must be of type String");
      json.FROM = from;

      if (model !== "*") {
        model = utils.listify(model);
        if(!model.every( o => isField(o) || _.isString(o) )) throw new TypeError("'model' must be all strings or fields");
        model = model.map( o => isField(o) ? o.name : o);
      }
      json.MODEL = model;

      where = utils.listify(where);
      if(!where.every(isFilter)) throw new TypeError("'where' must be all filters.");
      if (where.length > 0)
        json.WHERE = where.map(Filter.toJSON);

      if(!_.isString(as_)) throw new TypeError("'name' must be a string");
      if (as_.length > 0)
        json.AS = as_;

      // get default values and subsets
      let default_values = {}, any_default_values = false,
        default_subsets = {}, any_default_subsets = false;
      for (let {field: {name: name}, method: op, args: domain} of defaults) {
        // let domain = d.args,
        //   op = d.method,
        //   name = d.field.name;
        if (op === FilterMethodT.equals) {
          default_values[name] = domain.value;
          any_default_values = true;
        } else if (op === FilterMethodT.in) {
          default_subsets[name] = domain.values;
          any_default_subsets = true;
        } else
            throw RangeError("Invalid filter operator: " + op.toString());
        //
        // if (domain.isSingular()) {
        //   default_values[name] = domain.value;
        //   any_default_values = true;
        // }
        // else {
        //   default_subsets[name] = domain.values;
        //   any_default_subsets = true;
        // }
      }

      if (any_default_values)
        json["DEFAULT_VALUE"] = default_values;

      if (any_default_subsets)
        json["DEFAULT_SUBSET"] = default_subsets;

      return json;
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

  /**
   * Returns concise string representation of the query.
   *
   * It is not clear how to do this in a good way. Here we chose to make it as concise as possible, while loosing
   * some precision. Concretely, we omit all the covariates that occur as a column in the result table.
   *
   * E.g.:
   *    predict: sex, p(sex), splitby: sex, from: <mymodel>
   * yields
   *    p(sex)
   * instead of:
   *   sex, p(sex)
   *
   * @param query
   */
  function toString (query) {
    // TODO: implement more: // 'predict', 'select', 'model', 'header', 'copy', 'drop'
    switch (query.type) {
      case 'predict':

        // return "fff";

        let splits = _.unique((query.predict ? query.predict : []).filter(isSplit).map(s => s.name)), // names of unique splits or []
          filters = _.unique((query.where ? query.where : []).map(s => s.name)), // names of unique filters or []
          variates = [];
        for (let variate of query.predict) {
          let str = undefined;
          if (isAggregation(variate)) {
            if (variate.names.length > 1)
              logger.warn("aggregation.toString string is imprecise because it aggregates over multiple variables.");
            let conditionPart = (splits.length + filters.length === 0) ? "" : ("|" + splits.concat(filters).join());
            str = "m(" + variate.yields + conditionPart + ")";
            variates.push(str);
          } else if (isDensity(variate)) {
            let conditionPart = filters.length === 0 ? "" : ("|" + filters.join());
            str = "p(" + variate.names + conditionPart + ")";
            variates.push(str);
          }
        }
        return variates.join();
      default:
        throw "Not Implemented";
    }
  }



  return {
    Field: Field,
    FieldT: FieldT,
    isField: isField,
    Aggregation: Aggregation,
    AggrMethod: AggregationMethods,
    Density: Density,
    DensityMethod: DensityMethodT,
    Split: Split,
    SplitMethod: SplitMethod,
    Filter: Filter,
    FilterMethodT: FilterMethodT,
    isAggregation: isAggregation,
    isDensity: isDensity,
    isAggregationOrDensity: isAggregationOrDensity,
    isSplit: isSplit,
    isFilter: isFilter,
    isFieldUsage: isFieldUsage,
    fields: fields,
    hasDiscreteYield: hasDiscreteYield,
    hasNumericYield: hasNumericYield,
    cleanFieldUsages,
    toJSON: toJSON,
    toString: toString,
  };

});