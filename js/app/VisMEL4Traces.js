/**
 * VisMEL4Traces module.
 *
 * This module derives VisMEL queries for difference facets from a given VisMEL query.
 *
 * The VisMEL query is the one that is specified by the user to describe what "he is interested in".
 * It implicitely specifies:
 *
 *   * a set of dimensions of interest
 *   * a division of the dimensions into co-variate and variate dimensions
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
 *  Conversion principles:
 *
 *  A major challenge is the complexity of the resulting table based visualization which potentially combines multiple
 *  facets per atomic pane and a potentially large table. The facets are all interrelated, since they are all
 *  derived from the same initial VisMEL query. Especially, we want these facets and the multiple plots be linked, such
 *  that for example axes encoding the same thing are scaled identically, or a split is applied in an identical way in
 *  all atomic plots.
 *
 *  As said we need to link the various facets and atomic plots. The way these are linked is via the common 'parts' of
 *  their corresponding VisMEL and PQL query. Therefore, we use the identical FieldUsages and BaseMaps in all the facets and atomic plots, where ever possible. The FieldUsages act as keys for look up of results in a result table (-> ResultTable), their extents. The FieldMaps (-> BaseMap)
 *
 * Therefore, using the identical FieldUsage and FieldMaps across multiple PQL/VisMEL queries allows to link them.
 *
 * However, it also is a challenge: when deriving all these VisMEL queries for all the traces and atomic plots, we somehow
 * need to keep track of the FieldUsage and FieldMaps already created. How can we do this?
 *
 * An open question is also: which FieldUsages should NOT be shared? What about the filters created by the expansion of the table agebra expressions?
 * Another advantage is, that it would be possible to change parameters of e.g. a split without recreating everything,
 * since the change is automatically "propagated" to all relevant queries - since they in fact use the same field usage.
 *
 * TODO: What about rebasing of queries? Can we even share all the field usages? the different vismel queries for different atomic plots are executed against different models! When exactly does this become important? Does it at all?
 * This is a bit weird...
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
   * Error Class that indicates a conversion error for vismel2pql conversions. No suitable vismel query can be derived in this case.
   */
  class ConversionError extends utils.ExtendableError {}
  class InvalidConversionError extends utils.ExtendableError {}

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

  /**
   * Return a VisMEL query for the contour plot density density facet.
   *
   * Internal: TODO: In fact, it is hard to efficiently encode any dimension on aestetics shelves. Currently, we do not support
   */
  function biDensity(vismel) {

    if (!vismel.used)
      vismel.used = vismel.usages();

    if (!vismel.used.x || !vismel.used.y)
      // nothing to do!
      throw new ConversionError("at least one empty axis");

    if (!vismel.used.atomic)
      throw new InvalidConversionError("VisMEL query must be atomic, but is not.");

    let biVismel = new VisMEL.VisMEL(vismel.sources);

    // TODO: currently there is not support for any field usages on aestetics. If we fix this, the density below needs to include these new splits
    // generate splits for sampling along x and y axis
    let xSplit = PQL.Split.FromFieldUsage(vismel.layout.cols[0], 'density');
    let ySplit = PQL.Split.FromFieldUsage(vismel.layout.rows[0], 'density');
    for (let s of [xSplit, ySplit])
      s.args[0] = c.map.biDensity.resolution;

    let densityFu = new PQL.Density([xSplit.field, ySplit.field]);

    biVismel.layout.cols.push(xSplit);
    biVismel.layout.rows.push(ySplit);
    biVismel.layers[0].aesthetics.color = new VisMEL.ColorMap(densityFu, 'lightness');
    // TODO: after mvd removal: biVismel.layer[0].filters = vismel.layer[0].filters.slice();  // reference all existing filters
    biVismel.layers[0].filters = PQL.cleanFieldUsages(vismel.fieldUsages(['filters'], 'include')).filter( f => f.field.name !== "model vs data");

    return biVismel;
  }

  return {
    uniDensity,
    biDensity,
    ConversionError,
    InvalidConversionError,
  }

});