/**
 * Model Table module.
 * @module ModelTable
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['./PQL'], function(PQL) {
  'use strict';

  /**
   * Returns a promise to the 'base model' for the provided query, i.e. a model of all fields used in the query.
   * @param query
   * @param rIdx Row index in the model table
   * @param cIdx Column index in the model table
   * @param facetName Name of the facet to derive base mode for
   * @returns {DummyModel|*}
   */
  function deriveBaseModel (query, rIdx, cIdx, facetName) {

    function makeBaseModelName (modelName, facetName, rIdx, cIdx) {
      return "__" + modelName + (facetName !== "" ? "-" + facetName + "-" : "") + "_" + rIdx + "_" + cIdx;
    }

    // todo: extend: only 1 layer and 1 source is supported for now
    let model = query.sources[0];

    // assert that row/col only has at most 1 fieldUsage on it (as a result of the template expansion)
    if (query.layout.rows.length > 1 || query.layout.cols.length > 1)
      throw new RangeError ("query.layout.rows or query.layout.cols contains more than 1 FieldUsage");

    // in any way all fields of field usages must be in the model
    let modelFields = PQL.fields(query.fieldUsages());
    if (facetName === 'dataLocalPrediction') {
      let modelFieldNames = new Set(modelFields.map(f => f.name)),
          model = query.getModel(),
          missingFields = model.observedFields.filter(of => !modelFieldNames.has(of.name));
      // must also include all observed dims
      modelFields.push(...missingFields);
    }

    return model.model(
      modelFields,
      query.layers[0].filters,
      query.layers[0].defaults,
      makeBaseModelName(model.name, facetName, rIdx, cIdx));

    // TODO: apply all remaining filters on independent variables
    // TODO: don't forget to remove filters from sub query(?)
  }


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

    /**
     * Derives promise collection of base models for a facet.
     * @param facetName {String}, optional. The facet name for which to derive base models.
     * @returns {Promise<unknown[]>}
     */
    model (facetName="") {
      let modelPromises = new Set().add(Promise.resolve());
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        this.at[rIdx] = new Array(this.size.cols);
        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          let query = this.queryTable.at[rIdx][cIdx];
          let promise = deriveBaseModel(query, rIdx, cIdx, facetName) // derive base model for a single atomic query
            .then( baseModel => { // jshint ignore:line
              this.at[rIdx][cIdx] = baseModel;
              //return baseModel;
            });
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