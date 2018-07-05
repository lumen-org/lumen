/**
 * Model module.
 * @module Model
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['./PQL'], function (PQL) {
  "use strict";

  /**
   * This module defines the API to models and allows to train models from data.
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
      this.fields = new Map(); // dict of {@link F.Fields}, name is the key
    }

    get names () {
      return this.fields.keys();
    }

    /**
     * Returns true iff name is a valid name of a field of this model.
     * @param name
     */
    isName(name) {
      return this.fields.has(name);
    }

    /**
     * Returns true iff field is a field of this model. Note that it returns false, if it is a FieldUsage that is based on a Field of this model.
     * @param field
     */
    isField(field) {
      return field instanceof PQL.Field && (this.fields.get(field.name) === field);
    }

    get dim () {
      return this.fields.size+1;
    }

  }

  return Model;
});



