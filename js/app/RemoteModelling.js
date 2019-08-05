/**
 * "Remote Model" module. It allows to execute PQL queries against a remote model base and provides the response in terms
 * of a Promise to a result table.
 *
 * The interface expects JSON
 *
 * @module RemoteModel
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', './utils', './jsonUtils', './Domain', './PQL', './Model'], function (Logger, d3, utils, jsonutils, Domain, PQL, Model) {
  "use strict";

  /**
   * A ConditionTuple, SplitTuple and AggregationTuple are merely a notation that mean a dictionary/associative array,
   * as follows.
   *
   * ConditionTuple
   *  * "name": name of field to condition
   *  * "operator": operator to condition
   *  * "values": value(s) to condition on
   *
   * SplitTuple:
   *  * "name": name of field to split
   *  * "split": method to split
   *  * "args": arguments to the split, if any
   *
   *  AggregationTuple:
   *  * "name": name of field to split
   *  * "aggregation": method to split
   *  * "args": arguments to the split, if any
   */

  var logger = Logger.get('pl-RemoteModel');
  logger.setLevel(Logger.INFO);

  /** Utility function used by the other query functions to actually remotely execute a given query on the remote
   * modelbase.
   */
  function executeRemotely(jsonPQL, remoteUrl) {

    function logIt (json) {
      logger.debug("RECEIVED:");
      logger.debug(JSON.stringify(json, null, 2));
      return json;
    }

    return new Promise((resolve, reject) => {
      let jsonPQLasStr = JSON.stringify(jsonPQL)
      logger.debug("SENT:");
      logger.debug(jsonPQLasStr);
      d3.json(remoteUrl)
        .header("Content-Type", "application/json")
        .post(jsonPQLasStr, (err, json) => err ? reject(err) : resolve(logIt(json)));
    });
  }

  /** Utility function to parse a row according to expected data types 
  * Missing data in a row is indicated by an empty string.
  */
  function parseRow (row, dtypes) {
    for (let i=0; i<dtypes.length; ++i) {
      if (row[i] === '')
        row[i] = undefined;
      else {
        if (dtypes[i] === PQL.FieldT.DataType.num)
          row[i] = +row[i];
        //else if (dtypes[i] == F.FieldT.DataType.string)
        //  row[i] = row[i] // identity ...
        else if (dtypes[i] !== PQL.FieldT.DataType.string)
          throw new RangeError("invalid dataType: " + dtypes[i]);
      }
    }
    return row;
  }

  /**
   * Return the varType of the field given in its JSON representation.
   * @param {Object} json JSON representation of a {Field}, typically as received from a modelbase.
   * @returns {String}
   */
  function varType_from_fieldJSON(field) {
    if (field.hasOwnProperty('independent'))
      return (field.independent ? PQL.FieldT.VarType.independent : PQL.FieldT.VarType.distributed);
    else
      return PQL.FieldT.VarType.distributed;
  }

  /**
   * Return the varType of the field given in its JSON representation.
   * @param {Object} json JSON representation of a {Field}, typically as received from a modelbase.
   * @returns {String}
   */
  function obsType_from_fieldJSON(field) {
    if (field.hasOwnProperty('obstype'))
      return field.obstype;
    logger.warn(`missing 'obstype' in variable ${field.name}. using default value.`);
    return "observed";
  }

  /**
   * A RemoteModel is a local representation of / proxy to a remote Probability Model. It holds a local copy of the header
   * of the model, but any further data are fetched from the remote model. It provides an interface to run
   * PQL queries on this model. Note that the interface is model centric, i.e. it implicitly sets the FROM-clause of
   * the PQL query to this model.
   */
  class RemoteModel extends Model {

    /**
     * Create a local proxy for a remote model with given name located on a ModelBase server at the given url.
     * Note that the fields of this model are not synced with the model base yet after calling the constructor.
     * Use the {@link RemoteModel.update} for that.
     *
     * @param name Name for the model.
     * @param url The url that provides the model interface
     * @returns {RemoteModel}
     * @constructor
     * @alias module:RemoteModel
     */
    constructor(name, url) {
      super(name);
      if (!url || !_.isString(url)) throw RangeError("url parameter missing or not a string");
      this.url = url;
    }

    /**
     * Create RemoteModel from json and return Promise to 'updated' model.
     * @param jsonObj
     * @return {*|Promise<TResult>}
     * @constructor
     */
    static
    FromJSON (jsonObj) {
      jsonutils.assertClass(jsonObj, 'model');
      let model = new RemoteModel(jsonObj.name, jsonObj.url);
      return model.update();
    }

    /**
     * Updates the locally stored header (i.e. the fields) of the model according to the given json header data.
     * @param json JSON object containing the field information.
     */
    _updateHeader(json) {
      this.fields.clear();
      this.byIndex = [];
      for (let field of json.fields) {
        let modelField = new PQL.Field(
          field.name,
          field.dtype,
          (field.dtype === 'numerical' ? new Domain.Numeric(field.domain) : new Domain.Discrete(field.domain)),
          (field.dtype === 'numerical' ? new Domain.Numeric(field.extent) : new Domain.Discrete(field.extent)),
          varType_from_fieldJSON(field),
          obsType_from_fieldJSON(field),
          this);
        this.fields.set(field.name, modelField);
        this.byIndex.push(modelField);
      }
      this.name = json.name;
      this.empirical_model_name = json['empirical model'];  // the name of the corresponding empirical model
      return this;
    }


    /**
     * Runs the given PQL query against the model and returns a Promise to the result table.
     * @param query A PQL query.
     */
    execute(query) {
      let qtype = query.type;
      if (!qtype)
        throw RangeError("a PQL query must have a type, but has none.");
      if (qtype === 'predict')
        return this.predict(query.predict, query.where, query.splitby, query.mode, query.opts);
      if (qtype === 'model')
        return this.model(query.model, query.where, query.defaults, query.as);
      if (qtype === 'select')
        return this.select(query.select, query.where, query.opts);
      throw Error("not yet impemented");
    }

    /**
     * Syncs the local view on the model with the remote model base.
     * @returns {*|Promise.<TResult>} A promise to operation.
     */
    update() {
      let jsonPQL = PQL.toJSON.header(this.name);
      return executeRemotely(jsonPQL, this.url)
        .then(this._updateHeader.bind(this));
    }

    /**
     * Conditions one or more variables v of this model on the given domain and returns a Promise to the modified model.
     * @param conditionals A single pair, or an array of pairs. A pair is an object with at least two properties:
     *   - id: the variable of the model, and
     - range: The range or value to condition the variable on.
     * @returns {RemoteModel}
     *
     * Note: conditioning is not 'atomic' as it is equal to
     * (1) restricting a variable to the value to condition on, and
     * (2) marginalizing that variable out of the model
     */
    condition(constraints, name = this.name) {
      return this.model("*", constraints, [], name);
    }

    marginalize(what, how="remove", name=this.name) {
      what = this.asName(utils.listify(what));
      if (how === "remove")
        what =  _.without(this.names(), ...what);
      else if (how !== "keep")
        throw RangeError("invalid value for 'how': " + how);
      return this.model(what, [], [], name);
    }

    model(model, where = [], defaults = [], as_ = this.name) {
      let jsonPQL = PQL.toJSON.model(this.name, model, as_, where, defaults);
      let newModel = (as_ !== this.name ? new RemoteModel(as_, this.url) : this);
      return executeRemotely(jsonPQL, this.url)
        .then(jsonHeader => newModel._updateHeader(jsonHeader));
    }

    /**
     * @param predict {FieldUsage} A list or a single object of ({@link Aggregation}|{@link Density}|name-of-field|{@link Field})
     * @param where {FieldUsage} A list or a single object of {@link Filter}
     * @param splitBy {FieldUsage} A list or a single object of {@link Split}.
     * @returns {Array} A Table containing the predicted values. The table is row based, hence the first index is for the rows, the second for the columns. Moreover the table has a self-explanatory attribute '.header'.
     */
    predict(predict, where = [], splitBy = [] /*, returnBasemodel=false*/, mode = 'model', opts=undefined) {
      [predict, where, splitBy] = utils.listify(predict, where, splitBy);
      var jsonContent = PQL.toJSON.predict(this.name, predict, where, splitBy, opts);

      // list of datatypes of fields to predict - needed to parse returned csv-string correctly
      let dtypes = [];
      for (let p of predict)
        if (_.isString(p))
          dtypes.push(this.fields.get(p).dataType);
        else if (PQL.isField(p))
          dtypes.push(p.dataType);
        else if (PQL.isAggregation(p) || PQL.isDensity(p) || PQL.isSplit(p))
          dtypes.push(p.yieldDataType);
        else 
          throw new RangeError("unhandled case");

      // bind dtypes to parserows as needed
      let myparserows = row => parseRow(row, dtypes);

      return executeRemotely(jsonContent, this.url)
        .then( jsonData => {
          let data = d3.csv.parseRows(jsonData.data, myparserows);
          data.header = jsonData.header;
          return data;
        });
    }

    select (select, where=undefined, opts=undefined) {
      select = utils.listify(select);
      let jsonContent = PQL.toJSON.select(this.name, select, where, opts);

      // list of datatypes of fields to predict - needed to parse returned csv-string correctly
      let dtypes = select.map( s => this.fields.get(s).dataType );

      // bind dtypes to parserows as needed
      let myparserows = row => parseRow(row, dtypes);

      return executeRemotely(jsonContent, this.url)
        .then( jsonData => {
          let data = d3.csv.parseRows(jsonData.data, myparserows);
          data.header = jsonData.header;
          return data;
        });
    }

    /**
     * Return all observed fields of this model in order.
     * @returns {T[]}
     */
    get observedFields() {
      return this.byIndex.filter(f => f.obsType === "observed");
    }

    /**
     * Creates remotely a copy of this model with a given name.
     * @param {string} [name] - the name of the clone of this model.
     * TODO: there is a strange dependency in the code: copied models are expected to share the same {@link Field} (identical in terms of the === operator). However, when the same model is loaded twice, e.g. by creating two instances of RemoteModel this will not (and can not easily) be the case. The problem is in Model.isField.
     * @returns {Promise} A promise to a copy of this model.
     */
    copy(name) {
      let myClone;
      let that = this;
      let jsonPQL = PQL.toJSON.copy(this.name, name);
      return executeRemotely(jsonPQL, this.url)
        .then(() => {
          myClone = new RemoteModel(name, that.url);
          myClone.fields = new Map(that.fields);
          myClone.byIndex = [...that.byIndex];
          return myClone;
        });
    }

    pciGraph_get() {
      let query = {
        'FROM': this.name,
        'PCI_GRAPH.GET': true,
      };
      return executeRemotely(query, this.url)
        .then(jsonData => {
          if (jsonData.model !== this.name)
            throw RangeError("Received PCI Graph of wrong model: {1}  instead of  {2}".format(jsonData.model, this.name))
          this.pciGraph = jsonData.graph;
          return jsonData.graph;
        });
    }

    /**
     * Returns a copy of this object. This does not actually copy any model on the remote host.
     * It simply copies the local object and does not run any remote queries at all.
     */
    localCopy() {
      let clone = new RemoteModel(this.name, this.url);
      for (let [key, value] of this.fields.entries()) {
        clone.fields.set(key, value.copy());
      }
      clone.byIndex = this.byIndex.map(f => f.copy());
      return clone;
    }
  }

  /**
   * A RemoteModelBase is a proxy to/ a local representation of a remote ModelBase. To run queries you can either use
   * the specialized methods 'listModels', 'get', 'drop', ... or the generic 'execute'-method to sent arbitrary PQL
   * queries.
   */
  class RemoteModelBase {

    constructor(url) {
      if (!_.isString(url)) throw new RangeError("url ist not a String");
      this.url = url;
    }

    /**
     * Raw JSON interface to remote modelbase. Returns a promise to the answer of the server.
     * @param jsonContent
     * @returns {Promise}
     */
    execute(jsonContent) {
      return executeRemotely(jsonContent, this.url);
    }

    listModels() {
      return this.execute(PQL.toJSON.models());
    }

    /**
     * Returns a promise to a {@param RemoteModel} with given name that is fetched from the remote ModelBase.
     * @param modelName
     */
    get(modelName) {
      var model = new RemoteModel(modelName, this.url);
      return model.update();
    }

    drop(modelName) {
      return this.execute(PQL.toJSON.drop(modelName));
    }

    header (modelName) {
      return this.execute(PQL.toJSON.header(modelName));
    }

    /**
     * Reloads given models on the model base.
     * Returns a promise to the execution.
     * @param models Single model to reload, a list of models to reload from model source or "*". Defaults to "*".
     *  TODO: currently only "*" is implemented.
     */
    reload (models="*") {
      if (models !== '*')
        throw "not implemented";
      return this.execute({'RELOAD': models});
    }

  }

  return {
    ModelBase: RemoteModelBase,
    Model: RemoteModel
  };

});