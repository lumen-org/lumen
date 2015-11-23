
/**
 * Model Table module.
 *
 * A model table is table of submodels according to a layout of VisMEL query. It contains one submodel for each cell of the table, and each submodel will be used to generate samples/aggregations for that cell.
 */
define(['app/shelves'], function(sh) {
  'use strict';

  /**
   * Creates a {@link ModelTable} from given VisMEL query.
   * @constructor
   */
  var ModelTable = function (query) {

    // shortcuts
    // todo: extend: only 1 layer and 1 source is supported for now
    var model = query.sources[0];
    var layout = query.layout;

    //this.model = ... // todo: get actual model reference from somewhere

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
    this.baseModel = model.marginalize(
      _.diff(model.variables(), usedVariables) ); // todo: implement filtering

    // 5. derive submodels for each cell
    // todo: speedup: dynamically decide whether it's faster to do get a row- or column-wise base-model
    // iterate on rows
    this.at = new Array(this.rows);
    at.forEach( function(row, rIdx) {
      var rowModel = this.baseModel;
      this.rowNSF[rIdx].forEach(
        function (symbol) { rowModel = rowModel.condition(symbol.fieldUsage, symbol.value); }
      );
      //iterate on cols
      row = new Array(this.cols);
      row.forEach( function(cell, cIdx) {
        cell = rowModel;
        this.colNSF[cIdx].forEach(
          function (symbol) { cell = cell.condition(symbol.fieldUsage, symbol.value); }
        );
      });
    });

    // done :-)
  };

  /**
   * Public interface
   */
  return ModelTable;

});