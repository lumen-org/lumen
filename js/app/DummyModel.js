/**
 * "Dummy Model" module.
 *
 * NOTE: THIS MODEL DOES NOT WORK with the current tool. Reason is: it works synchronously, but the model API has
 * changed to async. It should be sufficient to wrap the return values of the models functions into a resolved promise
 * to make it work again.
 *
 * NOTE2: actually quite a few more changes would be necessary, as I entirely refactored Field.js and this is still
 * expecting the old Field.js...
 *
 * @module DummyModel
 * @author Philipp Lucas
 */

define(['lib/logger', './Domain', './Field', './Model'], function (Logger, Domain, F, Model) {
  "use strict";

  var logger = Logger.get('pl-DummyModel');
  logger.setLevel(Logger.WARN);

  class DummyModel extends Model {

    /**
     * Creates and returns an empty dummy model with given name
     * @param name Name for the model.
     * @returns {DummyModel}
     * @constructor
     * @alias module:DummyModel
     */
    constructor(name) {
      super(name)
    }
    

    /**
     * Marginalizes variables out of this model and returns the modified model.
     * @param ids A single field or an array of variables of this model, each specified either by their name or their index.
     * @param how If how === 'remove', the given variables are marginalized. If how === 'keep' the given variables are kept, and all other variables of the models are marginalized.
     * @returns {DummyModel}
     */
    marginalize(ids, how = 'remove') {
      if (!Array.isArray(ids)) ids = [ids];
      if (how === 'remove')
        ids.forEach( e => { this.fields = _.without(this.fields, this.fields[this.asIndex(e)]) } );
      else if (how === 'keep')
        this.fields = ids.map( id => this.asField(id) );
      else
        throw new RangeError("invalid value for parameter 'how' : ", how);
      return this;
    }


    /**
     * Restricts the domain as given in the arguments and returns the modified model.
     * @param fieldUsages One {@link FieldUsage} or an array of {@link FieldUsage}s based on Fields of this model. For each matching {@link Field} of this model, its new domain will be the intersection of its old domain and the given FieldUsages domain.
     */
    restrict (fieldUsages) {
      if (!Array.isArray(fieldUsages)) fieldUsages = [fieldUsages];
      for(let fu of fieldUsages) {
        let field = this.asField(fu);
        field.domain = field.domain.intersection(fu.domain);
      }
      return this;
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
     */
    aggregate2(ids, aggregation) {
      if (!Array.isArray(ids)) ids = [ids];
      let fields = ids.map( id => this.asField(id));

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
    }


    /**
     * Returns the density of this model for the given values.
     * @param {Array} A single value or an array of values. A value is an object that has at least two properties:
     *  - id: a variable of this model.
     *  - value: the value for the variable.
     * @returns {Number}
     */
    density(values) {
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
     * @returns {DummyModel}
     *
     * Note: conditioning is not 'atomic' as it is equal to
     * (1) restricting a variable to the value to condition on, and
     * (2) marginalizing that variable out of the model
     */
    condition (conditionals) {
      if (!Array.isArray(conditionals)) conditionals = [conditionals];
      for(let {id, range} of conditionals) {
        // dummy model: doesn't do anything with value, but remove the conditioned field
        this.fields = _.without(this.fields, this.fields[this.asIndex(id)]);
      }
      return this
    }
    
    
    /**
     * @param {string} [name] - the new name of the model.
     * @returns Returns a copy of this model.
     * @constructor
     */
    copy(name) {
      if (!name)
        name = this.name;
      var myCopy = new DummyModel(name);
      myCopy.fields = this.fields.slice();
      return myCopy;
    }

  }

  /**
   * Collection of generators of dummy models.
   */
  DummyModel.generator = {

    /**
     * generates a dummy model about census data
     * @returns {DummyModel}
     */
    census: function () {
      var myModel = new DummyModel('census');

      var ageField = new F.Field(
        'age', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          domain: new Domain.SimpleNumericContinuous(0, 100)
        });
      var weightField = new F.Field(
        'weight', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          domain: new Domain.SimpleNumericContinuous(40, 90)
        });
      var incomeField = new F.Field(
        'income', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          domain: new Domain.SimpleNumericContinuous(500, 100000)
        });
      var childrenField = new F.Field(
        'children', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.measure,
          domain: new Domain.Discrete([0, 1, 2, 3, 4])
        });
      var sexField = new F.Field(
        'sex', myModel, {
          dataType: F.FieldT.Type.num,
          role: F.FieldT.Role.dimension,
          domain: new Domain.Discrete(["F", "M"])
        });
      var nameField = new F.Field(
        'name', myModel, {
          dataType: F.FieldT.Type.string,
          role: F.FieldT.Role.dimension,
          domain: new Domain.Discrete(['Max', 'Philipp', 'Maggie'])
        });
      var cityField = new F.Field(
        'city', myModel, {
          dataType: F.FieldT.Type.string,
          role: F.FieldT.Role.dimension,
          domain: new Domain.Discrete(['Tokyo', 'Jena', 'Seoul', 'New York'])
          //domain: new Domain.Discrete(['Tokyo', 'Jena', 'Seoul', 'Chicago'])
        });

      myModel.fields = [
        ageField,
        weightField,
        incomeField,
        childrenField,
        sexField,
        nameField,
        cityField
      ];

      return myModel;
    },

    empty: function () {
      return new DummyModel('empty');
    }
  };

  return DummyModel;

});