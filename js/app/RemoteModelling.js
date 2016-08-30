/**
 * "Remote Model" module.
 *
 * @module RemoteModel
 * @author Philipp Lucas
 */

define(['lib/logger', 'lib/d3', './utils', './Domain', './Field', './Model'], function (Logger, d3, utils, Domain, F, Model) {
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
  logger.setLevel(Logger.DEBUG);

  /** Utility function used by the other query functions to actually remotely execute a query */
  function executeRemotely(jsonContent, remoteUrl) {

    function logit (json) {
      logger.debug("RECEIVED:");
      logger.debug(JSON.stringify(json));
      logger.debug(json);
      return json;
    }

    return new Promise((resolve, reject) => {
      logger.debug("SENT:");
      logger.debug(JSON.stringify(jsonContent));
      logger.debug(jsonContent);
      d3.json(remoteUrl)
        .header("Content-Type", "application/json")
        .post(JSON.stringify(jsonContent), (err, json) => err ? reject(err) : resolve(logit(json)));
    });
  }

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
      if (!url) throw "url parameter missing";
      this.url = url;
    }

    /**
     * Updates the locally stored header (i.e. the fields) of the model according to the given json header data.
     * @param json JSON object containing the field information.
     */
    _updateHeader(json) {
      this.fields.clear();
      for (let field of json.fields) {
        this.fields.push(
          new F.Field(field.name, this, {
            dataType: field.dtype,
            domain: (field.dtype === 'numerical' ? new Domain.SimpleNumericContinuous(...field.domain) : new Domain.Discrete(field.domain)),
            kind: (field.dtype === 'numerical' ? F.FieldT.Kind.cont : F.FieldT.Kind.discrete),
            role: (field.dtype === 'numerical' ? F.FieldT.Role.measure : F.FieldT.Role.dimension)
          })
        );
      }
      this.name = json.name;
      return this;
    }

    /**
     * Syncs the local view on the model with the remote model base.
     * @returns {*|Promise.<TResult>} A promise to operation.
     */
    update() {
      var content = {
        "SHOW": "HEADER",
        "FROM": this.name
      };
      return executeRemotely(content, this.url)
        .then(this._updateHeader.bind(this));
    }


    /**
     * Returns an aggregation on the fieldToAggregate with the ids conditioned to their corresponding values. Does not modify the model.
     * @param ids
     * @param values
     * @param fieldToAggregate
     */
    aggregate(ids, values, fieldToAggregate) {
      let names = this.asName(ids);
      var content = {
        "PREDICT": [{
          "name": fieldToAggregate.name,
          "aggregation": fieldToAggregate.aggr
        }],
        "FROM": this.name,
        "WHERE": _.zip(names, values)
          .map(pair => {
            return {"name": pair[0], "operator": "equals", "value": pair[1]};
          })
      };
      return executeRemotely(content, this.url);
    }

    /**
     * Conditions one or more variables   v of this model on the given domain and returns a Promise to the modified model.
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
      if (how == "remove")
        what =  _.without(this.asName(this.fields), ...what);
      return this.model(what, [], name);
    }

    /**
     *
     * @param predict A list of 'predict-tuples'. See top for documentation.
     * @param where A list of 'condition-tuples'. See top for documentation.
     * @param splitBy A list of 'split-tuples'. See top for documentation.
     * @returns {Array} table containing the predicted values. The table is row based, hence the first index is for the rows, the second for the columns. Moreover the table has a self-explanatory attribute '.header'.
     */
    predict(predict, where = [], splitBy = [] /*, returnBasemodel=false*/) {
      [predict, where, splitBy] = utils.listify(predict, where, splitBy);
      var jsonContent = {
        "PREDICT": predict,
        "FROM": this.name,
        "WHERE": where,
        "SPLIT BY": splitBy
      };

      console.log("SPLITBY:\n");
      console.log(splitBy);

      // list of datatypes of fields to predict - needed to parse returned csv-string correctly
      let len = predict.length;
      let dtypes = [];
      for (let p of predict)
        if (typeof p === 'string')
          dtypes.push(this.asField(p));
        else
          dtypes.push(...utils.listify(this.asField(p.name)));
      dtypes = dtypes.map(field => field.dataType);

      // function to parse a row according to expected data types
      let parseRow = function (row) {
        for (let i=0; i<len; ++i) {
          if (dtypes[i] == F.FieldT.Type.num)
            row[i] = +row[i];
          else if (dtypes[i] != F.FieldT.Type.string)
              throw new RangeError("invalid dataType");
          //else if (dtypes[i] == F.FieldT.Type.string)
          //  row[i] = row[i]
        }
        return row;
      };

      return executeRemotely(jsonContent, this.url)
        .then( jsonData => {
          let table = d3.csv.parseRows(jsonData.data, parseRow);
          table.header = jsonData.header;
          return table;
        });
    }

    model(model, where = [], name = this.name) {
      where = utils.listify(where);
      if (model != "*")
        model = utils.listify(model);
      var jsonContent = {
        "MODEL": model,
        "FROM": this.name,
        "WHERE": where,
        "AS": name
      };
      var newModel = (name !== this.name ? new RemoteModel(name, this.url) : this);
      return executeRemotely(jsonContent, this.url)
        .then( jsonHeader => newModel._updateHeader(jsonHeader));
    }

    /**
     * @param {string} [name] - the name of the clone of this model.
     * TODO: there is a strange dependency in the code: copied models are expected to share the same {@link Field} (identical in terms of the === operator). However, when the same model is loaded twice, e.g. by creating two instances of RemoteModel this will not (and can not easily) be the base. The problem is in Model.isField.
     * @returns {Promise} A promise to a copy of this model.
     */
    // TODO 2016-07-04 - implement for remote models
    copy(name) {
      if (!name) throw "you must specify a name for the cloned model";
      var myClone = [];
      var that = this;
      var content = {
        "MODEL": "*",
        "FROM": this.name,
        "AS": name
      };
      return executeRemotely(content, this.url)
        .then(() => {
          myClone = new RemoteModel(name, that.url);
          myClone.fields = that.fields.slice();
          return myClone;
        });
    }
  }


  class RemoteModelBase {

    constructor(url) {
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
      var content = {
        "SHOW": "MODELS"
      };
      return this.execute(content);
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
      var content = {
        "DROP": modelName
      };
      return this.execute(content);
    }

    header (modelName) {
      var content = {
        "SHOW": "HEADER",
        "FROM": modelName
      };
      return this.execute(content);
    }

  }

  return {
    ModelBase: RemoteModelBase,
    Model: RemoteModel
  };

});