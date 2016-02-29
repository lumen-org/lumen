/**
 *
 * @module ScaleGenerator
 * @author Philipp Lucas
 */
define(['lib/logger', 'd3', 'lib/colorbrewer', './Field'], function (Logger, d3, cbrew, F) {
  "use strict";

  var logger = Logger.get('pl-ScaleGenerator');
  logger.setLevel(Logger.Debug);

  // todo: all the other aesthetics

  /**
   * Scale generators return a D3 scale based on a given {@link F.FieldUsage} for a certain visual usage.
   * It is important to note that the generated scale depends on:
   *   * its role: i.e. is used a dimension or a measure/aggregation. If used as a dimension, its domain values can be used as the scales domain. If it is a measure, the extend of the values of the aggregation must be used as the scales domain.
   *   *  the kind of the field usage, i.e. is it continuous or discrete
   * @type {{}}
   */
  var scaleGenerator = {};

  /**
   * Creates a color scale based on a given {@link FieldUsage}.
   * @param fu A {@link FieldUsage}.
   * @returns the created color scale.
   * todo: respect scales and ordering as set in the FUsageT attributes
   */
  scaleGenerator.color = function (fu, domain) {
    var colormap = [],
      scale = [];
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        scale = d3.scale.linear();
        colormap = cbrew.Blues["9"];
        break;
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal();
        let l = domain.length;
        // colormap
        if (l <= 2) {
          colormap = cbrew.Set1[3].slice(0, l);
        } else if (l <= 9) {
          colormap = cbrew.Set1[l];
        } else { //if (l <= 12) {
          if (l > 12) {
            logger.warn("the domain of the dimension " + fu.name + " has too many elements: " + l + "\n I'll just use 12, anyway.");
            l = 12;
          }
          colormap = cbrew.Paired[l];
        }
        break;
      default: throw new TypeError("invalid Field.Kind" + fu.kind);
    }
    //return scale.range(colormap).domain(fu.extent);
    return scale.range(colormap).domain(domain);
  };


  /**
   * Creates a size scale based on a given {@link FieldUsage}.
   * @param fu {@link FieldUsage}.
   * @returns the created size scale.
   */
  scaleGenerator.size = function (fu, domain) {
    throw new Error("Use scaleGenerator.position for the moment. This one is not implemented yet.");
    // todo: implement this one!?
  };


  /**
   * @param fu
   */
  scaleGenerator.shape = function (fu, domain) {
    var scale = [];
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        throw new Error("continuous shapes not yet implemented.");
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal()
          .range(d3.svg.symbolTypes)
          .domain(domain);
          //.domain(fu.extent);
        if (domain.length > d3.svg.symbolTypes.length) {
          logger.warn("the domain/extend of '" + fu.name + "' has too many elements. I can only encode " +
            d3.svg.symbolTypes.length + " many. I will 'wrap around'..");
        }
        break;
      default: throw new TypeError("invalid Field.Kind" + fu.kind);
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
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        // continuous domain: todo: map according to FUsageT.Scale attribute
        scale = d3.scale.linear()
          .range(range);
        break;
      case F.FieldT.Kind.discrete:
        // categorial domain: map to center of equally sized bands
        scale = d3.scale.ordinal()
          .rangeRoundPoints(range, 1.0);  // "1.0" makes points centered in their band
        break;
      default:
        throw new TypeError("invalid Field.Kind: " + fu.kind);
    }
    return scale.domain(domain);
  };

  return scaleGenerator;
});