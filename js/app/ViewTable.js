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

    function atomicPlotlyTraces(aggrRT, dataRT, p1dRT, p2dRT, query, mainAxis, marginalAxis) {

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
        details: aest.details.length != 0,
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
              // TODO: make it possible to enable marginal plots as well
              traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));
              // traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggrHeatmap(aggrRT, query, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
              //traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
              // TODO: plotly heatmaps do not support categorical z values, as a color scale only maps from numerical values. Either find a work around or implement cateogrical heatmaps?
            }
            else { // if (used.shape) {
              // scatter plot
              // TODO: unterscheide weiter ob use.size? siehe http://wiki.inf-i2.uni-jena.de/doku.php?id=emv:visualization:default_chart_types
              traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));
              traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
            }

          }
          // at least on is dependent -> line chart
          else {
            traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));
            traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
            traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
            traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
          }
        }

        //  x and y are discrete
        else if (xDiscrete && yDiscrete) {
          traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));

          // hard to show splits of more than rows and cols: overlap in visualization
          // TODO: solve by creating a bubble plot/jittered plot

          // hard to show samples in this case: major overlap in visualization.
          // TODO: solve by creating a bubble plot/jittered plot

          // non-discrete yield on color?
          // TODO: add condition: no other splits
          if (used.color && !PQL.hasDiscreteYield(aest.color.fu)) {
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
          // TODO individual contour plots for each combination?
          // for now: no 2d density plot

          // TODO: individual marginal density plots for each each combination?
          // for now: combined one
          traces.push(...TraceGen.uni(p1dRT, query, mapper, mainAxis, marginalAxis));
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

    function normalizeExtents(queries) {
      /**
       * Tweaks the (continuous) extents of a given FieldUsage for nicer displaying. For discrete FieldUsages it leaves
       * the extent unchanged.
       * (1) non-singular extent: add 5% of extent to upper and lower bound of extent
       * (2) singular extent and singular !== 0: upper = singular+5%*singular, lower = singular-5%*singular
       * (3) singular extent and singular === 0: upper = 1 , lower = -1
       */
      function _normalizeExtent(fu) {
        if (PQL.hasDiscreteYield(fu))
          return;
        let extent = fu.extent;
        if (extent[0] === extent[1]) { // if singular
          let singular = extent[0];
          if (singular === 0)
            extent = [-1, 1];
          else
            extent = [singular - 0.05 * singular, singular + 0.05 * singular];
        } else {
          let relOff = 0.05 * (extent[1] - extent[0]);
          extent = [extent[0] - relOff, extent[1] + relOff];
        }
        fu.extent = extent;
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
     * Setup mappers for the given query. Mappers are function that map data item to visual attributes, like a svg path, color, size and others. Mappers are used in D3 to bind data to visuals.
     *
     * Before mappers can be set up, the scales need to be set up. See attachScales().
     *
     * @param what {Map} a map of identifier to BaseMap s.
     * @param data {Array} the ResultTable to be mapped by the mapper.
     * @param paneSize {Object} {width, height} Size of pane to draw in, measuered in pixel.
     */
    function getMapper(what, data, paneSize) {
      // todo: performance: improve test for interval vs value? e.g. don't test single data items, but decide for each variable
      function _valueOrAvg(val) {
        return _.isArray(val) ? val[0] + val[1] / 2 : val;
      }

      let fu2idx = data.fu2idx;
      let mapper = {};

      function mapFill(fill) {
        if (fill === undefined) {
          return config.maps.fill;
        } else if (fill.hasOwnProperty('base')) {
          let idx = fu2idx.get(fill.base.fu);
          return d => fill.base.visScale(_valueOrAvg(d[idx]));
        } else if (fill.hasOwnProperty('value')) {
          return fill.value;
        } else {
          throw RangeError();
        }
      }

      mapper.fill = mapFill(what.get('fill'));

      function mapStroke(stroke) {
        if (stroke === undefined) {
          return config.maps.stroke;
        } else if (stroke.hasOwnProperty('base')) {
          let idx = fu2idx.get(stroke.base.fu);
          return d => stroke.base.visScale(_valueOrAvg(d[idx]));
        } else if (stroke.hasOwnProperty('value')) {
          return stroke.value;
        } else {
          throw RangeError();
        }
      }

      mapper.stroke = mapStroke(what.get('stroke'));

      let opacity = what.get('opacity');
      mapper.opacity = (opacity !== undefined ? opacity.value : config.maps.opacity);

      function mapSize(size) {
        if (size === undefined) {
          return config.maps.size;
        } else if (size.hasOwnProperty('base')) {
          let idx = fu2idx.get(size.base.fu);
          return d => size.base.visScale(_valueOrAvg(d[idx]));
        } else if (size.hasOwnProperty('value')) {
          return size.value;
        } else {
          throw RangeError();
        }
      }

      mapper.size = mapSize(what.get('size'));

      function mapShape(shape) {
        if (shape === undefined) {
          return config.maps.shape;
        } else if (shape.hasOwnProperty('base')) {
          let idx = fu2idx.get(shape.base.fu);
          return d => shape.base.visScale(_valueOrAvg(d[idx]));
        } else if (shape.hasOwnProperty('value')) {
          return shape.value;
        } else {
          throw RangeError();
        }
      }

      mapper.shape = mapShape(what.get('shape'));

      if (what.has('hover'))
        mapper.hover = (d) => d.reduce(
          (prev, di, i) => prev + data.header[i] + ": " + di + "\n", "");

      let col = what.get('col'),
        row = what.get('row');
      let xPos = paneSize.width / 2,
        yPos = paneSize.height / 2;

      if (col !== undefined) col = col.base;
      if (row !== undefined) row = row.base;

      if (col !== undefined && row !== undefined) {
        let colIdx = fu2idx.get(col),
          rowIdx = fu2idx.get(row);
        mapper.transform = function (d) {
          return 'translate(' +
            col.visScale(d[colIdx]) + ',' +
            row.visScale(d[rowIdx]) + ')';
        };
      }
      else if (col !== undefined && row === undefined) {
        let colIdx = fu2idx.get(col);
        mapper.transform = function (d) {
          return 'translate(' +
            col.visScale(d[colIdx]) + ',' +
            yPos + ')';
        };
      }
      else if (col === undefined && row !== undefined) {
        let rowIdx = fu2idx.get(row);
        mapper.transform = function (d) {
          return 'translate(' +
            xPos + ',' +
            row.visScale(d[rowIdx]) + ')';
        };
      }
      else {
        // todo: jitter?
        mapper.transform = 'translate(' + xPos + ',' + yPos + ')';
      }

      return mapper;
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
      let invXy = (xy === 'x'?'y':'x');

      // the number of stacked axis equals the number of splits in fus, reduced by one if there is no aggregation/density (since the last split then is part of an atomic plots axes)
      let levelSplits = getLevelSplits(fus);

      // available height (if xy === x) (width if xy === y) per axis level
      let levelSize = size[invXy] / levelSplits.length;
      let axes = {}; // object of plotly axes objects
      let repeat = 1;

      levelSplits.forEach((split, d) => {
        let stackOffset = offset[invXy] + levelSize * d; // the y (x) offset of axes in this level (this is identical for all axis of this level)
        let majorLength = size[xy] / repeat; // the width (height) of (a single) major axes in this level
        let minorId = id[invXy]++;

        // only one minor axis per stack level is needed
        let minor = {
          domain: [stackOffset, stackOffset + levelSize],
          anchor: xy + id[xy],  // anchor with the first major of this level (to be generated)
          visible: false,
        };

        let ticks = split.extent;

        // multiple major axis are needed
        for (let r = 0; r < repeat; ++r) {

          let majorId = id[xy]++,
            majorOffset = offset[xy] + majorLength*r;

          // new major axis (i.e. x axis for xy === x)
          let major = config.axisGenerator.templating_major(majorOffset, majorLength, stackOffset, ticks, invXy + minorId);
          // TODO: what is this anchor? and why does the positioning not work correctly if stacked on rows.
          axes[xy + 'axis' + majorId] = major;
        }
        repeat *= ticks.length;
        axes[invXy + 'axis' + minorId] = minor;
      });

      return axes;
    }


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
      let query = queries.base;

      /// one time on init:
      /// todo: is this actually "redo on canvas size change" ?

      // extents
      initEmptyExtents(queries);
      attachExtents(queries, this.aggrCollection);
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
      let marginal = {
        x: config.plots.marginal.visible.x && used.y,  // we need a marginal plot, iff the opposite letter axis is used!
        y: config.plots.marginal.visible.y && used.x
      };

      // size of templating axis to plots area in normalized coordinates
      let templAxisSize = {
        x: getLevelSplits(qy).length > 0 ? config.plots.layout.templ_axis_size.y : 0,
        y: getLevelSplits(qx).length > 0 ? config.plots.layout.templ_axis_size.x : 0,
      };

      // width and heights of a single atomic pane in normalized coordinates
      let atomicPaneSize = {
        x: (1 - templAxisSize.x) / this.size.cols,
        y: (1 - templAxisSize.y) / this.size.rows,
      };

      // part of pane width (height) used for main x (y) axis in an atomic plot
      let mainAxisRatio = {
        x: marginal.x ? config.plots.layout.ratio_marginal(used.x) : 1,
        y: marginal.y ? config.plots.layout.ratio_marginal(used.y) : 1,
      };

      // length of the main x axis (y axis) of an atomic plot in normalized coordinates
      let axisLength = {
        main: {
          x: atomicPaneSize.x * mainAxisRatio.x,
          y: atomicPaneSize.y * mainAxisRatio.y,
        },
        marginal: {
          x: atomicPaneSize.x * (1 - mainAxisRatio.x),
          y: atomicPaneSize.y * (1 - mainAxisRatio.y),
        }

      };

      // starting ids for the axis of different types. id determines z-order.
      let idgen = {
        main: {x:2000, y:3000},
        marginal: {x:4000, y:5000},
        templating: {x:1, y:1000}
      };

      // init layout and traces of plotly plotting specification
      let layout = {}, traces = [];
      // array of main axis along atomic plots of view table, for both, x and y axis. The values are axis ids.
      let mainAxes = {x: [], y: []};
      // offset of a specific atomic pane
      let paneOffset = {};
      // indexing over x and y
      let idx = {x:0, y:0};

      this.at = new Array(this.size.rows);
      for (idx.y = 0; idx.y < this.size.rows; ++idx.y) {
        this.at[idx.y] = new Array(this.size.cols);
        paneOffset.y = templAxisSize.y + atomicPaneSize.y * idx.y;

        let yaxis = config.axisGenerator.main(paneOffset.y + axisLength.marginal.y, axisLength.main.y, templAxisSize.x, used.y),
          yid = idgen.main.y++;
        if (used.y)
          yaxis.title = getFieldUsage(idx.y, 'y').yields;
        layout["yaxis" + yid] = yaxis;
        yid = "y"+yid;
        mainAxes.y.push(yid);

        for (idx.x = 0; idx.x < this.size.cols; ++idx.x) {
          paneOffset.x = templAxisSize.x + atomicPaneSize.x * idx.x;

          let xaxis, xid;
          if (idx.y === 0) {
            xaxis = config.axisGenerator.main(paneOffset.x + axisLength.marginal.x, axisLength.main.x, templAxisSize.y, used.x);
            xid = idgen.main.x++;
            if (used.x)
              xaxis.title = getFieldUsage(idx.x, 'x').yields;
            layout["xaxis" + xid] = xaxis;
            xid = "x" + xid;
            mainAxes.x.push(xid);
          } else {
            xid = mainAxes.x[idx.x];
          }

          // create marginal axes as needed
          let marginalAxisId = {};
          for (let [xy, yx] of [['x','y'], ['y','x']]) {
            if (marginal[xy]) {
              let axis = config.axisGenerator.marginal(paneOffset[xy], axisLength.marginal[xy], templAxisSize[yx], xy);
              // anchor marginal axis to opposite letter main axis of the same atomic plot. This will position them correctly.
              axis.anchor = mainAxes[yx][idx[yx]];

              marginalAxisId[xy] = idgen.marginal[xy]++;
              layout[xy + "axis" + marginalAxisId[xy]] = axis;
              marginalAxisId[xy] = xy + marginalAxisId[xy];
            }
          }

          // create traces for one atomic plot
          let atomicTraces = atomicPlotlyTraces(aggrColl[idx.y][idx.x], dataColl[idx.y][idx.x], uniColl[idx.y][idx.x], biColl[idx.y][idx.x], queries.at[idx.y][idx.x], {x:xid,y:yid}, marginalAxisId);

          traces.push(...atomicTraces);
        }
      }

      // add templating axis
      let templx = createTemplatingAxis('x', {x:templAxisSize.x, y:0}, {x:1-templAxisSize.x, y:templAxisSize.y}, qx, idgen.templating);

      let temply = createTemplatingAxis('y', {x:0, y:templAxisSize.y}, {x:templAxisSize.x, y:1-templAxisSize.y}, qy, idgen.templating);

      Object.assign(layout, templx, temply);

      // add 'global' layout options
      Object.assign(layout, {
        //title: 'test title',
        barmode: 'group',
        margin: config.plots.layout.margin,
      });

      // plot everything
      Plotly.purge(pane);
      Plotly.plot(pane, traces, layout);
    };

    return ViewTable;
  });