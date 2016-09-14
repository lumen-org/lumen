/**
 *
 * @module ScaleGenerator
 * @author Philipp Lucas
 */
define(['lib/logger', 'd3', 'lib/colorbrewer', './PQL'], function (Logger, d3, cbrew, PQL) {
  "use strict";

  var logger = Logger.get('pl-ScaleGenerator');
  logger.setLevel(Logger.Debug);

  /**
   * Scale generators return a D3 scale based on a given {@link F.FieldUsage} for a certain visual usage.
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

   */
  scaleGenerator.color = function (colorMap, domain) {
    var colorPalette = [],
      scale = [],
      fu = colorMap.fu;
    switch (fu.yieldDataType) {
      case PQL.FieldT.DataType.num:
        scale = d3.scale.linear();
        // usa poly-linear scale for a good approximation of the implicit color gradient. for that we need to extend the domain to also have 9 values.
        colorPalette = cbrew.Blues["9"]; // attention: if you change the colormap, make sure to also change the 9 in the next line accordingly.
        domain = d3.range(domain[0], domain[1], (domain[1]-domain[0])/(9-1) );
        break;
      case PQL.FieldT.DataType.string:
        scale = d3.scale.ordinal();
        let l = domain.length;
        // colormap
        if (l <= 2) {
          colorPalette = cbrew.Set1[3].slice(0, l);
        } else if (l <= 9) {
          colorPalette = cbrew.Set1[l];
        } else { //if (l <= 12) {
          if (l > 12) {
            logger.warn("the domain of the dimension " + fu.name + " has too many elements: " + l + "\n I'll just use 12, anyway.");
            l = 12;
          }
          colorPalette = cbrew.Paired[l];
        }
        break;
      default: throw new RangeError("invalid Field.dataType: " + fu.dataType);
    }
    return scale.domain(domain).range(colorPalette);
  };


  /**
   * Creates a size scale based on a given {@link FieldUsage}.
   * @param fu {@link FieldUsage}.
   * @returns the created size scale.
   */
  scaleGenerator.size = function (sizeMap, domain) {
    throw new Error("Use scaleGenerator.position for the moment. This one is not implemented yet.");
    // todo: implement this one!?
  };


  /**
   * @param fu
   */
  scaleGenerator.shape = function (shapeMap, domain) {
    let scale = [],
      fu = shapeMap.fu;
    switch (fu.dataType) {
      case PQL.FieldT.DataType.num:
        throw new Error("continuous shapes not yet implemented.");
      case PQL.FieldT.DataType.string:
        scale = d3.scale.ordinal()
          .range(d3.svg.symbolTypes)
          .domain(domain);
        if (domain.length > d3.svg.symbolTypes.length) {
          logger.warn("the domain/extend of '" + fu.name + "' has too many elements. I can only encode " +
            d3.svg.symbolTypes.length + " many. I will 'wrap around'..");
        }
        break;
      default: throw new RangeError("invalid Field.dataType" + fu.dataType);
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
    switch (fu.dataType) {
      case PQL.FieldT.DataType.num:
        // continuous domain
        scale = d3.scale.linear()
          .range(range);
        break;
      case PQL.FieldT.DataType.string:
        // discrete domain: map to center of equally sized bands
        scale = d3.scale.ordinal()
          .rangeRoundPoints(range, 1.0);  // "1.0" makes points centered in their band
        break;
      default: throw new RangeError("invalid Field.dataType" + fu.dataType);
    }
    return scale.domain(domain);
  };

  return scaleGenerator;
});

