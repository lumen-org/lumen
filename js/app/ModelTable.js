/**
 * Model Table module.
 * @module ModelTable
 * @author Philipp Lucas
 */
define(['./Field'], function(F) {
  'use strict';

  /**
   * Given a query and the corresponding base model, attaches a model for each measure/aggregation of a query to that measure.
   * @param query
   * @param baseModel
   * @returns A promise to do the above.

  var attachModel = function (query, baseModel, rIdx, cIdx) {
    let measures = query.measureUsages();

    // marginalize all those measures out of the model, for which the base field isn't also used for a dimension or another measure
    let uniqueMeasures = _.unique(measures, F.nameMap);
    let uniqueDimensions = query.dimensionUsages();
    let toBeRemoved = uniqueMeasures.filter( function (m) {
      return (undefined === uniqueDimensions.find( function(d) {return (d.name === m.name);} ) );
    });

    let promises = new Set().add(Promise.resolve());

    measures.forEach(
      function (m, idx) {
        let promise = baseModel.copy(baseModel.name + "_" + m.name + idx)
          .then( (copy) => copy.marginalize(
            toBeRemoved.filter(function (r) {return m.name !== r.name;}) // remove m from toeBeRemoved, based on .name
          ))
          .then( (measureModel) => {
//            console.log("attached model : " + measureModel.describe());
            m.model = measureModel;
          });
        promises.add(promise);
      }
    );

    return Promise.all(promises);
  };*/


  /**
   * Returns a promise to the 'base model' for the provided query, i.e. a model of all fields used in the query.
   * @param query
   * @param rIdx Row index in the model table
   * @param cIdx Column index in the model table
   * @returns {DummyModel|*}
   */
  var deriveBaseModel = function (query, rIdx, cIdx) {

    function makeBaseModelName (modelName, rIdx, cIdx) {
      return "__" + modelName + "_" + rIdx + "_" + cIdx;
    }

    // todo: extend: only 1 layer and 1 source is supported for now
    var model = query.sources[0];

    // assert that row/col only has at most 1 fieldUsage on it (as a result of the template expansion)
    if (query.layout.rows.length > 1 || query.layout.cols.length > 1)
      throw new RangeError ("query.layout.rows or query.layout.cols contains more than 1 FieldUsage");

    return model.model(
      query.fields().map(F.nameMap),
      query.layers[0].filters,
      makeBaseModelName(model.name, rIdx, cIdx));

    // 3. merge (i.e. intersect) domains of FieldUsages based on the same Field
    // todo: implement

    // 4. apply all remaining filters on independent variables
    // todo: implement
    // todo: don't forget to remove filters from sub query?

    // 5. derive model and return
    //return model.marginalize(fields, "keep", );
  };


  /**
   * A {@link ModelTable} is a table of submodels according to QueryTable.
   * It contains one submodel for each cell of the table, and each submodel will be used
   * to generate samples/aggregations for that cell.
   */
  class ModelTable {

    /**
     * Creates a {@link ModelTable} from given VisMEL query.
     * @alias module:ModelTable
     * @constructor
     */
    constructor (queryTable) {
      this.queryTable = queryTable;
      this.size = queryTable.size;
      this.at = new Array(this.size.rows);
    }

    model () {
      let modelPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        this.at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let query = this.queryTable.at[rIdx][cIdx];
          let promise = deriveBaseModel(query, rIdx, cIdx) // derive base model for a single atomic query
            .then( baseModel => { // jshint ignore:line
///              console.log("base model = " + baseModel.describe());
              this.at[rIdx][cIdx] = baseModel;
              return baseModel;
            });
            // attach model for each measure to the measure of that atomic query
            //.then( baseModel => attachModel(query, baseModel, rIdx, cIdx) );
          modelPromises.add(promise);
        }
      }
      return Promise.all(modelPromises);
    }
  }

  /**
   * Public interface
   */
  return ModelTable;

});