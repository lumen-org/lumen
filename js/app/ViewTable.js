/**
/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * Axis coupling / anchoring:
 *   Certain axes should zoom together, such that the visualization stays comparable at all times. Here, we apply the following schema:
 *     * marginal axes have fixed ranges: there is no need to zoom into them. In contrary, doing so accidentally distracts the user.
 *     * all main axis that encode the same dimension (i.e. the corresponding FieldUsage has the same yield) are anchored.
 *
 *   Note: this is just about spatial axis anchoring.
 *
 * Extents:
 *
 *   For visualization the extents over _all_ result tables are required, as we need uniform
 *   extents over all atomic panes for a visually uniform visualization. More specifically, we want the global
 *   extent with respect to a particular 'yield'. Here 'yield' means the dimension that a FieldUsage (or BaseMap)
 *   yields when a query is processed.
 *   
 *   We attach extents to the FieldUsages of the queries under the attribute .extent.
 *   
 *   As FieldUsages of atomic queries are
 *   inherited from templated query, extents are also available at the atomic query.
 *   
 *   Note that extents may take different forms:
 *    - single value (discrete FU)
 *    - interval (continuous FU), or
 *    - set of single values (discrete FU, where the splitting functions splits not into single values but sets of values).
 *   
 *   For discrete {@link FieldUsage}s the extent is the set of unique values / tuple of values that occurred in the results for this particular {@link FieldUsage}. Tuple are not reduced to their individual values.
 *   
 *   For continuous {@link FieldUsage}s the extent is the minimum and maximum value that occurred in the results of this particular {@link FieldUsage}, wrapped as an 2-element array. Intervals are reduced to their bounding values.
 *   
 *   Note: you cannot use the .extent or .domain of any FIELD (not field usage) of any field usage that the vismel queries consists of. The reason is two fold:
 *     (1) they have a different semantic, namely .extent stores a 'meaningful' range of values where the density function is considerably larger than 0, and .domain stores the allowed domain of the dimension of that model.
 *     (2) these values are not updated as a result of query answering. That is because the queries all refer to Fields of some model instance. And that model instance is never actually changed. Instead new models are created on both the remote and local side.
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', 'd3legend', './PQL', './VisMEL', './MapperGenerator', './ViewSettings', './TraceGenerator'],
  function (Logger, d3, d3legend, PQL, VisMEL, MapperGen, config, TraceGen) {
    "use strict";

    var logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    function _invXY(xy) {
      return (xy === 'x'?'y':'x');
    }

    /**
     * Builds and returns a formatter for this result table.
     * You can format any likewise structured data by passing it as the single argument to the returned formatter.
     *
     * @param rt
     * @return
     */
    function resultTableFormatter(rt) {

      let rtNames = rt.idx2fu.map(fu => fu.yields);

      let formatter = rt.idx2fu.map(fu => {
        if (PQL.hasDiscreteYield(fu)) {
          return o => o.toString();  // no need for any special formatting
        } else if (PQL.hasNumericYield(fu)) {
          return d3.format(".3f");
        } else {
          throw RangeError("invalid yield type");
        }
      });

      return (data) =>
        data.map(item =>
          d3.range(item.length).map(
            i => rtNames[i] + ": " + formatter[i](item[i])
          ).join('<br>')
        );
    }


    /**
     * Given a split returns a nicely formatted string representation of the splits extent, i.e. a string for each element of the extent array.
     *
     * TODO: actually, this is more general: we need a formatter for each data type, and there is essentially these types: string, number, array of string, interval of numbers, and in the future: data, ...
     */
    function splitExtentToString (split) {

      if (split.extent === undefined)
        throw RangeError("you must set the extent of a split before calling this function.");

      // setup formatter
      let numFormatter = d3.format(".1f"),
        formatter = undefined;
      if (PQL.hasDiscreteYield(split))
        formatter = v => v.toString();
      else if (PQL.hasNumericYield(split))
        if (split.method === PQL.SplitMethod.equiinterval)
          formatter = (v) => "[" + v.map(numFormatter).join(", ") + "]";
        else
          formatter = numFormatter;

      // apply
      return split.extent.map(formatter);
    }

    /**
     * Utility function. Generates an object with attribtues .range, .tickmode and .tickvals, essentially being a
     * template for an plotly axis.
     * @param extent
     * @param xy
     * @param cfg
     * @returns {{}}
     */
    function getRangeAndTickMarks(extent, xy, cfg={linePrct:0.8, maxPrct:1.2}) {
      let axis = {};
      axis.range = [0, extent[1]*cfg.maxPrct];
      if (config.plots.marginal.position[_invXY(xy)] === 'bottomleft') // reverse range if necessary reversed range
        axis.range = axis.range.reverse();
      axis.tickmode = "array"; // use exactly 2 ticks as I want:
      axis.tickvals = [0, (extent[1] * cfg.linePrct).toPrecision(1)]; // draw a line at 0 and ~maxPrct%
      return axis
    }


    function atomicPlotlyTraces(aggrRT, dataRT, testDataRT, p1dRT, p2dRT, vismel, mainAxis, marginalAxis, catQuantAxisIds, queryConfig) {
      // attach formatter, i.e. something that pretty prints the contents of a result table
      for (let rt of [aggrRT, dataRT, testDataRT, p2dRT].concat(p1dRT === undefined ? [] : [p1dRT.x, p1dRT.y]))
        if (rt !== undefined)
          rt.formatter = resultTableFormatter(rt);

      let traces = [],
        aest = vismel.layers[0].aesthetics,
        xfu = vismel.layout.cols[0],
        yfu = vismel.layout.rows[0];

      // attach to query object, so we can reuse it internally
      let used = vismel.usages();
      vismel.used = used;

      // build all mappers
      let mapper = {};
      if (aggrRT !== undefined) {
        let aggrVismel = aggrRT.vismel;
        mapper.aggrFillColor = MapperGen.markersFillColor(aggrVismel, 'aggr');
        mapper.aggrSize = MapperGen.markersSize(aggrVismel, config.map.aggrMarker.size);
        mapper.aggrShape = MapperGen.markersShape(aggrVismel, 'filled');
        mapper.lineColor = MapperGen.lineColor(aggrVismel);
      }

      if (dataRT !== undefined || testDataRT !== undefined) {
        let dataVismel = (dataRT !== undefined ? dataRT.vismel : testDataRT.vismel);
        mapper.samplesShape = MapperGen.markersShape(dataVismel, 'filled');
        mapper.samplesSize = MapperGen.markersSize(dataVismel, config.map.sampleMarker.size);
        if (dataRT !== undefined)
          mapper.dataFillColor = MapperGen.markersFillColor(dataVismel, 'data');
        if (testDataRT !== undefined)
          mapper.testDataFillColor = MapperGen.markersFillColor(dataVismel, 'test data');
      }

      if (p1dRT !== undefined) {
          let pvismel = ('x' in p1dRT ? p1dRT.x : p1dRT.y).vismel;
          mapper.marginalColor = MapperGen.marginalColor(pvismel);
      }

      // TODO: we will have color for p2dRT in the future - maybe.
      // if (p2dRT != undefined) { ... }

      // TODO:
      // if there is an aggregation on color in the original vismel query:
      // this aggr is turned to a split for p1drt and p2drt, but both result in a value of the same dimension
      // we should really have an extent per yield dimension!

      // choose a neat chart type depending on data types

      // both, x and y axis are in use
      if (used.x && used.y) {

        let xDiscrete = PQL.hasDiscreteYield(xfu),
          yDiscrete = PQL.hasDiscreteYield(yfu),
          xSplit = PQL.isSplit(xfu),
          ySplit = PQL.isSplit(yfu);

        // x and y are numerical
        if (!xDiscrete && !yDiscrete) {

          // x and y are independent
          if (xSplit && ySplit) {

            if (used.color & !PQL.isSplit(aest.color.fu) && !used.shape && !used.size && !used.details) {
              //&& PQL.hasNumericYield(aest.color.fu)) {
              // -> heatmap
              traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
              // traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggrHeatmap(aggrRT, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
              traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
              //traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
            }
            else { // if (used.shape) {
              // scatter plot
              // TODO: unterscheide weiter ob use.size? siehe http://wiki.inf-i2.uni-jena.de/doku.php?id=emv:visualization:default_chart_types
              traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
              traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis));
              traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, queryConfig));
              traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
              traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
              traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
            }

          }
          // at least on is dependent -> line chart
          else {
            traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
            traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis));
            traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, queryConfig));
            traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
            traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
            traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
          }
        }

        //  x and y are discrete
        else if (xDiscrete && yDiscrete) {
          traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis/*, config.marginalColor.single*/));

          // hard to show splits of more than rows and cols: overlap in visualization
          // TODO: solve by creating a bubble plot/jittered plot

          // hard to show samples in this case: major overlap in visualization.
          // TODO: solve by creating a bubble plot/jittered plot

          // non-discrete yield on color?
          if (used.color && !PQL.hasDiscreteYield(aest.color.fu)
            // TODO: the next line is new, test it! should disallow other splits
            && !PQL.isSplit(aest.color.fu) && !used.shape && !used.size && !used.details) {
            // don't show bi density in this case
            traces.push(...TraceGen.aggrHeatmap(aggrRT, mapper, mainAxis));
          }
          else {
            // TODO: make it a jittered plot?
            traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis));
            traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
          }
        }

        // one is discrete, the other numerical
        else {
          traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis/*, config.marginalColor.single*/));
          traces.push(...TraceGen.biQC(p2dRT, mapper, mainAxis, catQuantAxisIds));
          traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, queryConfig));
          traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
          traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
          traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
        }
      }

      // only one of x-axis and y-axis is in use
      else if (used.x && !used.y || !used.x && used.y) {
        let [xOrY, axisFu] = used.x ? ['x', xfu] : ['y', yfu];
        traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
        // the one in use is categorical
        if (PQL.hasDiscreteYield(axisFu)) {
          // anything special here to do?
        }
        // the one in use is numeric
        else if (PQL.hasNumericYield(axisFu)) {
          traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, queryConfig));
        } else
          throw RangeError("axisFU has invalid yield type: " + axisFu.yieldDataType);
        traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
        traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
        traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
      } else {
        traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
      }

      return traces;
    }

    /**
     * Utility function. Takes the "so-far extent", new data to update the extent for and a flag that informs about the kind of data: discrete or continuous.
     * Note: it gracefully forgives undefined arguments in extent and newData
     * @returns The updated extent
     */
    function _extentUnion(extent, data, discreteFlag) {
      if (extent === undefined) extent = [];
      if (data === undefined) data = [];
      if (discreteFlag === true)
        return _.union(extent, data)
      else if (discreteFlag === false)
        return d3.extent([...extent, ...data])
      throw RangeError("discreteFlag must be true or false, but is: " + discreteFlag.toString());
    }

    /**
     * Adds the extent of a result tables <rt> to the global extent. By construction all pql queries
     * share object-identical field usages, whenever appropriate.
     * @param rt A result tables. See ResultTable.js to understand result tables.
     * @param globalExtent A map of field usages to their global extents.
     * @return {Map} The modified global extent maps.
     */
    function addResultTableExtents (rt, globalExtent) {
      if (rt === undefined)
        return globalExtent;
      for (let [fu, idx] of rt.fu2idx.entries()) {
        let discreteFlag = PQL.hasDiscreteYield(fu);
        globalExtent.set(fu, _extentUnion(globalExtent.get(fu), rt.extent[idx], discreteFlag))
      }
      return globalExtent;
    }

    /**
     * Adds the extent of the result tables in collection <coll> to the global extent. By construction all pql queries
     * share object-identical field usages, whenever appropriate.
     * @param coll A collection of result tables. See ResultTable.js to understand result tables.
     * @param globalExtent A map of field usages to their global extents.
     * @param attr The attribute of each entry in the collection where to attach the globelExtent.
     * @return {Map} The modified global extent maps.
     */
    function addCollectionExtents (coll, globalExtent, attr=undefined) {
      let size = coll.size;
      for (let rIdx = 0; rIdx < size.rows; ++rIdx)
        for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
          let rt = coll[rIdx][cIdx];
          if (attr === undefined)
            addResultTableExtents(rt, globalExtent);
          else {
            if (rt === undefined)
              continue;  // rt is undefined if neither of the marginals are in use
            addResultTableExtents(rt[attr], globalExtent);
          }
        }
          
      return globalExtent;
    }

    /**
     * For each key in <globalExtent> (i.e. a FieldUsage) add its value (i.e. the global extent of that FieldUsage) to the key as the attribute .extent.
     * @param fuExtent A Map of FieldUsages to their global extents.
     */
    function attachToFieldUsages(fuExtent) {
      for (let [fu, extent] of fuExtent.entries())
        fu.extent = extent;
    }

    function normalizeExtents (fuExtent) {
      for (let [fu, extent] of fuExtent.entries())
        if (PQL.hasNumericYield(fu))
          fuExtent.set(fu, normalizeContinuousExtent(extent));
    }


    function getGlobalExtent (aggrColl, dataColl, testDataColl, biColl, uniColl) {
      let globalExtent = new Map();
      for (let obj of [aggrColl, dataColl, testDataColl, biColl])
        addCollectionExtents(obj, globalExtent);
      for (let xy of ['x', 'y'])
        addCollectionExtents(uniColl, globalExtent, xy);
      return globalExtent;
    }


    /**
     * Converts a Map of FieldUsages to their extents to a Map of their yields to their extents.
     * @param fuExtent
     * @returns {Map<any, any>}
     */
    function getYieldExtent (fuExtent) {
      let yieldExtent = new Map();
      for (let [fu, extent] of fuExtent.entries()) {
        let name = fu.yields;
        let soFarExtent = yieldExtent.get(name);
        let updatedExtent = _extentUnion(soFarExtent, extent, PQL.hasDiscreteYield(fu));
        yieldExtent.set(name, updatedExtent);
      }
      return yieldExtent;
    }

    /**
     * Updates the mapping of FieldUsages to their extents based on the yieldExtents (which are based on yield dimensions)
     * @param fuExtent
     * @param yieldExtent
     * @returns {*}
     */
    function updateWithYieldExtent (fuExtent, yieldExtent) {
      for (let fu of fuExtent.keys())
        fuExtent.set(fu, yieldExtent.get(fu.yields))
      return fuExtent;
    }

    /**
     * Tweaks the given (continuous) extents of a given FieldUsage (for nicer displaying).  Note that it modifies the provided extent _and_ returns the modfied extent!
     * (1) non-singular extent: add pct*extent to upper and lower bound of extent
     * (2) singular extent and singular !== 0: upper = singular+pct*singular, lower = singular-pct*singular
     * (3) singular extent and singular === 0: upper = 1 , lower = -1
     * @param extent
     * @param pct percentage to add/substract. See above.
     */
    function normalizeContinuousExtent(extent, pct=0.05) {
      if (extent[0] === extent[1]) { // if singular
        let singular = extent[0];
        if (singular === 0) {
          extent[0] = -1;
          extent[1] =  1;
        }
        else {
          extent[0] = singular - pct * singular;
          extent[1] = singular + pct * singular;
        }
      } else {
        let relOff = pct * (extent[1] - extent[0]);
        extent[0] -= relOff;
        extent[1] += relOff;
      }
      return extent;
    }

    /**
     * Returns the split usages that make up templating axis level splits, from outermost to innermost templating axis split.
     * @fus the stack of field usages that make up the templating axes
     */
    function getLevelSplits(fus) {
      let levelSplits = fus.filter(PQL.isSplit);
      if (!fus.some(PQL.isAggregationOrDensity))
        levelSplits.pop();
      return levelSplits;
    }

    /**
     * @xy 'x' ('y') if its an x-axis (y-axis)
     * @offset: .x (.y) is the offset in normalized coordinates for the templating axes
     * @size: .x (.y) is the size in normalized coordinates for the templating axes
     * @fus the stack of field usages that make up the templating axes
     * @id .x (.y) is the first free axis integer index for x (y) axis
     * @returns {} An array of axis objects for the layout part of a plotly plot configuration.
     */
    function createTemplatingAxis(xy, offset, size, fus, id) {
      let yx = _invXY(xy);

      // the number of stacked axis equals the number of splits in fus, reduced by one if there is no aggregation/density (since the last split then is part of an atomic plots axes)
      let levelSplits = getLevelSplits(fus);

      // available height (if xy === x) (width if xy === y) per axis level
      let levelSize = size[yx] / levelSplits.length;
      let axes = {}; // object of plotly axes objects
      let annotations = []; // annotations for level titles
      let repeat = 1;

      levelSplits.forEach((split, d) => {
        let stackOffset = offset[yx] + levelSize * d; // the y (x) offset of axes in this level (this is identical for all axis of this level)
        let majorLength = size[xy] / repeat; // the width (height) of (a single) major axes in this level
        let minorId = id[yx]++;

        // only one minor axis per stack level is needed
        let anchor = xy + id[xy]; // anchor with the first major of this level (to be generated)
        let minor = config.axisGenerator.templating_minor(stackOffset, levelSize, anchor);

        // multiple major axis are needed
        let ticks = split.extent;
        for (let r = 0; r < repeat; ++r) {

          let majorId = id[xy]++,
            majorOffset = offset[xy] + majorLength*r;

          // new major axis (i.e. x axis for xy === x)
          axes[xy + 'axis' + majorId] = config.axisGenerator.templating_major(majorOffset, majorLength, splitExtentToString(split), yx + minorId);
        }

        repeat *= ticks.length;
        axes[yx + 'axis' + minorId] = minor;

        // add title once per level
        let annotation = config.annotationGenerator.axis_title(split.yields, xy, offset[xy], size[xy], stackOffset);
        //let annotation = config.annotationGenerator.axis_title(split.yields, xy, offset[xy], size[xy], 0);
        annotations.push(annotation);
      });

      return [axes, annotations];
    }

    /**
     * Using annotations to title templating axis:
     *
     * Templating axis need only one titel per level, however the axes themselves may be duplicated several times within one level. Moreover we cannot control where exactly normal titles are shown. Hence we use annotations to generate proper per-level-titles for them.
     *
     * For a x-axis (analogous for y-axis):
     *
     *  * horizontal position: relative to canvas and 100% to the right (whatever width the templating level has)
     *  * vertical position: relative to y-axis of that level and at position 0 (it has range [0,1])
     */


    /**
     * A ViewTable takes data collections and a query collection and turns it into an actual visual representation.
     * This visualization is attached to the DOM within the given pane <div> object.
     *
     * A ViewTable is a table of ViewPanes. Each ViewPane represents a single cell of the table.
     *
     * @param pane A <div> element. This must already have a width and height.
     * @param aggrColl The {@link Collection} of predictions to visualize.
     * @param dataColl The {@link Collection} of training data to visualize.
     * @param testDataColl The {@link Collection} of test data to visualize.
     * @param uniColl The {@link Collection} of marignal probability values to visualize.
     * @param biColl The {@link Collection} of probability values to visualize.
     * @constructor
     * @alias module:ViewTable
     */
    var ViewTable;
    ViewTable = function (pane, aggrColl, dataColl, testDataColl, uniColl, biColl, vismelColl, queryConfig) {

      this.aggrCollection = aggrColl;
      this.dataCollection = dataColl;
      this.testDataCollection = testDataColl;
      this.size = aggrColl.size;
      this.size.x = this.size.cols;
      this.size.y = this.size.rows;
      this.vismels = vismelColl;  // is the collection of the base queries for each atomic plot, i.e. cell of the view table

      let vismel = this.vismels.base;  // .base is the common original base query of all queries that resulted in all these collections
      vismel.used = vismel.usages();

      /// one time on init:
      /// todo: is this actually "redo on canvas size change" ?

      // create global extent (i.e. across all result collections as far as it makes sense!)
      // globalExtent is a Map that maps of FieldUsages to their extents
      let globalExtent = getGlobalExtent(aggrColl, dataColl, testDataColl, biColl, uniColl);
      // generate yield-based extents from it
      let yieldExtent = getYieldExtent(globalExtent);
      globalExtent = updateWithYieldExtent(globalExtent, yieldExtent);
      // normalize extents
      normalizeExtents(globalExtent);
      // now finally attach to the field usages, i.e.:
      // each FieldUsage gets a .extent attribute that has its global extent (wrt its yield)!
      attachToFieldUsages(globalExtent);

      // TODO: build mappers here!!
      // build mappers for visual channels: fill, size, shape, (but not positional)

      /*
       * Shortcut to the layout attributes of a vismel query table.
       * I.e. it is accessor to the layout fields usage for a certain row(y)/col(x) in the view table.
       */
      let getFieldUsage = (idx, xy, vismelQT) => {
        return xy === 'x' ? vismelQT.at[0][idx].layout.cols[0] : vismelQT.at[idx][0].layout.rows[0];
      };

      let qx = vismel.layout.cols,
       qy = vismel.layout.rows;

      // flag whether or not in an atomic plot the x axis (.x) (y axis (.y)) is in use, i.e. encodes some fieldusage of the model
      let used = {
        x: qx[0] !== undefined,
        y: qy[0] !== undefined,
      };

      // flag whether or not in an atomic plot a marginal axis will be drawn. .x (.y) is the flag for the marginal x axis (y axis)
      //  * we need a marginal plot, iff the opposite letter axis is used!
      //  * but only if it is generally enabled in the config
      //  * and if there was any data passed in for marginals
      let marginal = {
        x: config.views.marginals.possible && used.y && uniColl[0][0] && uniColl[0][0].y,
        y: config.views.marginals.possible && used.x && uniColl[0][0] && uniColl[0][0].x
      };

      // get absolute pane size [in px]
      let paneSizePx = {
        x: pane.clientWidth,
        y: pane.clientHeight,
      };

      // size of templating axis to plots area [in normalized coordinates]
      let templAxisSize = {};
      {
        // TODO: new mode: infer from label length
        let fixedAxisWidth = true, // TODO: set as configuration value
          xlen = getLevelSplits(qx).length,
          ylen = getLevelSplits(qy).length;
        if (fixedAxisWidth) {
          templAxisSize.x = ylen === 0 ? 0 : (ylen * config.plots.layout.templ_axis_level_width.y / paneSizePx.x);
          templAxisSize.y = xlen === 0 ? 0 : (xlen * config.plots.layout.templ_axis_level_width.x / paneSizePx.y);
        } else {
          templAxisSize.x = getLevelSplits(qy).length * config.plots.layout.templ_axis_level_ratio.y;
          templAxisSize.y = getLevelSplits(qx).length * config.plots.layout.templ_axis_level_ratio.x;
        }
      }

      let paneSize = {
        x: 1 - templAxisSize.x,
        y: 1 - templAxisSize.y,
      };

      // width and heights of a single view cell in normalized coordinates
      let cellSize = {
        x: (1 - templAxisSize.x) / this.size.cols,
        y: (1 - templAxisSize.y) / this.size.rows,
      };

      // part of pane width (height) used for main x (y) axis in an atomic plot
      // size of main plot [in normalized coordinates]
      let mainPlotRatio = {
        x: marginal.x ? config.plots.layout.ratio_marginal(used.x) : 1,
        y: marginal.y ? config.plots.layout.ratio_marginal(used.y) : 1,
      };

      // length of the main x axis (y axis) of an atomic plot [in normalized coordinates]
      // includes padding!
      let axisLength = {
        main: {
          x: cellSize.x * mainPlotRatio.x,
          y: cellSize.y * mainPlotRatio.y,
        },
        marginal: {
          x: cellSize.x * (1 - mainPlotRatio.x),
          y: cellSize.y * (1 - mainPlotRatio.y),
        }
      };

      // padding between neighboring main axes in relative coordiantes
      // padding is always applied on the right/up side of an axis.
      // TODO: axis padding is applied equally to both sides of an axis
      // we don't need padding if we have marginal plots, as they separate the main axis anyway...
      // TODO: do we rather want it in fixed pixel?
      axisLength.padding = {
        x: axisLength.main.x * config.plots.layout.main.axis_padding * !marginal.x,
        y: axisLength.main.y * config.plots.layout.main.axis_padding * !marginal.y,
      };

      // starting ids for the axis of different types. id determines z-order!
      let idgen = {
        templating: {x:2, y:1000},
        bicatquant: {x: 2000, y: 3000},
        main: {x:4000, y:5000},
        marginal: {x:6000, y:7000},
      };

      // init layout and traces of plotly plotting specification
      let layout = {}, traces = [];
      // array of main axis along view cell of view table, for both, x and y axis. The values are axis ids.
      let mainAxes = {x: [], y: []};
      // custom titles for axis
      let axisTitles = [];
      // offset to origin of a view cell
      let paneOffset = {};
      // offset of main plot relative to view cell origin
      let mainOffset = {};
      // indexing over x and y
      let idx = {x:0, y:0};

      // Mapping of yields to spatial axis. This is for anchoring all axis with the same yield together.
      let yield2axis = new Map();
      function getSetYield2Axis(yield_, yieldAxisId) {
        let axis = yield2axis.get(yield_);
        if (axis === undefined)  // never overwrite existing mappings. This maybe makes it easier to debug...
          yield2axis.set(yield_, yieldAxisId);
        return axis;
      }

      // loops over view cells
      this.at = new Array(this.size.rows);
      for (idx.y = 0; idx.y < this.size.y; ++idx.y) {
        this.at[idx.y] = new Array(this.size.x);

        paneOffset.y = templAxisSize.y + cellSize.y * idx.y;
        mainOffset.y = paneOffset.y + (config.plots.marginal.position.x === 'bottomleft' ? axisLength.marginal.y : 0);
        let yaxis = config.axisGenerator.main(mainOffset.y + 0.5*axisLength.padding.y, axisLength.main.y - 0.5*axisLength.padding.y, templAxisSize.x, used.y),
          yid = idgen.main.y++;        

        if (used.y) {
          let yYield = getFieldUsage(idx.y,'y',vismelColl).yields;
          yaxis.scaleanchor = getSetYield2Axis(yYield, "y"+yid);

          let axisTitleAnno = config.annotationGenerator.axis_title(
            getFieldUsage(idx.y, 'y', vismelColl).yields, 'y', mainOffset.y, axisLength.main.y, templAxisSize.x);
          axisTitles.push(axisTitleAnno);
        }
        layout["yaxis" + yid] = yaxis;
        yid = "y"+yid;
        mainAxes.y.push(yid);

        for (idx.x = 0; idx.x < this.size.x; ++idx.x) {
          paneOffset.x = templAxisSize.x + cellSize.x * idx.x;

          // create main axis
          let xaxis, xid;
          if (idx.y === 0) {
            mainOffset.x = paneOffset.x + (config.plots.marginal.position.y === 'bottomleft' ? axisLength.marginal.x : 0);
            xaxis = config.axisGenerator.main(mainOffset.x + 0.5*axisLength.padding.x, axisLength.main.x - 0.5*axisLength.padding.x, templAxisSize.y, used.x);
            xid = idgen.main.x++;
            if (used.x) {
              let xYield = getFieldUsage(idx.x,'x',vismelColl).yields;
              xaxis.scaleanchor = getSetYield2Axis(xYield, "x"+xid);
              
              let axisTitleAnno = config.annotationGenerator.axis_title(getFieldUsage(idx.x, 'x', vismelColl).yields, 'x', mainOffset.x, axisLength.main.x, templAxisSize.y);
              axisTitles.push(axisTitleAnno);
//            TODO: reduce number of axis labels, if possible (i.e. FL,RW without split on ROWS still needs two labels, not one!)              
//               if (idx.x === 0) {
//                   let axisTitleAnno = config.annotationGenerator.axis_title(getFieldUsage(idx.x, 'x', vismelColl).yields, 'x', paneOffset.x, paneSize.x, templAxisSize.y);                  
//                   axisTitles.push(axisTitleAnno);
//               }             
            }
            layout["xaxis" + xid] = xaxis;
            xid = "x" + xid;
            mainAxes.x.push(xid);
          } else {
            xid = mainAxes.x[idx.x];
          }

          // create marginal axes as needed
          let marginalAxisId = {};
          for (let [xy, yx] of [['x','y'], ['y','x']]) {
            if (marginal[xy]) { // marginal activate?

              let axisOffset = paneOffset[xy] + (config.plots.marginal.position[yx] === 'bottomleft' ? 0 : axisLength.main[xy]),
               axis = config.axisGenerator.marginal(axisOffset, axisLength.marginal[xy], templAxisSize[yx], xy);

              axis.anchor = mainAxes[yx][idx[yx]];  // anchor marginal axis to opposite letter main axis of the same atomic plot. This will position them correctly.
              if (xy === 'x')
                axis.showticklabels = idx[yx] === this.size[yx] - 1; // disables tick labels for all but one of the marginal axis of one row / col
              else
                axis.showticklabels = idx[yx] === 0; // disables tick labels for all but one of the marginal

              if (axis.side === 'right')
                axis.side = 'left';

              // [xy] is x or y axis; idx[xy] is index in view table
              let rc = (xy === 'x' ? 'cols' : 'rows');
              let uniVismel = uniColl[idx.y][idx.x][yx].vismel,
                xyFu = uniVismel.layout[rc][0];
              Object.assign(axis, getRangeAndTickMarks(xyFu.extent, xy));

              marginalAxisId[xy] = idgen.marginal[xy]++;
              layout[xy + "axis" + marginalAxisId[xy]] = axis;
              marginalAxisId[xy] = xy + marginalAxisId[xy];
            }
          }

          // special case: quantitative-categorical: create additional axis for that.
          // it's an array of axes (along cat dimension): one for each possible value of that categorical dimension
          let catQuantAxisIds = [];
          if (used.x && used.y && biColl[0][0] !== undefined) {
            let rt = biColl[idx.y][idx.x];
            // build up helper variables needed later and to check if we are in the quant-categorical case
            let fu = {x: rt.vismel.layout.cols[0], y: rt.vismel.layout.rows[0]},
              catXY = PQL.hasDiscreteYield(fu.x) ? 'x' : (PQL.hasDiscreteYield(fu.y) ? 'y' : undefined),
              quantXY = PQL.hasNumericYield(fu.x) ? 'x' : (PQL.hasNumericYield(fu.y) ? 'y' : undefined);

            if (catXY && quantXY) {
              let catFu = fu[catXY],
                catIdx = rt.fu2idx.get(catFu);

              // available length per category in categorical dimension along categorical axis of main plot [in norm. coord]
              let catExtent = rt.extent[catIdx],
                n = catExtent.length,
                d = axisLength.main[catXY] / n;

              let pFu = rt.vismel.layout[PQL.hasDiscreteYield(fu.x) ? 'cols' : 'rows'][1],
                pIdx = rt.fu2idx.get(pFu),
                pExtent = rt.extent[pIdx];

              // build additional axes along categorial dimension, i.e. the axes that will encode density
              // need as many axis as there is categories!
              for (let i=0; i<n; ++i) {
                const r = 2.0; // sets position of axis
                // offset of axis (i.e. along the categorical dimension)
                let o = mainOffset[catXY] + i*d + d/r,
                  id_ = idgen.bicatquant[catXY]++,
                  axis = config.axisGenerator.marginal(o, d*(r-1)/r, mainOffset[quantXY], catXY);
                axis.anchor = mainAxes[quantXY][idx[quantXY]];

                // set axis labels and tick marks                
                Object.assign(axis, getRangeAndTickMarks(pExtent,catXY));
                //axis.showticklabels = false;
                //axis.tickcolor
                //axis.ticklen = -210;
                let cd = config.colors.density;
                axis.color = cd.primary_single;
                axis.tickfont = {
                  color: cd.adapt_to_color_usage ? cd.secondary_single : cd.primary_single
                };

                // hack to shorten inside axis // doesn't really work, because the tick at 0 is special...
                axis.ticks = "inside";
                axis.ticklen = 12;
                axis.tickwidth = 2;
                axis.tickcolor = "#FFFFFF";
                axis.mirror = "ticks";
                axis.zerolinecolor = "#878787";
                //axis.tickcolor = "#FF0000";
                //axis.side  = (catXY === 'y' ? "left" : "bottom");

                catQuantAxisIds.push(catXY + id_); // store for later reuse
                layout[catXY + "axis" + id_] = axis; // add to layout
              }
            }
          }

          // create traces for one atomic plot
          let atomicTraces = atomicPlotlyTraces(aggrColl[idx.y][idx.x], dataColl[idx.y][idx.x], testDataColl[idx.y][idx.x], uniColl[idx.y][idx.x], biColl[idx.y][idx.x], vismelColl.at[idx.y][idx.x], {x:xid,y:yid}, marginalAxisId, catQuantAxisIds, queryConfig);

          traces.push(...atomicTraces);
        }
      }

      // add templating axis
      let [templx, annotationsx] = createTemplatingAxis('x', {x:templAxisSize.x, y:0}, {x:1-templAxisSize.x, y:templAxisSize.y}, qx, idgen.templating);
      let [temply, annotationsy] = createTemplatingAxis('y', {x:0, y:templAxisSize.y}, {x:templAxisSize.x, y:1-templAxisSize.y}, qy, idgen.templating);
      Object.assign(layout, templx, temply);

      // add 'global' layout options
      Object.assign(layout, {
        title: "",
        //title: "Model: " + query.sources[0].name,
        barmode: 'group',
        bargroupgap: 0.05,
        margin: config.plots.layout.margin,
        annotations: [...axisTitles, ...annotationsx, ...annotationsy],
        editable: true,
        hovermode: 'closest',
        paper_bgcolor: "rgba(255,255,255,0.9)",
        plot_bgcolor: 'rgba(255,255,255,0)',
      });

      // and global config options.
      // See https://github.com/plotly/plotly.js/blob/master/src/plot_api/plot_config.js#L22-L86
      let plConfig = {
        edits: {
          annotationPosition: true,
          colorbarPosition: true,
          legendPosition: true,
        },
        scrollZoom: true,
        displaylogo: false,
        // modeBarButtonsToRemove: [],
        // modeBarButtonsToAdd: [],
      };

      //console.log(layout);

      // plot everything
      Plotly.purge(pane);
      Plotly.plot(pane, traces, layout, plConfig);

      // add color legend
      function colorLegend(svgG, scale) {


        let ordinal = d3.scale.ordinal()
          .domain(["a", "b", "c", "d", "e"])
          .range([ "rgb(153, 107, 195)", "rgb(56, 106, 197)", "rgb(93, 199, 76)", "rgb(223, 199, 31)", "rgb(234, 118, 47)"]);

        let svg = d3.select("#my-svg");

        svg.append("g")
          .attr("class", "legendOrdinal")
          .attr("transform", "translate(20,20)");

        let legendOrdinal = d3.legend.color()
          .shape("rect")
          .shapePadding(10)
          .scale(ordinal);

        svg.select(".legendOrdinal")
          .call(legendOrdinal);
      }

      if (vismel.used.color) {
        let colorMap = vismel.layers[0].aesthetics.color;
      }

    };

    return ViewTable;
  });