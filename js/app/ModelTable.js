
/**
 * Model Table module.
 * @module ModelTable
 * @author Philipp Lucas
 */
define(['./Field'], function(F) {
  'use strict';

  /**
   * A {@link ModelTable} is table of submodels according to a layout of VisMEL query.
   * It contains one submodel for each cell of the table, and each submodel will be used
   * to generate samples/aggregations for that cell.
   *
   * This contstructor creates a {@link ModelTable} from given VisMEL query.
   * @alias module:ModelTable
   * @constructor
   */
  var ModelTable = function (query) {

    this.query = query;

    // shortcuts
    // todo: extend: only 1 layer and 1 source is supported for now
    var model = query.sources[0];
    var layout = query.layout;

    // 1. normalize expressions
    this.rowNSF = layout.rows.normalize();
    this.colNSF = layout.cols.normalize();

    this.rows = this.rowNSF.length;
    this.cols = this.colNSF.length;
    this.size = [this.rows, this.cols];

    // 2. compile set of unique Fields (not field Usages) that are used in a VisMEL query.
    // -> Fields not part of that set can be marginalized out
    var usedVariables = query.fields();

    // 3. apply filters on independent variables
    // todo: implement

    // 4. derive base model
    this.baseModel = model.copy().marginalize( _.difference(model.fields, usedVariables) );
    // todo: implement filtering

    // 5. derive submodels for each cell
    // todo: speedup: dynamically decide whether it's faster to do get a row- or column-wise base-model
    // iterate on rows
    this.at = new Array(this.rows);
    for (var rIdx=0; rIdx<this.rows; rIdx++) {
      // get basis of all models of this row
      var rowModel = this.baseModel.copy();
      this.rowNSF[rIdx].forEach(
        function (symbol) {
          if (symbol.fieldUsage instanceof F.Field && symbol.fieldUsage.kind === F.FieldT.Kind.discrete)
            rowModel.condition(symbol.fieldUsage.base, symbol.value);
        }
      ); // jshint ignore:line
      //iterate on cols for this row
      this.at[rIdx] = new Array(this.cols);
      for (var cIdx=0; cIdx<this.cols; cIdx++) {
        var cell = rowModel.copy( rowModel.name + "(" + rIdx + "," + cIdx + ")");
        this.colNSF[cIdx].forEach(
          function (symbol) {
            if (symbol.fieldUsage instanceof F.Field && symbol.fieldUsage.kind === F.FieldT.Kind.discrete)
              cell.condition(symbol.fieldUsage.base, symbol.value);
          }
        ); // jshint ignore:line
        this.at[rIdx][cIdx] = cell;
      }
    }
    // done :-)
  };

  /**
   * Public interface
   */
  return ModelTable;

});