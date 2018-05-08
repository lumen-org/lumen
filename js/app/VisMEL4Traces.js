
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
 *   * the predictions as requested
 *   * the marginals along the visualization table axis
 *   * the training and or test data
 *
 *  Conversion principles:
 *
 *  A major challenge is the complexity of the resulting table based visualization which potentially combines multiple
 *  facets per atomic pane and a potentially large table as such. The facets are all interrelated, since they are all
 *  derived from the same initial VisMEL query. Especially, we require these facets and the multiple plots be linked, such
 *  that for example axes encoding the same thing are scaled identically, or a split is applied in an identical way in
 *  all atomic plots.
 *
 *  As said we need to link the various facets and atomic plots. The way these are linked is via the common 'parts' of
 *  their corresponding VisMEL and PQL query. This means we use the identical FieldUsages and BaseMaps in all the facets and atomic plots, where ever possible. This allows FieldUsages to act as
 *    (1) uniform keys for look ups of results in a result table (-> ResultTable) (i.e. the same FieldUsage will work in different result tables!)
 *    (2) uniform keys for look ups of extents within a single result table (-> ResultTable) (like above)
 *    (3) and since (2) Field Usages act as unique, global keys for the global extent of a Field Usage.
 *
 * In short: using the identical FieldUsage and FieldMaps across multiple PQL/VisMEL queries allows to link them!
 *
 * However, it also poses a challenge: when deriving all these VisMEL queries for all the traces and atomic plots, we need to keep track of the FieldUsage and FieldMaps already created. Take, for example, the table of vismel queries created for the marginal densities. They should all reuse the same density FU, but at the moment are created independently from each other. How can we achieve the reuse here?
 *
 * An open question is: which FieldUsages should NOT be shared?
 *  * What about the filters created by the expansion of the table algebra expressions?
 *    We could reuse them, but it is not necessary because the linking is not required for such filters. So for the sake of simplicity we do not reuse them.
 *
 * Another advantage is, that it would be possible to change parameters of e.g. a split without recreating everything,
 * since the change is automatically "propagated" to all relevant queries - since they in fact use the same field usage.
 *
 * Issue: Rebasing models/queries:
 *    What about rebasing of queries? Can we even share all the field usages at all? The different vismel queries for different atomic plots are executed against different models. And different model have different instances of <Field> at their 'core'...
 *    Answer: Yes, this is a bit messy. The different models do have different instances of <Field>, even for the same dimensions. Read on
 *    TODO/Note: One way to make it cleaner: Decouple PQL/VisMEL queries and models stronger. Right now the coupling is the reference of a particular models Field in the query. This should not happen. It would be enough to reference the Field by its name, for example. Actually, however, the only real coupling here, is that Fields also store their extent and domain (since these are / could be different for each model, and are not directly relevant for the query statement. We do not use this information at any point _after_ we constructed the queries. Hence, we should be fine with leaving things as they are.
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
   *     * the density is computed over: <rowsOrCols> and all splits and defaults
   *   * keep all filters and defaults
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
  function uniDensity(vismel, rowsOrCols) {
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
    let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'probability');
    densitySplit.args[0] = c.map.uniDensity.resolution;

    let layout = uniVismel.layout;
    layout[rowsOrCols].splice(0);
    layout[invRoC].splice(0);
    layout[rowsOrCols].push(densitySplit);

    // create density field usage (over all splits and defaults)
    let splits = PQL.cleanFieldUsages(uniVismel.fieldUsages(['aesthetics', 'details', 'layout', 'defaults'], 'include'));
    if(!splits.every(e => (PQL.isSplit(e) || PQL.isFilter(e)) ) )
      throw RangeError("Assertion Error: there should only be splits left");
    let fields4density = _.unique( splits.map(split => split.field) );
    layout[invRoC].push(new PQL.Density(fields4density, PQL.DensityMethod.probability));

    return uniVismel;
  }

  /**
   * Return a VisMEL query for the contour plot density facet.
   *
   * Aestetics shelves:
   *  Currently, we generally do not support it! The problem is not to generate the query, but to encode all of it in the visualization.
   *  TODO: In fact, it is hard to efficiently encode any dimension on aestetics shelves.
   *  However, there is one special case, namely when one of the positional axis encodes a categorical value, and the
   *  other a quantitative one. Then we can encode dimensions on aestetics shelves as a series of line plots (like for uniDensity).
   *  TODO: If we fix this, the generated density below needs to include these new splits.
   *
   * Conversion rules:
   *   * keep all filters and defaults
   *   * ignore (i.e. remove) anything on aestetics
   *   * replace layout shelf contents by new split over x and y dimensions, respectively
   *   * add a ColorMap for a Density FieldUsage over both, the x and y split
   */
  function biDensity(vismel) {

    if (!vismel.used)
      vismel.used = vismel.usages();

    if (!vismel.used.x || !vismel.used.y)
      // nothing to do!
      throw new ConversionError("at least one empty axis");

    if (!vismel.used.atomic)
      throw new InvalidConversionError("VisMEL query must be atomic, but is not.");

    // build new vismel query
    let biVismel = new VisMEL.VisMEL(vismel.sources);

    // generate splits for sampling along x and y axis
    let xSplit = PQL.Split.FromFieldUsage(vismel.layout.cols[0], 'probability');
    let ySplit = PQL.Split.FromFieldUsage(vismel.layout.rows[0], 'probability');
    for (let s of [xSplit, ySplit])
      s.args[0] = c.map.biDensity.resolution;
    //let fields4density = _.unique( [xSplit, ySplit, ...vismel.layers[0].defaults].map(d => d.field) );

    // should we generate the special trace biQC ?
    let posFu = [vismel.layout.cols[0], vismel.layout.rows[0]];
    let discreteYieldCnt = posFu.filter(PQL.hasDiscreteYield).length,
      numYieldCnt =  posFu.filter(PQL.hasNumericYield).length;
    if (discreteYieldCnt + numYieldCnt !== 2)
      throw "This should not happen.";  // should always add up tp 2!!
    let qc = (discreteYieldCnt === 1);
    if (qc) {
      let aestOld = vismel.layers[0].aesthetics,
        aestNew = biVismel.layers[0].aesthetics;
      // use color (convert if necessary)
      if (vismel.used.color && !VisMEL.isSplitMap(aestOld.color))
        aestNew.color = VisMEL.toSplitMap(aest.color);
      else
        aestNew.color = aestOld.color;  

      // TODO: 
      // convert shape and size to splits in details
      // for (let key in ['shape', 'size'])
      //   if (vismel.used[key]) {
      //     if (VisMEL.isSplitMap(aestOld[key]))
      //       aestNew.details.push(aestOld[key]);
      //     else
      //       aestNew.details.push(VisMEL.toSplitMap(aestOld[key]));
      //   }
    }

    biVismel.layout.cols.push(xSplit);
    biVismel.layout.rows.push(ySplit);
    biVismel.layers[0].defaults = vismel.layers[0].defaults.slice();  // reference all existing defaults
    biVismel.layers[0].filters = vismel.layers[0].filters.slice();  // reference all existing filters

    // collect unique fields for density fu
    let splits = PQL.cleanFieldUsages(biVismel.fieldUsages(['aesthetics', 'details', 'layout', 'defaults'], 'include'));
    if(!splits.every(e => (PQL.isSplit(e) || PQL.isFilter(e)) ) )
      throw RangeError("Assertion Error: there should only be splits left");
    let fields4density = _.unique( splits.map(split => split.field) );
    let densityFu = new PQL.Density(fields4density, PQL.DensityMethod.probability);  

    // add density field usage to suitable channel
    if (qc) {
      for (let rc of ['rows', 'cols'])
        if (PQL.hasDiscreteYield(vismel.layout[rc][0]))
          biVismel.layout[rc].push(densityFu)
    } else
      biVismel.layers[0].aesthetics.color = new VisMEL.ColorMap(densityFu, 'lightness');

    return biVismel;
  }


  /**
   * Return a VisMEL query for the data facet.
   *
   * I believe no conversion is necessary.
   *
   * @param vismel
   * @param opts
   */
  function samples(vismel) {
    return vismel;
  }


  return {
    uniDensity,
    biDensity,
    samples,
    ConversionError,
    InvalidConversionError,
  }

});