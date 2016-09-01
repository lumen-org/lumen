/**
 * Model module.
 * @module Model
 * @author Philipp Lucas
 */
define(['./FieldUsage'], function (F) {
  "use strict";

  /**
   * This module describes the API to models and allows to train models from data.
   * It only describes the API for querying a model, which must be implemented by all actual model classes.
   *
   * This API is by design asynchronous and utilizes Promises for this purpose. Hence, the majority of methods return
   * not the actual result but a promise to it.
   *
   * Independent of the actual 'nature' of a particular model, an implementation of a model is expected to hold a local
   * copy of the descriptions/the fields (random variables) of the model. Therefore methods such as {@link describe)
   * or {@link isName} are not asynchronous.
   *
   * @alias module:Model
   * @constructor
   */
  class Model {

    constructor(name) {
      if (!_.isString(name)) throw new TypeError("the name of a model must be a string");
      this.name = name;
      this.fields = {}; // dict of {@link F.Fields}, name is the key
    }

    get names () {
      return this.fields.keys();
    }

    /**
     * Conditions variable v of this model on the given range and returns a promise to the resulting model.
     * Does not change this model.
     * @param v A variable of the model, specified by their index, name, or the field of the model itself.
     * @param value
     *
    condition(v, value) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Marginalizes v out of this model and returns a promise to the resulting model.
     * @param v A single variable or an array of variables of this model, specified by their index, name, or the field of the model itself.
     *
    marginalize(v) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Returns a promise to the density of this model for the given values, or 'undefined' if values does not specify all required variable values.
     * @param values
     *
    density(values) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Returns a promise to the aggregation of this model on the given target field(s). The remaining fields of the model are marginalized.
     *
     * if: what to aggregate: one or more fields
     * how to aggregate: which aggregation do we want?
     * conditionals/domains: restrict domains of fields
     *
    aggregate(id, aggregation) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * Restricts the domain as given in the arguments.
     * @param v One or more domain restrictions as its parameters
     *
    restrict (...v) {
      throw new Error("You have to implement this function in your subclass")
    }

    /**
     * @returns {Promise} Returns a promise to a copy of this model.
     * NOTE: in order for the rest of the tool to work correctly, a copy of a model MUST reference to the same
     * {@link Fields}s, but not (deep) copy them. This restriction is hopefully to be removed at some point.
     * @param {string} [name] - the new name of the model.
     *
    copy(name) {
      throw new Error("You have to implement this function in your subclass")
    } */

    /**
     * Returns the number of fields in the model.
     * @returns {*}
     *
    size() {
      return this.fields.length
    }

    /**
     * Returns true iff idx is a valid index of a field of this model.
     * @param idx
     *
    isIndex(idx) {
      return (_.isNumber(idx) && (idx < this.size()) && (idx >= 0))
    }

    /**
     * Returns true iff name is a valid name of a field of this model.
     * @param name
     */
    isName(name) {
      return this.fields.hasOwnProperty(name);
    }

    /**
     * Returns true iff field is a field of this model. Note that it returns false, if it is a FieldUsage that is based on a Field of this model.
     * @param field
     */
    isField(field) {
      return field instanceof F.Field && (this.fields[field.name] === field);
    }

    /**
     * Returns true iff fu is a {@link FieldUsage} that is based on a {@link Field} of this model.
     * @param fu
     *
    isFieldUsage(fu) {
      return fu instanceof F.FieldUsage && (-1 !== this.fields.indexOf(fu.base))
    }*/


    /**
     * Returns the field(s) of this model that belongs to the given id(s).
     * @param ids - An (mixed) array of the following, or a single value of index, name, or field of this model.
     *
    asField(ids) {
      var isArray = Array.isArray(ids)
      if (!isArray)
        ids = [ids]
      var fields = this.asIndex(ids)
        .map( (id) => this.fields[id], this);
      return isArray ? fields : fields[0]
    }

    /**
     * Returns the name(s) that belongs to the given id(s) in this model.
     * @param ids - An (mixed) array of the following, or a single value of index, name, or field of this model.
     *
    asName(ids) {
      var isArray = Array.isArray(ids)
      if (!isArray)
        ids = [ids]
      var names = this.asIndex(ids)
        .map( (id) => this.fields[id].name, this);
      return isArray ? names : names[0]
    }


    /**
     * Returns the index(es) that belongs to the given id(s) in this model.
     * @param ids - An (mixed) array of the following, or a single value of index, name, or field of this model.
     *
    asIndex(ids) {
      var isArray = Array.isArray(ids)
      if (!isArray)
        ids = [ids]
      var indexes = ids.map( (id) => {
          if (this.isIndex(id))
            return id;
          if (this.isName(id))
            return _.findIndex(this.fields, function (f) {
              return f.name === id;
            });
          if (this.isFieldUsage(id))
            return this.fields.indexOf(id.base);
          if (this.isField(id))
            return this.fields.indexOf(id);
          throw new RangeError("argument is neither a valid field index, nor a valid field name, nor a valid Field of this model. Argument was: " + id);
      }, this);
      return isArray ? indexes : indexes[0]
    }*/

    /**
     * Returns a textual description of the model.
     * @returns {String}
     *
    describe() {
      var desc = "-- Model '" + this.name + "' --\n" +
        "consists of " + this.size() + " fields, as follows\n";
      return this.fields.reduce((str, field) => str + field.toString() + "\n", desc);
    }*/

    /**
     * Returns an array of all {@link F.Field}s of this model, which are dimensions.
     *
    dimensions() {
      return this.fields.filter(F.isDimension);
    }

    measures() {
      return this.fields.filter(F.isMeasure);
    }*/

  }

  return Model;
});



