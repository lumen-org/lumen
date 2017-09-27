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

define(['lib/logger', 'd3', './PQL', './VisMEL', './ResultTable', './SplitSample', './ScaleGenerator', './MapperGenerator', './ViewSettings', './TraceGenerator'],
  function (Logger, d3, PQL, VisMEL, RT, S, ScaleGen, MapperGen, config, TraceGen) {
    "use strict";

    var logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    /**
     * Creates a pane within the given <svg> element, respecting the given margin and padding.
     * @param canvasD3 A <svg> element wrapped in a D3 selection.
     * @param margin Margin (outer) for the drawing canvas. Nothing will be drawn here.
     * @param padding Padding (inner) for the drawing canvas. All axis are drawn in this space, including axis of the
     * @returns {{}} A wrapper object that contains properties of the geometry of the canvas and atomic panes, the pane (the root of this), its canvas (the drawing area), margin and padding
     */
    function initCanvas(canvasD3, margin, padding) {
      // normalize arguments
      if (_.isFinite(margin)) {
        margin = {top: margin, right: margin, bottom: margin, left: margin};
      }
      if (_.isFinite(padding)) {
        padding = {top: padding, right: padding, bottom: padding, left: padding};
      }

      // setup basic geometry of actual drawing canvas, with margin (outer) and padding (inner)
      var canvas = {};
      canvas.paneD3 = canvasD3;
      canvas.outerWidth = canvas.paneD3.style2num("width");
      canvas.outerHeight = canvas.paneD3.style2num("height");
      canvas.padding = padding;
      canvas.margin = margin;

      canvas.size = {
        width: canvas.outerWidth - canvas.margin.left - canvas.margin.right - canvas.padding.left - canvas.padding.right, // i.e. inner width
        height: canvas.outerHeight - canvas.margin.top - canvas.margin.bottom - canvas.padding.top - canvas.padding.bottom // i.e. inner height
      };

      // remove all previous content of canvasD3
      canvasD3.selectAll("g").remove();

      // setup the real canvas for drawing and a clip path
      canvas.canvasD3 = canvas.paneD3.append("g")
        .attr("transform", "translate(" + (canvas.margin.left + canvas.padding.left) + "," + (canvas.margin.top + canvas.padding.top) + ")");

      // DEBUG rect to show outer margin of the canvas
      /*canvas.paneD3.append("rect")
       .attr({
       width: canvas.outerWidth,
       height: canvas.outerHeight,
       x: 0, y: 0,
       stroke: "black",
       "stroke-width": 1.5,
       fill: "none"
       });*/

      return canvas;
    }

    /**
     * Adds an atomic pane to parentD3 using the given size and offset. Returns a structure that contains the d3 selection of that and its size.
     * @param parentD3  Parent selection to append the new atomic pane.
     * @param width and height: Size of the new atomic pane in pixel
     * @param height
     * @param offset Offset in pixel.
     * @returns {{paneD3: *, size: *}}
     */
    function addAtomicPane(parentD3, {width, height}, offset) {
      // note: d3 selection are arrays of arrays, hence it is a "four fold"-array. just so that you aren't confused.
      // create subpane
      let subPaneD3 = parentD3.append('g')
        .attr("transform", "translate(" + offset.x + "," + offset.y + ")");
      // border of subpane
      subPaneD3.append('rect')
        .attr({
          x: 0,
          y: 0,
          width: width,
          height: height,
          stroke: config.appearance.pane.borderColor,
          //'stroke-width': 0,
          'fill': config.appearance.pane.fill
          //'fill-opacity': 0
        });
      // the subpane is a collection of variables that make up a subpane, including its data marks
      return {
        paneD3: subPaneD3,
        size: {width, height}
      };
    }

    function drawMarks(marksD3, data, mapper) {
      // create a group for marks
      // @init

      /// update / remove / add marks
      // store update selection, this also creates enter and exit subselections
      // @update
      marksD3 = marksD3
        .selectAll(".point")
        .data(data);

      // add new svg elements for enter subselection
      let newAggrMarksD3 = marksD3
        .enter()
        .append("g")
        .classed("point mark", true);
      newAggrMarksD3
        .append("path")
        .classed("path", true);

      // add hover for data
      newAggrMarksD3
        .append("svg:title")
        .text(mapper.hover);

      // the just appended elements are now part of the update selection!
      // -> now update all the same way

      // set position of shapes by translating the enclosing g group
      // @specific for each view cell
      marksD3.attr('transform', mapper.transform);

      // setup shape path generator
      // -> shape and size can be mapped by accessor-functions on the path/symbol-generator.
      // @common for all view cells
      let shapePathGen = d3.svg.symbol()
        .size(mapper.size)
        .type(mapper.shape);

      // -> color can be mapped by .attr('fill', accessor-fct) (on the path element)
      // @common for all view cells
      marksD3.select(".path").attr({
        'd': shapePathGen,
        fill: mapper.fill,
        stroke: mapper.stroke,
        opacity: mapper.opacity
      });
    }

    // function drawAtomicPlotly(aggrRT, dataRT, p1dRT, p2dRT, query, id={x:0,y:0}, size={x:1,y:1}, offset={x:0,y:0} ) {
    // function drawAtomicPlotly(aggrRT, dataRT, p1dRT, p2dRT, query, id, size, offset) {
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
              //traces.push(...TraceGen.bi(p2dRT, query, mapper, mainAxis));
              traces.push(...TraceGen.aggrHeatmap(aggrRT, query, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, query, mapper, mainAxis));
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
          traces.push(...TraceGen.uni(p1dRT, query, mapper));

          // hard to show splits of more than rows and cols: overlap in visualization
          // TODO: solve by creating a bubble plot/jittered plot

          // hard to show samples in this case: major overlap in visualization.
          // TODO: solve by creating a bubble plot/jittered plot

          // non-discrete yield on color?
          // TODO: add condition: no other splits
          if (used.color && !PQL.hasDiscreteYield(aest.color.fu)) {
            // don't show bi density in this case
            traces.push(...TraceGen.aggrHeatmap(aggrRT, query, mapper));
          }
          else {
            // TODO: make it a jittered plot?
            traces.push(...TraceGen.bi(p2dRT, query, mapper));
            traces.push(...TraceGen.aggr(aggrRT, query, mapper));
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


    function atomicPlotlyAllAxis (size, offset, xOrY) {

      // create xOrY main axis for given fieldUsage fu (?)



      // flags to disable/enable marginal plot:
      let marginal = {
        x: config.plots.marginal.visible.x,
        y: config.plots.marginal.visible.y
      };

      // ### compile axes
      let axes = {}, mainId = {}, marginalId = {};

      // disable marginal axis if not required
      for (let xOrY of ['x', 'y'])
        marginal[xOrY] = marginal[xOrY] && used[xOrY];

      // compile axes
      if (used.x && used.y) {
        for (let [xOrY, invXorY] of [['x','y'], ['y','x']]) {
          let mainAxis = config.axisGenerator.main(true);
          if (marginal[xOrY]) {
            mainAxis.domain = [
              offset[invXorY] + size[invXorY] * config.plots.layout.ratio_marginal.used,
              offset[invXorY]  + size[invXorY] * 1
            ];

            // [config.plots.layout.ratio_marginal.used + config.plots.layout.margin_main_sub, 1];
            let marginalAxis = config.axisGenerator.marginal(true, invXorY);
            marginalAxis.domain = [
              offset[invXorY],
              offset[invXorY] + size[invXorY] * config.plots.layout.ratio_marginal.used
            ];

            marginalId[invXorY] = invXorY + 'axis' + id[invXorY]++;  // generate id
            axes[marginalId[invXorY]] = marginalAxis;  // assign id and add axis to layout
            //layout[invXorY+'axis2'] = config.axisGenerator.marginal(true, invXorY);
          } else {
            mainAxis.domain = [offset[invXorY], offset[invXorY]  + size[invXorY]];
          }
          mainId[invXorY] = invXorY + 'axis' + id[invXorY]++;  // generate id
          axes[mainId[invXorY]] = mainAxis;  // assign id and add axis to layout
        }
      }
      else if (!used.x && used.y || used.x && !used.y) {
        // TODO: adapt for generic position and offset and id
        let [usedXY, unusedXY] = used.x ? ['x','y'] : ['y','x'];
        axes[usedXY + 'axis'] = config.axisGenerator.main(true);
        if (marginal[usedXY]) {
          axes[unusedXY+'axis'] = {
            domain: [config.plots.layout.ratio_marginal.unused + config.plots.layout.margin_main_sub, 1],
          };
          axes[unusedXY+'axis2'] = config.axisGenerator.marginal(false, unusedXY);
        }
        _.extend(axes[unusedXY+'axis'], config.axisGenerator.main(false));
      }
      else {
        // TODO: adapt for generic position and offset and id
        axes.xaxis = config.axisGenerator.main();
        axes.yaxis = config.axisGenerator.main();
      }

      // add axis names
      for (let [xOrY, rowsOrCols] of [['x', 'cols'], ['y', 'rows']]) {
        if (used[xOrY]) {
          axes[mainId[xOrY]].title = query.layout[rowsOrCols][0].yields;
        }
      }

      return axes;
    }

    /**
     * Draws the given atomic query using given data into the pane and returns the pane.
     * @param query
     * @param aggr
     * @param pane
     * @returns {pane}
     */
    function drawAtomicPane(query, aggr, data, pane) {

      /**
       * TODO:
       * I think I need to reorganize the code below. I need to be able to give options on how the mapping is
       * established, I need to be easily able to set it to different values, ...
       * Somehow, the getMapper seems weird, but I don't really know yet how. Do I need it at all, or should I just
       * have separate functions to set up one mapping each, given some options.
       *
       * For example at the moment uses.fill is always expected to have a ColorMap as its value.
       * But I need it to also accept a constant value to use.
       *
       * But for now I just want it done. so I'll make it dirty a bit...
       */

      // TODO: adding scales to FieldUsage on an atomic pane level doesn't exactly make sense... it's really recreating
      //  the same scale (and mapping later) over and over again. But we got more important things to do at the moment.

      // add scales to field usages of this query
      attachScales(query, pane.size);

      // create map of label to "<setting-of-how-map>". Labels are descriptors of visual variables, i.e. 'fill', 'shape', ...
      // convention: it has an attribute .base iff it is based on some BaseMap/FieldUsage
      // convention: it has an attribute .value iff it is a constant value to map to
      let uses = new Map();
      let qa = query.layers[0].aesthetics;
      if (qa.color instanceof VisMEL.ColorMap) {
        uses.set('fill', {base: qa.color});
      }
      if (qa.shape instanceof VisMEL.ShapeMap)
        uses.set('shape', {base: qa.shape});
      if (qa.size instanceof VisMEL.SizeMap)
        uses.set('size', {base: qa.size});
      let row = query.layout.rows[0];
      if (PQL.isFieldUsage(row))
        uses.set('row', {base: row});
      let col = query.layout.cols[0];
      if (PQL.isFieldUsage(col))
        uses.set('col', {base: col});
      uses.set('hover', {});
      uses.set('opacity', {value: 1.0});  // TODO: put into settings
      uses.set('stroke', {value: config.maps.stroke});  // TODO: put into settings

      // setup mapper for visual variables. draw later.
      let aggrMapper = getMapper(uses, aggr, pane.size);

      // remove any density usage since that doesn't exist for data-selects
      uses.forEach(
        (val, key, uses) => {
          if (PQL.isDensity(val.base) || val.base && PQL.isDensity(val.base.fu))
            uses.delete(key);
        }
      );
      uses.set('opacity', {value: 0.4}); // TODO: put into settings
      uses.set('stroke', {value: config.maps.fill});  // TODO: put into settings

      // data marks have no fill but the fill color as stroke color instead
      // remap fill color to stroke color
      let fill = uses.get('fill');
      if (fill !== undefined)
        uses.set('stroke', fill);
      uses.set('fill', {value: 'none'}); // overwrite fill

      let dataMapper = getMapper(uses, data, pane.size);

      // now draw, and let draw aggregation marks after data marks
      pane.dataMarksD3 = pane.paneD3.append("g").classed("pl-data-marks", true);
      drawMarks(pane.dataMarksD3, data, dataMapper);

      pane.aggrMarksD3 = pane.paneD3.append("g").classed("pl-aggr-marks", true);
      drawMarks(pane.aggrMarksD3, aggr, aggrMapper);

      return pane;
    }


    /**
     * Creates axis for the templated part of the query, i.e. axis for the splitting dimensions that create the atomic panes. It also draws the axis
     *
     * This attaches an axis object to the provided canvas and draws it, for both the horizontal and vertical axis.
     * An axis object consists of
     *  - .FU - the corresponding FieldUsage
     *  - .scale - the corresponding scale that is used to build the axis
     *  - .axis - the D3 axis object
     *  - .axisD3 - array of D3 (single element) selections of the g element that contains the visual representation of the axis
     *
     * todo: can I improve the code below by using data joins instead of a for loop for creating the axis?
     *
     * @param query The templated query object. In particular its {@link FieldUsage}s have their extent attached. This extent is retrieved to setup axis accordingly for the canvas object.
     * @param canvas The canvas object.
     */
    function setupTemplatingAxis(query, canvas) {

      /// build up axis stack
      function _buildAxis(fieldUsages, canvas, axisType) {
        let stackDepth = fieldUsages.stackDepth,
          templSplitDims = fieldUsages.filter(PQL.isSplit);
        // do not split the pane by the last split usage, if there is no aggregation or density
        if (!fieldUsages.some(PQL.isAggregationOrDensity))
          templSplitDims.pop();
        let templSplitStackDepth = templSplitDims.length;

        let axisStack = new Array(templSplitStackDepth); // axis stack
        let range = (axisType === "x axis" ? canvas.size.width : canvas.size.height); // the range in px of current axis stack level
        let repeat = 1; // number of times the axis of the current level has to be repeated

        for (let d = 0; d < templSplitStackDepth; ++d) {
          let stackOffset = config.geometry.axis.size * (stackDepth - d - 1);
          let dimUsage = templSplitDims[d];
          let elem = {};
          elem.FU = dimUsage;
          elem.scale = d3.scale.ordinal()
            .domain(dimUsage.extent)
            .rangeRoundPoints([0, range], 1.0);
          elem.axis = d3.svg.axis()
            .scale(elem.scale)
            .orient(axisType === "x axis" ? "bottom" : "left")
            .tickSize(0, config.geometry.axis.outerTickSize);

          // axis needs to be drawn multiple times
          elem.axisD3 = new Array(repeat);
          for (let r = 0; r < repeat; ++r) {
            // attach g element
            let xOffset, yOffset;
            if (axisType === "x axis") {
              xOffset = canvas.size.width / repeat * r;
              yOffset = canvas.size.height + stackOffset;
            } else /* (orientation === "y axis") */ {
              xOffset = -stackOffset;
              yOffset = canvas.size.height / repeat * r;
            }
            let axisG = canvas.canvasD3.append("g")
              .classed(axisType, true)
              .attr("transform", "translate(" + xOffset + "," + yOffset + ")");
            elem.axisD3.push(axisG);

            // draw axis on it
            elem.axis(axisG);

            // tweak domain line: make it a bit shorter on both ends
            {
              let sign = axisType === "y axis" ? -1 : 1,
                ots = config.geometry.axis.outerTickSize,
                pad = d * config.geometry.axis.padding / stackDepth,
                reducedRange = [pad, range - pad];
              if (axisType === "x axis")
                axisG.select("path.domain").attr("d", "M" + reducedRange[0] + "," + sign * ots + "H" + reducedRange[1]);
              else
                axisG.select("path.domain").attr("d", "M" + sign * ots + "," + reducedRange[0] + "V" + reducedRange[1]);
            }

            // tweak tick labels
            {
              axisG.selectAll("text")
                .attr("font-size", config.geometry.axis.tickFontSizePx + "px");
              if (axisType === "y axis")
                axisG.selectAll("text")
                  .attr("y", "-0.6em")
                  .attr("transform", "rotate(-90)")
                  .style("text-anchor", "middle");
            }

            // add axis label
            {
              let x = axisType === "x axis" ? canvas.size.width / repeat / 2 : -(config.geometry.axis.labelFontSizePx * 2 - 4),
                y = axisType === "y axis" ? canvas.size.height / repeat / 2 : config.geometry.axis.labelFontSizePx * 2 + 4;
              let labelD3 = axisG.append("text")
                .text(elem.FU.yields)
                .classed("axis label", true)
                .style("text-anchor", "middle")
                .attr({
                  "x": x,
                  "y": y
                });
              if (axisType === "y axis")
                labelD3.attr({
                  "transform": "rotate(-90," + x + "," + y + ")"
                });
            }
          }

          axisStack[d] = elem;
          // increment to next stack level
          repeat = repeat * dimUsage.extent.length;
          range = range / dimUsage.extent.length;
        }

        // return axis object
        return axisStack;
      }

      if (!canvas.axisStack) canvas.axisStack = {};
      canvas.axisStack.x = _buildAxis(query.layout.cols, canvas, "x axis");
      canvas.axisStack.y = _buildAxis(query.layout.rows, canvas, "y axis");
    }


    /**
     * Attaches and draws an axis to the given atomic pane.
     * @param pane An atomic pane.
     * @param query The atomic query of the given pane
     * @param canvasSize {height, width} The size of the canvas canvas object the pane belongs to.
     * @param axisType {"x axis"|"y axis"}
     */
    function attachAtomicAxis(pane, query, canvasSize, axisType) {
      let axis = {};
      axis.FU = (axisType === "x axis" ? query.layout.cols[0] : query.layout.rows[0]);

      // is there really anything to draw?
      if (!PQL.isFieldUsage(axis.FU))
        return;

      let discreteAxis = PQL.hasDiscreteYield(axis.FU);

      axis.axisD3 = pane.paneD3.append("g")
        .classed(axisType, true)
        .classed(discreteAxis ? "discrete" : "numeric", true);
      if (axisType === "x axis")
        axis.axisD3.attr("transform", "translate(0," + pane.size.height + ")");

      axis.axis = d3.svg.axis()
        .scale(axis.FU.visScale)
        .orient(axisType === "x axis" ? "bottom" : "left");

      // sets number of depending on available space
      if (!discreteAxis) {
        let availableSpace = axisType === "x axis" ? pane.size.width : pane.size.height;
        let spacePerTick = axisType === "x axis" ? 60 : 60;
        let tickCnt = Math.floor(availableSpace / spacePerTick);
        if (tickCnt < 2)
          tickCnt = 2;
        axis.axis.ticks(tickCnt);
      }

      // show three significant digits
      if (PQL.hasNumericYield(axis.FU)) {
        axis.axis.tickFormat(d3.format(".3g"));
      }

      if (discreteAxis) {
        axis.axis.tickSize(-5, 0);
      } else {
        axis.axis.tickSize(-(axisType === "x axis" ? canvasSize.height : canvasSize.width), 0);
      }

      // draw axis
      axis.axis(axis.axisD3);

      axis.axisD3.selectAll("text")
        .attr("font-size", config.geometry.axis.tickFontSizePx + "px");

      if (axisType === "y axis") {
        axis.axisD3.selectAll("text")
          .attr("y", "-0.6em")
          .attr("transform", "rotate(-90)")
          .style("text-anchor", "middle");
      }

      // add field usage name, i.e. label of axis
      let x = axisType === "x axis" ? pane.size.width / 2 : -(config.geometry.axis.labelFontSizePx * 2 - 5),
        y = axisType === "y axis" ? pane.size.height / 2 : config.geometry.axis.labelFontSizePx * 2 + 2;
      axis.labelD3 = axis.axisD3.append("text")
        .text(axis.FU.yields)
        .classed("axis label", true)
        .style("text-anchor", "middle")
        .attr({
          "x": x,
          "y": y
        });
      if (axisType === "y axis")
        axis.labelD3.attr({
          "transform": "rotate(-90," + x + "," + y + ")"
        });

      // attach to pane object
      if (!pane.axis) pane.axis = {};
      if (axisType === "x axis") pane.axis.x = axis;
      else if (axisType === "y axis") pane.axis.y = axis;
      else throw new RangeError("invalid value of axis:", axis);
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
     * Attaches scales to each {@link FieldUsage} in the given query that needs a scale to the property .visScale.
     * A scale is a function that maps from the domain of a {@link FieldUsage} to the range of a visual variable, like shape, color, position ...
     *
     * TODO: this is old, and only needed for my d3 version of drawing.
     *
     * TODO: If a FieldUsage has already a scale assigned (i.e. .scale != undefined), then _no_ new scale is assigned but the existing one is kept. Note: currently this is not the case. We would need a clean-up function, because redrawing fails otherwise.
     *
     * Before scales can be set, extents needs to be set for each FieldUsage. See attachExtents().
     *
     * @param query {VisMEL} A VisMEL query.
     * @param paneSize {{width, height}} Width and heights of the target pane in px.
     */
    var attachScales = function (query, paneSize) {

      let aesthetics = query.layers[0].aesthetics;

      // if (aesthetics.color instanceof VisMEL.ColorMap && aesthetics.color.visScale === undefined)
      if (aesthetics.color instanceof VisMEL.ColorMap)
        aesthetics.color.visScale = ScaleGen.color(aesthetics.color, aesthetics.color.fu.extent);

      // if (aesthetics.size instanceof VisMEL.SizeMap && aesthetics.size.visScale === undefined)
      if (aesthetics.size instanceof VisMEL.SizeMap)
        aesthetics.size.visScale = ScaleGen.size(aesthetics.size, aesthetics.size.fu.extent, [config.maps.minSize, config.maps.maxSize]);

      // if (aesthetics.shape instanceof VisMEL.ShapeMap && aesthetics.shape.visScale === undefined)
      if (aesthetics.shape instanceof VisMEL.ShapeMap)
        aesthetics.shape.visScale = ScaleGen.shape(aesthetics.shape, aesthetics.shape.fu.extent);

      let row = query.layout.rows[0];
      // if (PQL.isFieldUsage(row) && row.visScale === undefined)
      if (PQL.isFieldUsage(row))
        row.visScale = ScaleGen.position(row, row.extent, [paneSize.height - config.geometry.axis.padding, config.geometry.axis.padding]);

      let col = query.layout.cols[0];
      // if (PQL.isFieldUsage(col) && col.visScale === undefined)
      if (PQL.isFieldUsage(col))
        col.visScale = ScaleGen.position(col, col.extent, [config.geometry.axis.padding, paneSize.width - config.geometry.axis.padding]);

      // else: todo: scale for dimensions? in case I decide to keep the "last dimension" in the atomic query

      // no need for scales of: filters, details
    };

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
     * @offset: .x (.y) is the offset in normalized coordinates for the templating axes
     * @size: .x (.y) is the size in normalized coordinates for the templating axes
     * @fus the stack of field usages that make up the templating axes
     * @xOrY 'x' ('y') if its an x-axis (y-axis)
     * @id .x (.y) is the first free axis integer index for x (y) axis
     * @returns {} An array of axis objects for the layout part of a plotly plot configuration.
     */
    function createTemplatingAxis(offset, size, fus, xOrY, id) {
      let invXorY = (xOrY === 'x'?'y':'x');

      // the number of stacked axis equals the number of splits in fus, reduced by one if there is no aggregation/density (since the last split then is part of an atomic plots axes)
      let levelSplits = fus.filter(PQL.isSplit);
      if (!fus.some(PQL.isAggregationOrDensity))
        levelSplits.pop();

      // available width (height) per axis level
      let levelSize = size[invXorY] / levelSplits.length;
      let axes = {}; // object of plotly axes objects
      let repeat = 1;

      levelSplits.forEach((split, d) => {
        let stackOffset = offset[xOrY] + levelSize * d; // the y (x) offset of axes in this level
        let majorSize = size[xOrY] / repeat; // the width (height) of major axes in this level
        let minorId = id[invXorY]++;

        // only one minor axis per stack level is needed
        let minor = {
          domain: [stackOffset, stackOffset + levelSize],
          anchor: xOrY + id[xOrY],  // anchor with the first major of this level (to be generated)
          visible: false,
        };

        let ticks = split.extent; // TODO. don't think that works.

        // multiple major axis are needed
        for (let r = 0; r < repeat; ++r) {

          let majorId = id[xOrY]++,
            majorOffset = offset[invXorY] + majorSize*r;

          // new major axis (i.e. x axis for xOrY === x)
          let major = {
            anchor: invXorY + minorId,
            domain: [majorOffset, majorOffset + majorSize],
            visible: true,
            showline: true,
            showgrid: false,
            ticklen: 5,
            type: 'category',
            range: [-0.5, ticks.length - 0.5], // must be numbers starting from 0
            tickvals: _.range(ticks.length),
            ticktext: ticks,
          };

          axes[xOrY + 'axis' + majorId] = major;
        }
        repeat *= ticks.length;
        axes[invXorY + 'axis' + minorId] = minor;
      });

      return axes;
    }


    /**
     * A ViewTable takes a ResultTable and turns it into an actual visual representation.
     * This visualization is attached to the DOM, as it is created within the limits of a given <svg> element.
     *
     * A ViewTable is a table of ViewPanes. Each ViewPane represents a single cell of the table.
     *
     * Note that the axis are part of the {@link ViewTable}, not the ViewPanes. Also note that axis' are based on scales. And scales are attached to (almost) each {@link FieldUsage} of this query, as they are reused accross many of the sub-viewPanes.
     *
     * OLD: @param paneD3 A <svg> element. This must already have a width and height.
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

      // init table canvas
      // this.canvas = initCanvas(d3.select($paneSvg.get(0)),
      //   0, // margin around the canvas
      //   {
      //     top: 5, right: 5,
      //     bottom: query.layout.cols.stackDepth * config.geometry.axis.size,
      //     left: query.layout.rows.stackDepth * config.geometry.axis.size
      //   } // padding for axis
      // );

      // extents
      initEmptyExtents(queries);
      attachExtents(queries, this.aggrCollection);
      attachExtents(queries, this.dataCollection);
      normalizeExtents(queries);

      // {x:800,y:800}, {x:0.8,y:0.8}, {x:0.2,y:0.2}

      // flag whether or not in an atomic plot the x axis (.x) (y axis (.y)) is in use, i.e. encodes some fieldusage of the model
      let used = {
        x: query.layout.cols[0] !== undefined,
        y: query.layout.rows[0] !== undefined,
      };

      // flag whether or not in an atomic plot a marginal axis will be drawn. .x (.y) is the flag for the marginal x axis (y axis)
      let marginal = {
        x: config.plots.marginal.visible.x && used.y,  // we need a marginal plot, iff the opposite letter axis is used!
        y: config.plots.marginal.visible.y && used.x
      };

      // compute ratio of templating axis to plots area
      let templAxisRatio = {
        x: 0.2,
        y: 0.2
      };

      // width and heights of a single atomic pane in normalized coordinates
      let atomicPaneSize = {
        x: (1 - templAxisRatio.x) / this.size.cols,
        y: (1 - templAxisRatio.y) / this.size.rows,
      };

      // ratio of pane width (height) used for main x (y) axis in an atomic plot
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
        templating: {x:0, y:1000}
      };

      // init layout and traces of plotly plotting specification
      let layout = {}, traces = [], mainAxes = {x: [], y: []};

      // offset of a specific atomic pane
      let paneOffset;

      this.at = new Array(this.size.rows);
      for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
        this.at[rIdx] = new Array(this.size.cols);
        paneOffset.y = atomicPaneSize.y * rIdx;

        let yaxis = config.axisGenerator.main(paneOffset.y + axisLength.marginal.y, axisLength.main.y, used.y),
          yid = idgen.main.y++;
        mainAxes.y.push(yid);
        layout[yid] = yaxis;

        for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {
          paneOffset.x = atomicPaneSize.x * cIdx;

          let xaxis, xid;
          if (rIdx === 0) {
            xaxis = config.axisGenerator.main(paneOffset.x + axisLength.marginal.x, axisLength.main.x, used.x);
            xid = idgen.main.x++;
            mainAxes.x.push(xid);
            layout[xid] = xaxis;
          } else {
            xid = mainAxes.x[cIdx];
          }

          // create marginal axes as needed
          let marginalAxisId;
          for (let xy of ['x','y']) {
            if (marginal[xy]) {
              let axis = config.axisGenerator.marginal(paneOffset[xy], axisLength.marginal[xy], xy);
              marginalAxisId[xy] = idgen.marginal[xy]++;
              layout[marginalAxisId[xy]] = axis;
            }
          }

          let atomicTraces = atomicPlotlyTraces(aggrColl[rIdx][cIdx], dataColl[rIdx][cIdx], uniColl[rIdx][cIdx], biColl[rIdx][cIdx], queries.at[rIdx][cIdx], {x:xid,y:yid}, marginalAxisId);

          traces.extent(atomicTraces);

          /**
           *
           * # about axis
           *
           * for each row of the view table one main axis is required
           * for each col of the view table one main axis is required
           * for each atomic plot one marginal x-axis is required, if y-axis is in use and if it is enabled
           * for each atomic plot one marginal y-axis is required, if x-axis is in use and if it is enabled
           *
           * in fact, either I need a marginal x-axis (y-axis) for all atomic plots or for none. This solely depends on whether there is _any_ FU on the y-axis (x-axis) of the _templated query_
           *
           * initially parameterize:
           *  * ratio of marginal to main axis size
           *  * ratio of templated axis stack to rest (later as fixed width)
           *
           * # compute/implement
           *
           * * function that creates a single templating axis: (x,y,width,height,fu,extent, startingId (?)) -> plotly axis object
           * * function that creates a single main axis (exists already?)
           * * function that creates a single marginal axis (exists already?)
           * * some tracker such that I know which axis ids are still free? If possible/enough, do that. Alternatively think about some smart pattern to encode it "intuitively".
           *    * main axis: <100, corresponding to row (col) count
           *    * marginal x-axis: 1xx
           *    * marginal y-axis
           *
           * # in what order
           * * compute width required for templating axis
           * * create templating axis
           * for rows:
           *   create y-main axis
           *     for cols:
           *       create x-main axis
           *       create marginal axis
           *       create traces
           *
           * # todo: speed optimize by providing much more information to axis? is that premature opt? probably...
           */
        }
      }

      // add templating axis
      let temply = createTemplatingAxis({x:0, y:0}, {x:templAxisRatio.x, y:1}, query.layout.rows, 'y', {x:100,y:100});
      let templx = createTemplatingAxis({x:0, y:0}, {x:1, y:templAxisRatio.y}, query.layout.cols, 'x', {x:500,y:500});
      // Object.assign(layout, templx, temply);

      // add 'global' layout options
      Object.assign(layout, {
        //height: pane.size.height,
        //width: pane.size.width,
        title: 'test title',
        barmode: 'group',
        margin: {
          l:config.plots.layout.margin, t:config.plots.layout.margin,
          r:config.plots.layout.margin, b:config.plots.layout.margin,
        }
      });

      // plot everything
      Plotly.purge(pane);
      Plotly.plot(pane, traces, layout);
    };

    return ViewTable;
  });