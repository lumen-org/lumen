
/**
 * Model Table module.
 *
 * @module ModelTable
 * @author Philipp Lucas
 */
define(['./Field'], function(F) {
  'use strict';

  /**
   * A model table is table of submodels according to a layout of VisMEL query. It contains one submodel for each cell of the table, and each submodel will be used to generate samples/aggregations for that cell.
   * Creates a {@link ModelTable} from given VisMEL query.
   * @alias module:ModelTable
   * @constructor
   */
  var ModelTable = function (query) {

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
    var usedVariables = query.allUsedVariables();

    // 3. filters on independent variables, and
    // 4. derive base model
    this.baseModel = model.marginalize( _.difference(model.fields, usedVariables) ); // todo: implement filtering

    // 5. derive submodels for each cell
    // todo: speedup: dynamically decide whether it's faster to do get a row- or column-wise base-model
    // iterate on rows

    /*var _conditioningCallback = function(model, symbol) {
      if (symbol.role === F.FieldT.Kind.discrete)
        model.condition(symbol.fieldUsage.base, symbol.value);
    }*/

    this.at = new Array(this.rows);
    for (var rIdx=0; rIdx<this.rows; rIdx++) {
      // get basis of all models of this row
      var rowModel = this.baseModel.copy();
      this.rowNSF[rIdx].forEach(
        function (symbol) {
          if (symbol.fieldUsage.kind === F.FieldT.Kind.discrete)
            rowModel.condition(symbol.fieldUsage.base, symbol.value);
        }
      );
      //iterate on cols for this row
      this.at[rIdx] = new Array(this.cols);
      for (var cIdx=0; cIdx<this.cols; cIdx++) {
        var cell = rowModel.copy( rowModel.name + "(" + rIdx + "," + cIdx + ")");
        this.colNSF[cIdx].forEach(
          function (symbol) {
            if (symbol.fieldUsage.kind === F.FieldT.Kind.discrete)
              cell.condition(symbol.fieldUsage.base, symbol.value);
          }
        );
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