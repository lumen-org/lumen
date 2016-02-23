
/**
 * Model Table module.
 * @module ModelTable
 * @author Philipp Lucas
 */
define(['./Field'], function(F) {
  'use strict';

  var model = function (query) {
    // todo: extend: only 1 layer and 1 source is supported for now
    var base = query.sources[0];

    // 1. assert that row/col only has at most 1 fieldUsage on it (as a result of the template expansion)
    if (query.layout.rows.length > 1 || query.layout.cols.length > 1)
      throw new RangeError ("query.layout.rows or query.layout.cols contains more than 1 FieldUsage");

    // 2. compile set of all Fields and FieldUsage split by dimensions and measures
    var fields = query.fields();
    //var fieldUsages = query.fieldUsages();
    //var dimensions = fieldUsages.filter(F.isDimension);
    //var measures = fieldUsages.filter(F.isMeasure);

    // 3. merge domains of FieldUsages based on the same Field
    // todo: implement

    // 4. compile set of unique Fields (not field Usages) that are used in a VisMEL query.
    // -> Fields not part of that set can be marginalized out
    //var usedVariables = query.fields();

    // 5. apply filters on independent variables
    // todo: implement
    // todo: don't forget to remove filters from sub query?

    // 6. derive model and return
    return base.copy().marginalize( _.difference(base.fields, fields) );
  };


  /**
   * A {@link ModelTable} is table of submodels according to QueryTable.
   * It contains one submodel for each cell of the table, and each submodel will be used
   * to generate samples/aggregations for that cell.
   *
   * This contstructor creates a {@link ModelTable} from given VisMEL query.
   * @alias module:ModelTable
   * @constructor
   */
  var ModelTable = function (queryTable) {

    this.size = queryTable.size;
    this.at = new Array(this.size.rows);
    for (let rIdx=0; rIdx<this.size.rows; ++rIdx) {
      this.at[rIdx] = new Array(this.size.cols);
      for (let cIdx=0; cIdx<this.size.cols; ++cIdx) {
        this.at[rIdx][cIdx] = model(queryTable.at[rIdx][cIdx]);
      }
    }

    /*
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
    }*/
    // done :-)
  };

  /**
   * Public interface
   */
  return ModelTable;

});