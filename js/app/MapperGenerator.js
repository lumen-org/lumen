/**
 * @module MapperGenerator
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 *
 * Generators for mappers of visual variables used in var. Mappers are function that map data item to visual attributes, like a svg path, color, size and others.
 *
 * Before mappers can be set up, the scales need to be set up. See attachScales().
 *
 * Mappers differ from scales, as scales are always functions that take a data item as input and return the value of a visual variable. Mappers can be either a function (the scale) or a scalar value. Moreover, mappers can handle interval input, while scales cannot.
 *
 * If the mapper is a function, than the underlying d3 scale is exposed via the .scale attribute.
 *
 * Also, mappers are for a more specific means (such as coloring the points of the aggregation visualization), whereas scales are attached to the BaseMaps of a query itself.
 */
define(['lib/logger', './PQL', './VisMEL', './ScaleGenerator', './ViewSettings'], function (Logger, PQL, VisMEL, ScaleGen, c) {
  "use strict";

  var logger = Logger.get('pl-MapperGenerator');
  logger.setLevel(Logger.Debug);

  function _valueOrAvg(val) {
    return _.isArray(val) ? val[0] + val[1] / 2 : val;
  }

  function _averaged(scale, hasDiscreteDomain=false) {
    // if the scale works on a discrete domain, we anyway can never average
    if (hasDiscreteDomain) {
      scale.scale = scale;
      return scale;
    } else {
      let mapper = d => scale(_valueOrAvg(d));
      mapper.scale = scale;
      return mapper;
    }
  }

  let gen = {};

  gen.markersFillColor = function (query, mode='aggr') {
    let defaultColor;
    if (mode === 'aggr')
      defaultColor = c.map.aggrMarker.fill.def;
    else if (mode === 'training data')
      defaultColor = c.map.sampleMarker.fill.def;
    else if (mode === 'test data')
      defaultColor = c.map.testDataMarker.fill.def;
    else if (mode === 'model samples')
      defaultColor = c.map.modelSampleMarker.fill.def;
    else
      throw RangeError("invalid mode " + mode);

    let aesthetics = query.layers[0].aesthetics,
        color = aesthetics.color;
    if (color instanceof VisMEL.ColorMap) {
      return _averaged(ScaleGen.color(color, color.fu.extent, mode));
    } else {
      return defaultColor;
    }
  };

  gen.aggrFillColor = function (query, defaultColor=c.map.sampleMarker.fill.def) {
    let aesthetics = query.layers[0].aesthetics,
        color = aesthetics.color;
    if (color instanceof VisMEL.ColorMap) {
      return _averaged(ScaleGen.color(color, color.fu.extent));
    } else {
      return defaultColor;
    }
  };


  gen.markersSize = function (query, opts) {
    let aesthetics = query.layers[0].aesthetics,
        size = aesthetics.size;
    if (size instanceof VisMEL.SizeMap) {
      return _averaged(ScaleGen.size(size, size.fu.extent, [opts.min, opts.max]));
    } else {
      return opts.def;
    }
  };

  gen.markersShape = function (query, mode) {
    if (!['filled', 'open', 'svgPath', 'model samples', 'training data', 'test data'].includes(mode))
      throw RangeError("mode must be ''model samples', 'training data', 'test data', but is: " + mode.toString());
    let aesthetics = query.layers[0].aesthetics,
        shape = aesthetics.shape;
    if (shape instanceof VisMEL.ShapeMap) {
      return _averaged(ScaleGen.shape(shape, shape.fu.extent, 'filled'));
    } else {
      if (mode === 'model samples')
        return c.map.aggrMarker.shape.def;
      else if (mode === 'test data')
        return c.map.testDataMarker.shape.def;
      else if (mode === 'training data')
        return c.map.sampleMarker.shape.def;
      else
        throw new RangeError("invalid mode");
    }
  };

  /**
   * What is the color of a line?
   * if split on color:
   *   if discrete split: each line gets uniform color anyway
   *   else: color of the average value of the extent
   * else if aggregation or density on color):
   *   if discrete yield: make line grey, since different points will have very different colors, since we use a categorical scale.
   *   else: color of the average value of the extent
   * else:
   *   some default color
   */
  gen.lineColor = function (query) {
    let aesthetics = query.layers[0].aesthetics,
        color = aesthetics.color;

    if (color instanceof VisMEL.ColorMap) {
      let fu = color.fu,
          scale = ScaleGen.color(color, fu.extent);
      if (PQL.isSplit(fu)) {
        if (PQL.hasDiscreteYield(fu))
          return _averaged(scale);  // compute on demand
        else
          return scale(_valueOrAvg(fu.extent));  // scalar value
      } else {
        // aggregation or density
        if (PQL.hasDiscreteYield(fu))
          return c.map.aggrMarker.line.color; // TODO: we could color the line different from grey, if all markers on the line have same hue
        else
          return scale(_valueOrAvg(fu.extent));
      }
    } else {
      return c.map.aggrMarker.line.color;
    }

  };

  /**
   * See also gen.lineColor.
   *
   * Generates a mapper for the color of the lines/bars in the 1d marginal density plots.
   *
   * There are the following cases:
   *   * Color is not used: return undefined. The value undefined indicates that we should use the default value for marginal densities. However, the exact value depends on other things that we can only know later.
   *   * Color is used: (discrete or not) we encode it accordingly
   *   * OLD (breaks new semantic): Color is used by a FieldUsage that has discrete yield: We will split the bars/lines by the discrete outcomes of that aggregation/split and encode them differently to allow visual distinction.
   *
   * @param query A VisMEL query.
   */
  gen.marginalColor = function (query, mode) {
    let color = query.layers[0].aesthetics.color;
    if (color instanceof VisMEL.ColorMap) {
      let fu = color.fu;
      let scale = ScaleGen.color(color, fu.extent, mode);
      return _averaged(scale);
    } else {
      if (mode === 'training data')
        return c.colors['training data'].marginal;
      else if (mode === 'test data')
        return c.colors['testData'].marginal;
      else if (mode === 'model marginal')
        return c.colors['modelSamples'].marginal;
      else
        throw RangeError(`invalid mode: ${mode}`)
    }
    // OLD: return c.map.uniDensity.color.def;
  };

  return gen;
});

