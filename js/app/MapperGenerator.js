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

  function _averaged(scale) {
    let mapper = d => scale(_valueOrAvg(d));
    mapper.scale = scale;
    return mapper;
  }

  let gen = {};

  gen.markersFillColor = function (query) {
    let aesthetics = query.layers[0].aesthetics,
      color = aesthetics.color;
    if (color instanceof VisMEL.ColorMap) {
      return _averaged(ScaleGen.color(color, color.fu.extent));
    } else {
      return "#377eb8";
    }
  };

  gen.markersSize = function (query) {
    let aesthetics = query.layers[0].aesthetics,
      size = aesthetics.size;
    if (size instanceof VisMEL.SizeMap) {
      return _averaged(ScaleGen.size(size, size.fu.extent, [5, 40]));
    } else {
      return 8;  //TODO: put into Settings
    }
  };

  gen.markersShape = function (query, mode = 'filled') {
    let aesthetics = query.layers[0].aesthetics,
      shape = aesthetics.shape;
    if (shape instanceof VisMEL.ShapeMap) {
      return _averaged(ScaleGen.shape(shape, shape.fu.extent, mode));
    } else {
      return "circle" + (mode === 'open' ? '-open' : "");
    }
  };

  /** What is the color of a line?
   * if split on color:
   *   if discrete split: each line gets uniform color anyway
   *   else: color of the average value of the extent
   * else if aggregation or density on color):
   *   if discrete yield: make line grey, since different points will have very different colors, since we use a categorical scale.
   *   else: color of the average value of the extent
   * else:
   *   some default color
   *
   * @param mode: Either 'main' (for a line in the main plot) or 'marginal' (for a line in the marginal plots'). Defaults to 'main'.
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
          return "grey"; //TODO: put into Settings
        else
          return scale(_valueOrAvg(fu.extent));
      }
    } else {
      return "#377eb8";  // TODO: put into Settings
    }
  };

  /**
   * See also gen.lineColor.
   *
   * Generates a mapper for the color of the lines/bars in the 1d marginal density plots.
   *
   * Note that there is a bit of "inconsistency": the passed in VisMEL query is the query for the main plot,
   * and only implicitly describes the marginal plot. In particular, only splits on color are respected, not aggregations (as they are not represented).
   *
   * @param query A VisMEL query.
   */
  gen.marginalColor = function (query) {
    let color = query.layers[0].aesthetics.color;
    if (color instanceof VisMEL.ColorMap) {
      let fu = color.fu;
      if (PQL.isSplit(fu)) {
        let scale = ScaleGen.color(color, fu.extent);
        if (PQL.hasDiscreteYield(fu))
          return _averaged(scale);  // compute on demand
        else
          return scale(_valueOrAvg(fu.extent));  // scalar value, namely color for the average of the domain.
      }
    }
    return c.map.uniDensity.color.def;
  };

  return gen;
});

