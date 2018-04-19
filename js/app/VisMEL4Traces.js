/**
 * VisMEL4Traces module.
 *
 * This module allows to derive VisMEL queries for difference facets from a given 'abstract' VisMEL query.
 *
 * The 'abstract' VisMEL query is the one that is specified by the user to describe what he is interested in.
 * By doing so she implicitely specifies:
 *
 *   * a set of dimensions of interest
 *   * a division of the dimensions into covariate and variate dimensions
 *   * global filters
 *   * mappings of these to visual variables
 *   * configurations for splits, predictions, and more
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

define(['./utils', './PQL', './VisMEL', './ViewSettings'], function(utils, PQL, VisMEL, c) {
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
   *   * convert the innermost dimension on <rowsOrcols> to a split usage and keep only this
   *   * add a density FieldUsage on <invert-rowsOrCols> and keep only this
   *   * keep all filters
   *   * keep all details (it's always splits)
   *   * convert an aggregation usages on color to a split (we aim to visualize the full model given by the user!)
   *   * conversion of shape and size: if it is splits: move to details-shelf. if it is aggregations: convert to splits and move to details.
   *
   *  Also, note that the returned VisMEL query references the Map (-> BaseMap) and FieldUsages instead of copying
   *  them, whenever possible!
   *
   * @param vismel A VisMEL query.
   * @param rowsOrCols Either 'rows' or 'cols'.
   */
  function uniDensity(vismel, rowsOrCols /*, model*/) {
    checkItIsRowsOrCols(rowsOrCols);
    let invRoC = invertRowsOrCols(rowsOrCols);

    let axisFieldUsage = vismel.layout[rowsOrCols][0];
    if (!PQL.isFieldUsage(axisFieldUsage))
      // nothing to do!
      throw new ConversionError("Shelf for " + rowsOrCols + " is empty.");

    // it's easier to copy and modify than recreating
    let uniVismel = vismel.shallowCopy();

    // reuse if existing, convert to split if required
    let aest = uniVismel.layers[0].aesthetics,
      color = aest.color;
    if (VisMEL.isMap(color) && !VisMEL.isSplitMap(color))
      aest.color = VisMEL.toSplitMap(color);

    // convert shape and size to splits in details
    for (let key in ['shape', 'size'])
      if (VisMEL.isMap(aest[key])) {
        if (VisMEL.isSplitMap(aest[key]))
          aest.details.push(aest[key]);
        else
          aest.details.push(VisMEL.toSplitMap(aest[key]));
        aest[key] = {};
      }

    // prune layout shelves and convert to split and density FieldUsage

    // create new split for univariate density (always new splits!)
    let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'density');
    densitySplit.args[0] = c.map.uniDensity.resolution;

    let layout = uniVismel.layout;
    layout[rowsOrCols].splice(0);
    layout[invRoC].splice(0);
    layout[rowsOrCols].push(densitySplit);

    // create density field usage (over all splits)
    let splits = PQL.cleanFieldUsages(uniVismel.fieldUsages(['aesthetics', 'details', 'layout'], 'include'));
    if(!splits.every(PQL.isSplit))
      throw RangeError("Assertion Error: there should only be splits left");
    let fields4density = splits.map(split => split.field);
    layout[invRoC].push(new PQL.Density(fields4density));

    return uniVismel;
  }

  return {
    uniDensity,
  }

});