/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', './PQL', './VisMEL', './MapperGenerator', './ViewSettings', './TraceGenerator'],
  function (Logger, d3, PQL, VisMEL, MapperGen, config, TraceGen) {
    "use strict";

    var logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    function _invXY(xy) {
      return (xy === 'x'?'y':'x');
    }

    function getRangeAndTickMarks(extent, xy, cfg={linePrct:0.8, maxPrct:1.2}) {
      let axis = {};
      //axis.range = [Math.min(0, -0.02 * extent[1]), extent[1]*cfg.maxPrct]; // hack, because zero line tends to be not drawn... TODO: apparently this is not a problem anymore. but lets keep this for a while.
      axis.range = [0, extent[1]*cfg.maxPrct];
      if (config.plots.marginal.position[_invXY(xy)] === 'bottomleft') // reverse range if necessary reversed range
        axis.range = axis.range.reverse();
      axis.tickmode = "array"; // use exactly 2 ticks as I want:
      axis.tickvals = [0, (extent[1] * cfg.linePrct).toPrecision(1)]; // draw a line at 0 and ~maxPrct%
      return axis
    }

    // function atomicPlotlyTraces(aggrRT, dataRT, p1dRT, p2dRT, query, axes) {
    function atomicPlotlyTraces(aggrRT, dataRT, p1dRT, p2dRT, query, mainAxis, marginalAxis, catQuantAxisIds) {

      // let mainAxis = axes.main,
      //   marginalAxis = axis.marginal,
      //   catQuantAxis = axis.catquant;

      // build all mappers
      let mapper = {
        aggrFillColor: MapperGen.markersFillColor(query),
        aggrSize: MapperGen.markersSize(query, config.map.aggrMarker.size),
        aggrShape: MapperGen.markersShape(query, 'filled'),
        samplesShape: MapperGen.markersShape(query, 'filled'),
        samplesSize: MapperGen.markersSize(query, config.map.sampleMarker.size),
        lineColor: MapperGen.lineColor(query),
      };
      mapper.marginalColor = MapperGen.marginalColor(query, mapper.aggrFillColor);

      let traces = [],
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0];

      let used = {
        color: aest.color instanceof VisMEL.ColorMap,
        shape: aest.shape instanceof VisMEL.ShapeMap,
        size: aest.size instanceof VisMEL.SizeMap,
        details:  aest.details.filter( s => s.method === 'identity').length > 0, // identity splits can be ignored. OLD: aest.details.length != 0,
        x: xfu !== undefined,
        y: yfu !== undefined,
      };

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
              traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis, config.marginalColor.single));
              // traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggrHeatmap(aggrRT, query, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
              //traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
            }
            else { // if (used.shape) {
              // scatter plot
              // TODO: unterscheide weiter ob use.size? siehe http://wiki.inf-i2.uni-jena.de/doku.php?id=emv:visualization:default_chart_types
              traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis, config.marginalColor.single));
              traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
            }

          }
          // at least on is dependent -> line chart
          else {
            traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis, config.marginalColor.single));
            traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
            traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
            traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
          }
        }

        //  x and y are discrete
        else if (xDiscrete && yDiscrete) {
          traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis, config.marginalColor.single));

          // hard to show splits of more than rows and cols: overlap in visualization
          // TODO: solve by creating a bubble plot/jittered plot

          // hard to show samples in this case: major overlap in visualization.
          // TODO: solve by creating a bubble plot/jittered plot

          // non-discrete yield on color?
          if (used.color && !PQL.hasDiscreteYield(aest.color.fu)
            // TODO: the next line is new, test it! should disallow other splits
            && !PQL.isSplit(aest.color.fu) && !used.shape && !used.size && !used.details) {
            // don't show bi density in this case
            traces.push(...TraceGen.aggrHeatmap(aggrRT, query, mapper, mainAxis));
          }
          else {
            // TODO: make it a jittered plot?
            traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
            traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
          }
        }

        // one is discrete, the other numerical
        else {
          traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis, config.marginalColor.single));
          traces.push(...TraceGen.biQC(p2dRT, query, mapper, mainAxis, catQuantAxisIds));
          traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
          traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
        }
      }

      // only one of x-axis and y-axis is in use
      else if (used.x && !used.y || !used.x && used.y) {
        let [xOrY, axisFu] = used.x ? ['x', xfu] : ['y', yfu];
        traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));
        // the one in use is categorical
        if (PQL.hasDiscreteYield(axisFu)) {
          // anything special here to do?
        }
        // the one in use is numeric
        else if (PQL.hasNumericYield(axisFu)) {
          traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
        } else
          throw RangeError("axisFU has invalid yield type: " + axisFu.yieldDataType);
        traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
      } else {
        traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
      }

      return traces;
    }


    function initEmptyExtents(queries) {
      let query = queries.base;
      let qa = query.layers[0].aesthetics;
      if (qa.color instanceof VisMEL.ColorMap)
        qa.color.fu.extent = [];
      if (qa.shape instanceof VisMEL.ShapeMap)
        qa.shape.fu.extent = [];
      if (qa.size instanceof VisMEL.SizeMap)
        qa.size.fu.extent = [];

      // init empty extent for measure on ROWS/COLS
      [...query.layout.cols, ...query.layout.rows].filter(PQL.isFieldUsage).forEach(
        m => {
          // TODO: this is a not so nice hack. extent of templating splits is added elsewhere...
          // and in fact it doesn't work...
          if (m.extent === undefined)
            m.extent = [];
        }
      );
    }

    /**
     * Attaches the extents to the {@link FieldUsage}s of the templated query. As FieldUsages of atomic queries are
     * inherited from templated query, extents are also available at the atomic query.
     *
     * The point is that for visualization the extents over _all_ result tables are required, as we need uniform
     * extents over all atomic panes for a visually uniform visualization.
     *
     * Note that extents may take different forms:
     *  - single value (discrete FU)
     *  - interval (continuous FU), or
     *  - set of single values (discrete FU, where the splitting functions splits not into single values but sets of values).
     *
     * For discrete {@link FieldUsage}s the extent is the set of unique values / tuple of values that occurred in the results for this particular {@link FieldUsage}. Tuple are not reduced to their individual values.
     *
     * For continuous {@link FieldUsage}s the extent is the minimum and maximum value that occurred in the results of this particular {@link FieldUsage}, wrapped as an 2-element array. Intervals are reduced to their bounding values.
     *
     * TODO/HACK/Note: extents for templating splits are attached elsewhere, namely in TableAlgebra. Results are generated on a atomic query level and hence its hard to infer the extent of them from the result table... Ah, it's just messy... :-(
     *
     * Note: you cannot use the .extent or .domain of any field of any field usage that query and queries consists of The reason is that these are not updated as a result of query answering. That is because the queries all refer to Fields of some model instance. And that model instance is never actually changed. Instead new models are created on both the remote and local side.
     *
     * @param query
     * @param queries
     * @param results
     */
    var attachExtents = function (queries, results) {
      /**
       * Utility function. Takes the "so-far extent", new data to update the extent for and a flag that informs about the kind of data: discrete or continuous.
       * Note: it gracefully forgives undefined arguments in extent and newData
       * @returns The updated extent
       */
      function _extentUnion(extent, newData, discreteFlag) {
        if (extent === undefined) extent = [];
        if (newData === undefined) newData = [];
        return (discreteFlag ? _.union(extent, newData) : d3.extent([...extent, ...newData]) );
      }

      // note: row and column extent mean the extent of the single measure left on row / column for atomic queries. these are are common across one row / column of the view table
      // retrieve FieldUsages of aestetics for later reuse
      let aes = new Map();
      let qa = queries.base.layers[0].aesthetics;
      if (qa.color instanceof VisMEL.ColorMap)
        aes.set('color', qa.color.fu);
      if (qa.shape instanceof VisMEL.ShapeMap)
        aes.set('shape', qa.shape.fu);
      if (qa.size instanceof VisMEL.SizeMap)
        aes.set('size', qa.size.fu);


      /// iterate over results for each atomic query
      // all aesthetics of all atomic queries simply refer to the base query one.
      let row = new Array(queries.size.rows);
      for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
        row[rIdx] = [];
        for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
          let rt = results[rIdx][cIdx],
            q = queries.at[rIdx][cIdx];

          if (rt == undefined)
            continue;

          // aesthetics extents
          for (let fu of aes.values())
            fu.extent = _extentUnion(fu.extent, rt.extent[rt.fu2idx.get(fu)], PQL.hasDiscreteYield(fu));

          // row and column extents
          // note that lc.extent and lr.extent reference to the _same_ fieldUsage for all queries in one column / row. that's why this works.
          let lr = q.layout.rows[0];
          if (PQL.isFieldUsage(lr))
            lr.extent = _extentUnion(lr.extent, rt.extent[rt.fu2idx.get(lr)], PQL.hasDiscreteYield(lr));
          let lc = q.layout.cols[0];
          if (PQL.isFieldUsage(lc))
            lc.extent = _extentUnion(lc.extent, rt.extent[rt.fu2idx.get(lc)], PQL.hasDiscreteYield(lc));
        }
      }
    };

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

    function normalizeExtents(queries) {
      /**
       * Tweaks the given (continuous) extents of a given FieldUsage (for nicer displaying). For discrete FieldUsages it leaves the extent unchanged.
       */
      function _normalizeExtent(fu) {
        if (!PQL.hasDiscreteYield(fu))
          normalizeContinuousExtent(fu.extent);
      }

      for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
        let lc = queries.at[0][cIdx].layout.cols[0];
        if (PQL.isFieldUsage(lc))
          _normalizeExtent(lc);
      }
      for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
        let lr = queries.at[rIdx][0].layout.rows[0];
        if (PQL.isFieldUsage(lr))
          _normalizeExtent(lr);
      }

      let qa = queries.base.layers[0].aesthetics;
      if (qa.color instanceof VisMEL.ColorMap)
        _normalizeExtent(qa.color.fu);
      if (qa.shape instanceof VisMEL.ShapeMap)
        _normalizeExtent(qa.shape.fu);
      if (qa.size instanceof VisMEL.SizeMap)
        _normalizeExtent(qa.size.fu);
    }

    /**
     * @param coll The collection to extract the extent of. An 3 dimensional array, where the first two dimensions represent 'y' and  'x' and the last dimension contains the values.
     * @param xy Get row-wise (xy === 'y') or column-wise (xy === 'x') extents.
     * @param accessor Accessor function to extract the wanted attribute from a value of the collection.
     */
    function xyCollectionExtent(coll, xy, accessor) {
      let yx = _invXY(xy),
        extents = [],
        len = {
          x: coll.size.cols,
          y: coll.size.rows
        },
        idx = {};
      for (idx[xy] = 0; idx[xy] < len[xy]; ++idx[xy]) {
        let xyExtent = []; // extent across one row or column
        for (idx[yx] = 0; idx[yx] < len[yx]; ++idx[yx]) {
          let cellExtent = accessor(coll[idx.y][idx.x]); // extent of selected attribute for one atomic plot (of given collection)
          xyExtent = d3.extent([...xyExtent, ...cellExtent]);
        }
        extents.push(xyExtent);
      }
      return extents;
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
     * @offset: .x (.y) is the offset in normalized coordinates for the templating axes
     * @size: .x (.y) is the size in normalized coordinates for the templating axes
     * @fus the stack of field usages that make up the templating axes
     * @xy 'x' ('y') if its an x-axis (y-axis)
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
          let major = config.axisGenerator.templating_major(majorOffset, majorLength, ticks, yx + minorId);
          axes[xy + 'axis' + majorId] = major;
        }

        repeat *= ticks.length;
        axes[yx + 'axis' + minorId] = minor;

        // add title once per level
        //let annotation = config.annotationGenerator.templ_level_title(split.yields, xy, minorId);
        let annotation = config.annotationGenerator.axis_title(split.yields, xy, offset[xy], size[xy], stackOffset);
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
     * A ViewTable takes a data collections and a query collection and turns it into an actual visual representation.
     * This visualization is attached to the DOM within the given pane <div> object.
     *
     * A ViewTable is a table of ViewPanes. Each ViewPane represents a single cell of the table.
     *
     * @param pane A <div> element. This must already have a width and height.
     * @param aggrColl The {@link Collection} to visualize with this viewTable.
     * @constructor
     * @alias module:ViewTable
     */
    var ViewTable;
    ViewTable = function (pane, aggrColl, dataColl, uniColl, biColl, queries) {

      this.aggrCollection = aggrColl;
      this.dataCollection = dataColl;
      this.queries = queries;
      this.size = aggrColl.size;
      this.size.x = this.size.cols;
      this.size.y = this.size.rows;
      let query = queries.base;

      /// one time on init:
      /// todo: is this actually "redo on canvas size change" ?

      // extents
      initEmptyExtents(queries);
      attachExtents(queries, this.aggrCollection);
      //if (dataenabled)
      attachExtents(queries, this.dataCollection);
      normalizeExtents(queries);

      // shortcut to the queries layout attributes
      // accessor to the layout fields usage for a certain row(y)/col(x) in the view table
      let getFieldUsage = (idx, xy) => {
        return xy === 'x' ? queries.at[0][idx].layout.cols[0] : queries.at[idx][0].layout.rows[0];
      };

      let qx = query.layout.cols,
       qy = query.layout.rows;

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
          templAxisSize.x = ylen=== 0 ? 0 : 1 * (ylen * config.plots.layout.templ_axis_level_width.y / paneSizePx.x);
          templAxisSize.y = xlen=== 0 ? 0 : 1 * (xlen * config.plots.layout.templ_axis_level_width.x / paneSizePx.y);
        } else {
          templAxisSize.x = getLevelSplits(qy).length * config.plots.layout.templ_axis_level_ratio.y;
          templAxisSize.y = getLevelSplits(qx).length * config.plots.layout.templ_axis_level_ratio.x;
        }
      }

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
      // we don't need padding if we have marginal plots, as they separate the main axis anyway...
      // TODO: do we rather want it in fixed pixel?
      axisLength.padding = {
        x: axisLength.main.x * config.plots.layout.main_axis_padding * !marginal.x,
        y: axisLength.main.y * config.plots.layout.main_axis_padding * !marginal.y,
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

      // need some additional statistics on 1d density: row and column wise extent
      uniColl.extent = {};
      for (let xy of ['x','y']) {
        let yx = _invXY(xy);
        if (marginal[xy]) {  // marginal active?
          uniColl.extent[xy] = xyCollectionExtent(uniColl, xy, (e) => e[yx].extent[2]);
          uniColl.extent[xy].forEach(e=>normalizeContinuousExtent(e, 0.1));
        }
      }

      // loops over view cells
      this.at = new Array(this.size.rows);
      for (idx.y = 0; idx.y < this.size.y; ++idx.y) {
        this.at[idx.y] = new Array(this.size.x);

        paneOffset.y = templAxisSize.y + cellSize.y * idx.y;
        mainOffset.y = paneOffset.y + (config.plots.marginal.position.x === 'bottomleft' ? axisLength.marginal.y : 0);
        let yaxis = config.axisGenerator.main(mainOffset.y, axisLength.main.y - axisLength.padding.y, templAxisSize.x, used.y),
          yid = idgen.main.y++;

        if (used.y) {
          let axisTitleAnno = config.annotationGenerator.axis_title(
            getFieldUsage(idx.y, 'y').yields, 'y', mainOffset.y, axisLength.main.y, templAxisSize.x);
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
            xaxis = config.axisGenerator.main(mainOffset.x, axisLength.main.x - axisLength.padding.x, templAxisSize.y, used.x);
            xid = idgen.main.x++;
            if (used.x) {
              let axisTitleAnno = config.annotationGenerator.axis_title(getFieldUsage(idx.x, 'x').yields, 'x', mainOffset.x, axisLength.main.x, templAxisSize.y);
              axisTitles.push(axisTitleAnno);
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
                axis.showticklabels = idx[yx] == this.size[yx] - 1; // disables tick labels for all but one of the marginal axis of one row / col
              else
                axis.showticklabels = idx[yx] == 0; // disables tick labels for all but one of the marginal

              if (axis.side === 'right')
                axis.side = 'left';

              // [xy] is x or y axis; idx[xy] is index in view table, [1] is index of max of range.
              let extent = uniColl.extent[xy][idx[xy]];
              Object.assign(axis, getRangeAndTickMarks(extent, xy));

              marginalAxisId[xy] = idgen.marginal[xy]++;
              layout[xy + "axis" + marginalAxisId[xy]] = axis;
              marginalAxisId[xy] = xy + marginalAxisId[xy];
            }
          }

          // special case: quantitative-categorical: create additional axis for that.
          // it's an array of axes (along cat dimension): one for each possible value of that categorical dimension
          let catQuantAxisIds = [];
          //OLD: dictionary of special cat-quant axis. Key is axis id, value is axis configuration.
          //let catQuantAxes = {x: {}, y:{}};
          if (used.x && used.y && biColl[0][0] != undefined) {
            let rt = biColl[idx.y][idx.x];
            // build up helper variables needed later and to check if we are in the quant-categorical case
            let fu = {x: getFieldUsage(idx.x, 'x'), y: getFieldUsage(idx.y, 'y')},
              fuType = {x: fu.x.yieldDataType, y: fu.y.yieldDataType},
              catXY = (fuType.x === "string" ? 'x' : (fuType.y === "string" ? 'y' : undefined)),
              quantXY = (fuType.x === "numerical" ? 'x' : (fuType.y === "numerical" ? 'y' : undefined));
            if (catXY && quantXY) {
              // available length per category in categorical dimension along categorical axis of main plot [in norm. coord]
              let catExtent = rt.extent[catXY === 'x' ? 0 : 1],
                n = catExtent.length,
                d = axisLength.main[catXY] / n;

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
                let pExtent = biColl[idx.y][idx.x].extent[2];
                Object.assign(axis, getRangeAndTickMarks(pExtent,catXY));
                //axis.showticklabels = false;
                //axis.tickcolor
                //axis.ticklen = -210;
                axis.color = config.densityColor.single;
                axis.tickfont = {
                  color: config.densityColor.single,
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
          let atomicTraces = atomicPlotlyTraces(aggrColl[idx.y][idx.x], dataColl[idx.y][idx.x], uniColl[idx.y][idx.x], biColl[idx.y][idx.x], queries.at[idx.y][idx.x], {x:xid,y:yid}, marginalAxisId, catQuantAxisIds
            );

          traces.push(...atomicTraces);
        }
      }

      // add templating axis
      let [templx, annotationsx] = createTemplatingAxis('x', {x:templAxisSize.x, y:0}, {x:1-templAxisSize.x, y:templAxisSize.y}, qx, idgen.templating);

      let [temply, annotationsy] = createTemplatingAxis('y', {x:0, y:templAxisSize.y}, {x:templAxisSize.x, y:1-templAxisSize.y}, qy, idgen.templating);


      Object.assign(layout, templx, temply);

      // add 'global' layout options
      Object.assign(layout, {
        title: "Model: " + query.sources[0].name,
        barmode: 'group',
        margin: config.plots.layout.margin,
        annotations: [...axisTitles, ...annotationsx, ...annotationsy],
        editable: true,
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: 'rgba(0,0,0,0)',
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

      console.log(layout);

      // plot everything
      Plotly.purge(pane);
      Plotly.plot(pane, traces, layout, plConfig);
    };

    return ViewTable;
  });