/**
 *
 * @module ScaleGenerator
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define(['lib/logger', 'd3', './PQL', './ViewSettings'], function (Logger, d3, PQL, c) {
  "use strict";

  var logger = Logger.get('pl-ScaleGenerator');
  logger.setLevel(Logger.Debug);

  /**
   * Scale generators return a D3 scale based on a given {@link F.FieldUsage} for a certain visual usage.
   *
   * What is a scale? "maps a dimension of abstract data to a visual variable." (https://medium.com/@mbostock/introducing-d3-scale-61980c51545f)
   *
   * It is important to note that the generated scale depends on:
   *   * its role: i.e. is used a dimension or a measure/aggregation. If used as a dimension, its domain values can be used as the scales domain. If it is a measure, the extend of the values of the aggregation must be used as the scales domain.
   *   *  the kind of the field usage, i.e. is it continuous or discrete
   * todo: respect scales and ordering as set in the FUsageT attributes
   * @type {{}}
   */
  var scaleGenerator = {};

  /**
   * Creates a color scale based on a given {@link FieldUsage}.
   * @param fu A {@link FieldUsage}.
   * @returns the created color scale.
   *
   * Color Schemes are chosen as follows:
   *
   *  * domain is discrete:
   *    * if (domain has at most 9 elements): d3.schemeSet1()
   *    * else if (domain has at most 12 elements) d3.schemePaired()
   *
   *  * domain is continuous:
   *    * domain is (almost) exclusively negative or non-negative:
   *       * domain extends (close to) 0: d3.schemeYlOrBr[9] (starting/ending at 0)
   *       * domain extents not to 0:d3.schemeYlOrBr[9] (not including 0)
   *    * domain encloses 0:
   *      * d3.schemeRdBu[9] (or d3.schemeRdYlBu[9] ?) centered on 0!
   */

  scaleGenerator.color = function (colorMap, domain) {
    let fu = colorMap.fu,
      palette,
      scale;

    if (PQL.hasDiscreteYield(fu)) {
      scale = d3.scale.ordinal();
      let l = domain.length;
      if (l <= 9)
        palette = c.colorscales.discrete9;
      else if (l <= 12)
        palette = c.colorscales.discrete12;
      else {
        logger.warn("the domain of the field " + fu.name + " has too many elements to efficiently encode them as categorical colors: " + l + "\n I'll only use 12, anyway.");
        palette = c.colorscales.discrete12;
        //throw new ValueError("too many categories to encode in color");
      }
      palette = palette.slice(0, l);
    }
    else {
      scale = d3.scale.linear();
      let [l,h] = domain,
        size = h-l,
        ext_to_zero = size * 0.25,  // if 25% extension is enough to reach zero, then use sequential, "from-zero" scale
        ext = size*0.05;  // if zero is included, and if less than 5% of range is on one side, then use "from-zero-scale"

      // check if domain is (almost) exclusively negative or non-negative:
      if (h-ext < 0 || l+ext > 0) {
        palette = c.colorscales.sequential;

        // include 0 if closely not included
        if (h < 0 && h+ext_to_zero > 0)
          h = 0;
        if (l > 0 && l-ext_to_zero < 0)
          l = 0;

        // invert palette if all negative
        if (h-ext < 0) {
          palette = palette.slice();
          palette.reverse();
        }
      }
      else {
        palette = c.colorscales.diverging;
        // center scale on 0. Note: it is not necessarily h>0 and l<0 (but almost. See above)
        if (Math.abs(h) > Math.abs(l))
          l = -Math.abs(h);
        else
          h = Math.abs(l);
      }

      // adopt domain
      let cnt = palette.length;
      let step = (h-l)/(cnt-1);
      domain = d3.range(cnt).map(d => l + d*step);
    }
    return scale.domain(domain).range(palette);
  };

  /**
   * Creates a size scale based on a given {@link FieldUsage}.
   * @param fu {@link FieldUsage}.
   * @returns the created size scale.
   */
  scaleGenerator.size = function (sizeMap, domain, range) {
    let scale = [],
      fu = sizeMap.fu;
    switch (fu.yieldDataType) {
      case PQL.FieldT.DataType.num:
        // continuous domain
        scale = d3.scale.linear().range(range);
        break;
      case PQL.FieldT.DataType.string:
        // discrete domain: map to center of equally sized bands
        scale = d3.scale.ordinal().rangePoints(range, 1.0);  // "1.0" makes points centered in their band
        break;
      default: throw new RangeError("invalid yieldDataType: " + fu.yieldDataType);
    }
    return scale.domain(domain);
  };


  /**
   * @param fu
   * @param mode Either 'filled' (filled shapes) or 'open' (non-filled shapes).
   */
  scaleGenerator.shape = function (shapeMap, domain, mode='filled') {
    let scale = [],
      fu = shapeMap.fu;
    switch (fu.yieldDataType) {
      case PQL.FieldT.DataType.num:
        throw new RangeError("continuous shapes not yet implemented.");
      case PQL.FieldT.DataType.string:
        scale = d3.scale.ordinal()
          // .range(d3.svg.symbolTypes)
          .range(c.shapes[mode])
          .domain(domain);
        if (domain.length > d3.svg.symbolTypes.length) {
          logger.warn("the domain/extend of '" + fu.name + "' has too many elements. I can only encode " +
            d3.svg.symbolTypes.length + " many. I will 'wrap around'..");
        }
        break;
      default: throw new RangeError("invalid Field.yieldDataType: " + fu.yieldDataType);
    }
    return scale;
  };

  /**
   * Creates a 'positional' scale based on given field usage and desired range.
   * @param fu A {@link FieldUsage}.
   * @param range
   */
  scaleGenerator.position = function (fu, domain, range) {
    var scale = [];
    switch (fu.yieldDataType) {
      case PQL.FieldT.DataType.num:
        // continuous domain
        scale = d3.scale.linear().range(range);
        break;
      case PQL.FieldT.DataType.string:
        // discrete domain: map to center of equally sized bands
        //scale = d3.scale.ordinal().rangeRoundPoints(range, 1.0);  // "1.0" makes points centered in their band
        scale = d3.scale.ordinal().rangePoints(range, 1.0);  // "1.0" makes points centered in their band
        break;
      default: throw new RangeError("invalid Field.dataType: " + fu.yieldDataType);
    }
    return scale.domain(domain);
  };

  /**
   * Turns a d3 color scale (i.e. essentially a function mapping input data to output color) on a numerical scale into an array of 2-elements-arrays: normalized-number to color.
   *
   * This is needed to transform d3 scales into plotly-compatible color scales.
   *
   * Note: it only works for continuous scales!
   *
   * @param scale The d3 color scale.
   * @param n number of elements in the output array. Defaults to 8.
   * @param min Minimum value to convert. Defaults to the minimum of the domain of scale.
   * @param max Maximum value to convert. Defaults to the maximum of the domain of scale.
   */
  scaleGenerator.asTable = function (scale, n=8, min=undefined, max=undefined) {
    if (min === undefined || max === undefined) {
      let domain = scale.domain();
      if (min === undefined) min = domain[0];
      if (max === undefined) max = domain[domain.length-1];
    }
    if (max <= min) throw RangeError("max must be larger than min");
    if (n < 2) throw RangeError("n must be at least 2");
    let cur = min,
      step = (max-min) / (n-1),
      normStep = 1 / (n-1),
      table = [];
    for(let i=0; i<n; ++i) {
      table.push([normStep*i, scale(cur)]);
      cur += step;
    }
    return table;
  };

  return scaleGenerator;
});

