/**
 * "Remote Model" module. It allows to execute PQL queries against a remote model base and receive the response in terms
 * of a Promise.
 *
 * The interface expects JSON
 *
 * @module RemoteModel
 * @author Philipp Lucas
 */

define(['lib/logger', 'd3', './utils', './Domain', './PQL', './Model'], function (Logger, d3, utils, Domain, PQL, Model) {
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
      logger.debug(json);
      return json;
    }

    return new Promise((resolve, reject) => {
      logger.debug("SENT:");
      logger.debug(JSON.stringify(jsonPQL));
      logger.debug(jsonPQL);
      d3.json(remoteUrl)
        .header("Content-Type", "application/json")
        .post(JSON.stringify(jsonPQL), (err, json) => err ? reject(err) : resolve(logIt(json)));
    });
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
     * Updates the locally stored header (i.e. the fields) of the model according to the given json header data.
     * @param json JSON object containing the field information.
     */
    _updateHeader(json) {
      this.fields.clear();
      for (let field of json.fields) {
        this.fields.set(field.name, new PQL.Field(
            field.name,
            field.dtype,
            (field.dtype === 'numerical' ? new Domain.Numeric(field.domain) : new Domain.Discrete(field.domain)),
            (field.dtype === 'numerical' ? new Domain.Numeric(field.extent) : new Domain.Discrete(field.extent)),
            this));
      }
      this.name = json.name;
      return this;
    }

    /**
     * Syncs the local view on the model with the remote model base.
     * @returns {*|Promise.<TResult>} A promise to operation.
     */
    update() {
      var jsonPQL = PQL.toJSON.header(this.name);
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
      return this.model("*", constraints, name);
    }

    marginalize(what, how="remove", name=this.name) {
      what = this.asName(utils.listify(what));
      if (how === "remove")
        what =  _.without(this.names(), ...what);
      else if (how !== "keep")
        throw RangeError("invalid value for 'how': " + how);
      return this.model(what, [], name);
    }

    model(model, where = [], as_ = this.name) {
      var jsonPQL = PQL.toJSON.model(this.name, model, as_, where);
      var newModel = (as_ !== this.name ? new RemoteModel(as_, this.url) : this);
      return executeRemotely(jsonPQL, this.url)
        .then(jsonHeader => newModel._updateHeader(jsonHeader));
    }

    /**
     * @param predict {FieldUsage} A list or a single object of ({@link Aggregation}|{@link Density}|name-of-field|{@link Field})
     * @param where {FieldUsage} A list or a single object of {@link Filter}
     * @param splitBy {FieldUsage} A list or a single object of {@link Split}.
     * @returns {Array} A Table containing the predicted values. The table is row based, hence the first index is for the rows, the second for the columns. Moreover the table has a self-explanatory attribute '.header'.
     */
    predict(predict, where = [], splitBy = [] /*, returnBasemodel=false*/) {
      [predict, where, splitBy] = utils.listify(predict, where, splitBy);
      var jsonContent = PQL.toJSON.predict(this.name, predict, where, splitBy);

      // list of datatypes of fields to predict - needed to parse returned csv-string correctly
      let len = predict.length;
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

      // function to parse a row according to expected data types
      function parseRow (row) {
        for (let i=0; i<len; ++i) {
          if (dtypes[i] === PQL.FieldT.DataType.num)
            row[i] = +row[i];
          //else if (dtypes[i] == F.FieldT.DataType.string)
          //  row[i] = row[i]
          else if (dtypes[i] !== PQL.FieldT.DataType.string)
              throw new RangeError("invalid dataType: " + dtypes[i]);
        }
        return row;
      }

      return executeRemotely(jsonContent, this.url)
        .then( jsonData => {
          let table = d3.csv.parseRows(jsonData.data, parseRow);
          table.header = jsonData.header;
          return table;
        });
    }

    /**
     * @param {string} [name] - the name of the clone of this model.
     * TODO: there is a strange dependency in the code: copied models are expected to share the same {@link Field} (identical in terms of the === operator). However, when the same model is loaded twice, e.g. by creating two instances of RemoteModel this will not (and can not easily) be the base. The problem is in Model.isField.
     * @returns {Promise} A promise to a copy of this model.
     */
    copy(name) {
      var myClone;
      var that = this;
      var jsonPQL = PQL.toJSON.copy(this.name, name);
      return executeRemotely(jsonPQL, this.url)
        .then(() => {
          myClone = new RemoteModel(name, that.url);
          myClone.fields = new Map(that.fields);
          return myClone;
        });
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

  }

  return {
    ModelBase: RemoteModelBase,
    Model: RemoteModel
  };

});