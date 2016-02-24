/**
 * @module ScaleGenerator
 * @author Philipp Lucas
 */
define(['lib/logger', 'd3', 'lib/colorbrewer', './Field'], function (Logger, d3, cbrew, F) {
  "use strict";

  var logger = Logger.get('pl-ScaleGenerator');
  logger.setLevel(Logger.Debug);

  // todo: all the other aesthetics

  var scaleGenerator = {};

  /**
   * Creates a color scale based on a given {@link FieldUsage}.
   * @param fu A {@link FieldUsage}.
   * @returns the created color scale.
   * todo: respect scales and ordering as set in the FUsageT attributes
   */
  scaleGenerator.color = function (fu) {
    // the following is how I think this may be done for the color mapping.
    var colormap = [],
      scale = [];
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        colormap = cbrew.Blues["9"];              
        scale = d3.scale.linear().domain(fu.domain);
        // todo: adjust for domain class usage: 
        //scale = d3.scale.linear().domain([fu.domain.l, fu.domain.h]);
        break;
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal();
        let domainValues = fu.split(true);
        let l = domainValues.length;

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

        // domain values
        scale.domain(domainValues);

        break;
      default:
        throw new TypeError("invalid Field.Kind" + fu.kind);
    }
    return scale.range(colormap);
  };


  /**
   * Creates a size scale based on a given {@link FieldUsage}.
   * @param fu {@link FieldUsage}.
   * @returns the created size scale.
   */
  scaleGenerator.size = function (fu) {
    throw new Error("Use scaleGenerator.position for the moment. This one is not implemented yet.");
    // todo: implement this one!?
  };


  /**
   * todo: document
   * @param fu
   */
  scaleGenerator.shape = function (fu) {
    var scale = [];
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        throw new Error("continuous shapes not yet implemented.");
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal()
          .range(d3.svg.symbolTypes);
        scale.domain(fu.split(true));
        if (fu.domain.length > d3.svg.symbolTypes.length) {
          logger.warn("the domain of '" + fu.name + "' has too many elements. I can only encode " +
            d3.svg.symbolTypes.length + " many. I will 'wrap around'..");
        }
        break;
      default:
        throw new TypeError("invalid Field.Kind" + fu.kind);
    }
    return scale;
  };


  /**
   * Creates a 'positional' scale based on given field usage and desired range.
   * @param fu A {@link FieldUsage}.
   * @param range
   */
  scaleGenerator.position = function (fu, range) {
    var scale = [];
    switch (fu.kind) {
      case F.FieldT.Kind.cont:
        // continuous domain: todo: map according to FUsageT.Scale attribute
        scale = d3.scale.linear()
          .domain(fu.domain)
          .range(range);
        break;
      case F.FieldT.Kind.discrete:
        // categorial domain: map to center of equally sized bands
        scale = d3.scale.ordinal()
          .domain(fu.split(true))
          .rangeRoundPoints(range, 1.0);  // "1.0" makes points centered in their band
        break;
      default:
        throw new TypeError("invalid Field.Kind: " + fu.kind);
    }
    return scale;
  };

  return scaleGenerator;
});