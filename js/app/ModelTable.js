
/**
 * Model Table module.
 * @module ModelTable
 * @author Philipp Lucas
 */
define(['./Field'], function(F) {
  'use strict';

  /**
   * Attaches a model to each measure/aggregation of a query.
   * @param query
   * @param base
   */
  var attachModel = function (query, base) {
    let measures = query.measureUsages();

    // marginalize all those measures out of the model, for which the base field isn't also used for a dimension or another measure
    let uniqueMeasures = _.unique(measures, F.nameMap);
    let uniqueDimension = query.dimensionUsages();
    let toBeRemoved = uniqueMeasures.filter( function (m) {
      return (undefined === uniqueDimension.find( function(d) {return (d.name === m.name);} ) );
    });

    measures.forEach(
      function (m) {
        m.model = base.copy().marginalize(
          toBeRemoved.filter(function (r) {return m.name !== r.name;}) // remove m from toeBeRemoved, based on .name
        );
      }
    );
  };


  var model = function (query) {
    // todo: extend: only 1 layer and 1 source is supported for now
    var base = query.sources[0];

    // 1. assert that row/col only has at most 1 fieldUsage on it (as a result of the template expansion)
    if (query.layout.rows.length > 1 || query.layout.cols.length > 1)
      throw new RangeError ("query.layout.rows or query.layout.cols contains more than 1 FieldUsage");

    // 2. compile set of all Fields
    var fields = query.fields();
    //var fieldUsages = query.fieldUsages();
    //var dimensions = fieldUsages.filter(F.isDimension);
    //var measures = fieldUsages.filter(F.isMeasure);

    // 3. merge (i.e. intersect) domains of FieldUsages based on the same Field
    // todo: implement

    // 4. apply filters on independent variables
    // todo: implement
    // todo: don't forget to remove filters from sub query?

    // 5. derive model and return
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
        let query = queryTable.at[rIdx][cIdx];
        // derive base model for a single query, then:
        // attach model for each measure to the measure of the query
        attachModel(query, this.at[rIdx][cIdx] = model(query));
      }
    }
  };

  /**
   * Public interface
   */
  return ModelTable;

});