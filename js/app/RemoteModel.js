/**
 * "Remote Model" module.
 *
 * @module RemoteModel
 * @author Philipp Lucas
 */

define(['lib/logger', './Domain', './Field', './Model'], function (Logger, Domain, F, Model) {
  "use strict";


  var logger = Logger.get('pl-RemoteModel');
  logger.setLevel(Logger.WARN);


  /**
   * Collection of asynchronous query functions. They all return a Promise.
   */
  var Query = {

    /** Utility function used by the other query functions in the collection to actually excecute a query */
    _queryWithPromise: function (remoteUrl, jsonContent) {
      return new Promise((resolve, reject) => {
        d3.json(remoteUrl)
          .header("Content-Type", "application/json")
          .post(JSON.stringify(jsonContent), (err, json) => err ? reject(err) : resolve(json));
      });
    },

    showHeader: function (remoteUrl, modelName) {
      var content = {
        "SHOW": "HEADER",
        "FROM": modelName
      };
      return Query._queryWithPromise(remoteUrl, content)
        .then((json) => json.result); // extracts data only on success
    },

    marginalizeModel: function (remoteUrl, modelName, keep) {
      var content = {
        "MODEL": keep.map( name => {return {"name": name}; }),
        "FROM": modelName,
        "AS": modelName
      };
      return Query._queryWithPromise(remoteUrl, content)
        .then((json) => json.result);
    },

    aggregateModel: function (remoteUrl, modelName, fieldToAggregate, names, values) {
      var content = {
        "PREDICT": [{
          "name": fieldToAggregate.name,
          "aggregation": fieldToAggregate.aggr
        }],
        "FROM": modelName,
        "WHERE": _.zip(names, values)
          .map( pair => {return {"name":pair[0], "operator":"EQUALS", "value":pair[1]};} )
      };
      return Query._queryWithPromise(remoteUrl, content)
        .then((json) => json.result);
    },

    clone: function (remoteUrl, modelName, asName) {
      var content = {
        "MODEL": "*",
        "FROM": modelName,
        "AS": asName
      };
      return Query._queryWithPromise(remoteUrl, content)
        .then((json) => json.result);
    }
  };


  class RemoteModel extends Model {

    /**
     * Create a local proxy for a remote model with given name located on a ModelBase server at the given url.
     * Note that the fields of this model are not populated yet after calling the constructor. Use the promise provided by {@link RemoteModel.populate} for that.
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
     * Returns a promise that fulfils if the model fields are fetched from the remote ModelBase server, and rejects otherwise
     */
    populate () {
      return Query.showHeader(this.url, this.name)
        .then( this._populateFromHeader.bind(this) );
    }

    /**
     * Populates the fields of this model using the JSON object provided.
     * @param error Error information. If false there was no error.
     * @param json JSON object containing the field information.
     */
    _populateFromHeader (json) {
      for (let field of json) {
        this.fields.push(
          new F.Field( field.name, this, {
            dataType: field.dtype,
            domain: (field.dtype === 'numerical' ? new Domain.SimpleNumericContinuous(...field.domain) : new Domain.Discrete(field.domain)),
            kind: (field.dtype === 'numerical' ? F.FieldT.Kind.cont : F.FieldT.Kind.discrete),
            role: (field.dtype === 'numerical' ? F.FieldT.Role.measure: F.FieldT.Role.dimension)
          })
        );
      }
    }

    /**
     * Marginalizes variables out of this model and returns a promise of the modified model.
     * @param ids A single field or an array of variables of this model, each specified either by their name or their index.
     * @param how If how === 'remove', the given variables are marginalized. If how === 'keep' the given variables are kept, and all other variables of the models are marginalized.
     * @returns {RemoteModel}
     */
    // TODO 2016-07-04 - test this!
   marginalize(ids, how = 'remove') {
      if (!Array.isArray(ids)) ids = [ids];
      ids = this._asName(ids);

      // find random variables to keep
      var keep = [];
      if (how === 'remove') {
        let all = this._asName(this.fields);
        keep = _.without(all, ...ids);
      } else if (how === 'keep') {
        keep = ids;
      } else
        throw new RangeError("invalid value for parameter 'how' : ", how);

      // query model base and return promise on it
      return Query.marginalizeModel(this.url, this.name, keep)
        .then( () => {
          // TODO: I believe in the future a model request should return the header of the resulting model and that should be parsed on the client
          // TODO: one problem is that the client interface to the model is sort of messed up... it is too different from the PQL interface, hence a lot of conversion has to be done on the client side

          //LOOKS LIKE THIS DOESNt WORK?
          //console.log(keep);
          this.fields = keep.map( id => this._asField(id) );
          return this;
        });
    }

/*
    marginalize(ids, how = 'remove') {
      if (!Array.isArray(ids)) ids = [ids]
      if (how === 'remove')
        ids.forEach( e => { this.fields = _.without(this.fields, this.fields[this._asIndex(e)]) } )
      else if (how === 'keep')
        this.fields = ids.map( id => this._asField(id) )
      else
        throw new RangeError("invalid value for parameter 'how' : ", how)
      return this;
    }*/


    /**
     * Restricts the domain as given in the arguments and returns the modified model.
     * @param fieldUsages One {@link FieldUsage} or an array of {@link FieldUsage}s based on Fields of this model. For each matching {@link Field} of this model, its new domain will be the intersection of its old domain and the given FieldUsages domain.
     */
    restrict (fieldUsages) {
      if (!Array.isArray(fieldUsages)) fieldUsages = [fieldUsages];

      //var pairs = fieldUsage.map( fu => [fu.name, fu.domain] );
      // return Query.restrictModel(this.url, this.name, pairs) // restrict only, do not marginalize any field out

      for(let fu of fieldUsages) {
        let field = this._asField(fu);
        field.domain = field.domain.intersection(fu.domain);
      }
      throw "not implemented for remote models";
      //return this;
    }


    /**
     * Returns an aggregation on the fieldToAggregate with the ids conditioned to their corresponding values. Does not modify the model.
     * @param ids
     * @param values
     * @param fieldToAggregate
     */
    // TODO 2016-07-04 - use and test it
    aggregateNew (ids, values, fieldToAggregate) {
      let names = this._asName(ids);
      return Query.aggregateModel(this.url, this.name, fieldToAggregate, names, values);
    }


    /**
     * Returns the requested aggregation on the model, using the given values as input. The model itself is not modified.
     * @param values An array pairs of fields and value.
     * @param aggregation
     * @returns {number}
     */
    aggregate(values, fieldToAggregate) {

      // todo: in the future we might want to support aggregation on more than one variables

      // todo: fix it ... problem occurs on multi-mixed-usage of a field.
      //if (values.length > this.size()-1)
      //  throw new Error("you gave too many values. For now only aggregations on 1 variable are allowed.");
      //else
      if (values.length < this.size() - 1)
        throw new Error("you gave too few values. For now only aggregations on 1 variable are allowed.");
      //logger.warn("for now only aggregations on 1 variable are allowed.");

      // TODO: this is just a fix for doctoral colloquium such that it returns something within the domain: I pass the measure to aggregate instead of the aggregation only
      let aggr = fieldToAggregate.aggr;
      if (aggr !== F.FUsageT.Aggregation.avg && aggr !== F.FUsageT.Aggregation.sum) {
        throw new Error("not supported aggregation type given: " + aggr);
      }

      let domain = fieldToAggregate.domain;
      return domain.l + Math.random() * domain.h;
    }


    /**
     * Returns the aggregation of this model on the given target variables(s). The remaining variables of the model are marginalized. The model itself is not modified.
     * @param ids An variable of an array of variables of this field.
     * @param aggregation How to aggregate?

    aggregate2(ids, aggregation) {
      throw "not implemented for remote models";
      if (!Array.isArray(ids)) ids = [ids];
      let fields = ids.map( id => this._asField(id));

      // remove remaining variables
      let model = this.copy.marginalize(fields, 'keep');

      // calculate the aggregation
      if (aggregation === F.FUsageT.Aggregation.avg) {
        return Math.random() * 100;
      } else if (aggregation === F.FUsageT.Aggregation.sum) {
        return Math.random() * 100;
      } else {
        throw new Error("not supported aggregation type given: " + aggregation);
      }
    }*/


    /**
     * Returns the density of this model for the given values.
     * @param {Array} A single value or an array of values. A value is an object that has at least two properties:
     *  - id: a variable of this model.
     *  - value: the value for the variable.
     * @returns {Number}
     */
    density(values) {
      throw "not implemented for remote models";
      if (!Array.isArray(values)) values = [values];
      if (this.size() <= values.length)
        throw new Error("invalid number of arguments");
      return Math.random();
    }

    /**
     * Conditions one or more variables v of this model on the given range and returns the modified model.
     * @param conditionals A single pair, or an array of pairs. A pair is an object with at least two properties:
     *   - id: the variable of the model, and
     - range: The range or value to condition the variable on.
     * @returns {RemoteModel}
     *
     * Note: conditioning is not 'atomic' as it is equal to
     * (1) restricting a variable to the value to condition on, and
     * (2) marginalizing that variable out of the model
     */
    condition (conditionals) {
      throw "not implemented for remote models";
      if (!Array.isArray(conditionals)) conditionals = [conditionals];
      for(let {id, range} of conditionals) {
        // dummy model: doesn't do anything with value, but removes the conditioned field
        this.fields = _.without(this.fields, this.fields[this._asIndex(id)]);
      }
      return this
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
      return Query.clone(this.url, this.name, name)
        .then( () => {
          myClone = new RemoteModel(name, that.url);
          myClone.fields = this.fields.slice(); // TODO: see above todo.
          return myClone;
        });
    }
  }

  return RemoteModel;
});