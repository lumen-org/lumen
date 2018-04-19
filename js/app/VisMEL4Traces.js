/**
 * VisMEL4Traces module.
 *
 * This module allows to derive VisMEL queries for difference facets from a given 'abstract' VisMEL query.
 *
 * The 'abstract' VisMEL query is the one that is typcially specified by the user to describe what he is interested in.
 * By doing so she implicitely specifies:
 *
 *   * a set of dimensions of interest
 *   * a division of the dimensions into covariate and variate dimensions
 *   * global filters
 *   * and mappings of these to visual variables
 *
 * The basic working idea is: the user should get to see:
 *
 *   * the full density model over all given dimensions (for the bidensity and unidensity traces) (see the functions for more details)
 *
 *   * the predictions as requested
 *
 * @module VisMEL
 * @author Philipp Lucas
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['./utils', './PQL', './VisMEL'], function(utils, PQL, VisMEL) {
  'use strict';

  function checkItIsRowsOrCols(rowsOrCols) {
    if (rowsOrCols !== 'cols' && rowsOrCols !== 'rows')
      throw new RangeError("rowsOrCols must be 'rows' or 'cols' but is:" + rowsOrCols.toString());
  }

  function invertRowsOrCols(rowsOrCols) {
    checkItIsRowsOrCols(rowsOrCols);
    return rowsOrCols === 'rows' ? 'cols' : 'rows';
  }

  /**
   * Returns a VisMEL query for the marginal density over the innermost dimension on <rowsOrCols>.
   *
   * The rules for conversion are as follows:
   *
   *   * keep only the innermost dimension on <rowsOrcols>
   *   * keep all filters
   *   * keep all details (it's always splits)
   *   * convert an aggregation usages on color to a split (we aim to visualize the full model given by the user!)
   *   * conversion of shape and size: if it is splits: move to details-shelf. if it is aggregations: convert to splits and move to details.
   *
   *  Also, note that the returned VisMEL query references the Map (-> BaseMap) and FieldUsages instead of copying
   *  them, whenever possible!
   *
   * @param vismelQuery A VisMEL query.
   * @param rowsOrCols Either 'rows' or 'cols'.
   */
  function uniDensity(vismelQuery, rowsOrCols /*, model*/) {
    checkItIsRowsOrCols(rowsOrCols);

    let axisFieldUsage = vismelQuery.layout[rowsOrCols][0];
    if (!PQL.isFieldUsage(axisFieldUsage)) {
      // nothing to do!
      throw new ConversionError("Shelf for " + rowsOrCols + " is empty.");
    }

    // it's easier to copy and modify than recreating
    let query = vismelQuery.shallowCopy();

    // prune layout shelves
    query.layout[rowsOrCols] = [query.layout[rowsOrCols][0]];
    query.layout[invertRowsOrCols(rowsOrCols)] = [];

    let aest = query.layers[0].aesthetics;

    // convert color map if required:
    let color = aest.color ;
    if (VisMEL.isMap(color) && !VisMEL.isSplitMap(color))
      aest.color = VisMEL.toSplitMap(color);

    // convert shape and size to splits in details
    for (let key in ['shape', 'size'])
      if (VisMEL.isMap(aest[key])) {
        if (VisMEL.isSplitMap(aest[key]))
          aest.details.push(aest[key]);
        else
          aest.details.push(aest[key]);
        aest[key] = {};
      }

    return query;
  }




  // exports
  return {
    uniDensity,
  }

});