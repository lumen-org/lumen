define(['./PQL'], function (PQL) {

  /**
   * Returns a sampling of the marginal distribution of model model over dimension dimNameOrField
   * @param model
   * @param dimNameOrField
   * @param mode {String} Either 'probability' or 'density'. Optional. Defaults to 'probability'.
   * @returns {*|Object|Array|query|fu2idx|idx2fu}
   */
  function getMarginalDistribution (model, dimNameOrField, mode='probability') {
    // given a model and a dimension name / field
    let field = PQL.isField(dimNameOrField) ? dimNameOrField : model.fields.get(dimName);

    // get a sampling of the marginal distribution over that field "using standard splits"
    // TODO: add all existing filters as conditions
    let method = field.isDiscrete() ? PQL.SplitMethod.elements : PQL.SplitMethod.equiinterval;
    return model.predict([field.name, new PQL.Density(field, mode)], [], new PQL.Split(field, method, 20) );
  }

  return {
    getMarginalDistribution,
  }

});