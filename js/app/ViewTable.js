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
 */

define(['lib/logger', 'd3', './PQL', './VisMEL', './ResultTable', './SplitSample', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3, PQL, VisMEL, ResultTable, S, ScaleGen, Settings) {
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
    canvas.outerWidth = canvas.paneD3.attr2num("width");
    canvas.outerHeight = canvas.paneD3.attr2num("height");
    canvas.padding = padding;
    canvas.margin = margin;

    canvas.size = {
      width: canvas.outerWidth - canvas.margin.left - canvas.margin.right - canvas.padding.left - canvas.padding.right, // i.e. inner width
      height : canvas.outerHeight - canvas.margin.top - canvas.margin.bottom - canvas.padding.top - canvas.padding.bottom // i.e. inner height
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
        stroke: Settings.appearance.pane.borderColor,
        'stroke-width': 2,
        'fill': Settings.appearance.pane.fill
        //'fill-opacity': 0
      });
    // the subpane is a collection of variables that make up a subpane, including its data marks
    return {
      paneD3: subPaneD3,
      size: {width, height}
    };
  }


  /**
   * Draws the given atomic query using given data into the pane and returns the pane.
   * @param query
   * @param data
   * @param pane
   * @returns {pane}
   */
  function drawAtomicPane(query, data, pane) {

    // working variables
    let aesthetics = query.layers[0].aesthetics;
    let layout = query.layout;

    /// plot samples
    // create a group for point marks
    // @init
    pane.pointsD3 = pane.paneD3.append("g");

    /// update / remove / add marks
    // store update selection, this also creates enter and exit subselections
    // @update
    let pointsD3 = pane.pointsD3
      .selectAll(".point")
      .data(data);

    // add scales to field usages of this query
    attachScales(query, pane.size);

    // attach mappers
    attachMappers(query, pane.size, data);

    // add new svg elements for enter subselection
    let newPointsD3 = pointsD3
      .enter()
      .append("g")
      .classed("point mark", true);
    newPointsD3
      .append("path")
      .classed("path", true);
    
    // add hover for data 
    newPointsD3
      .append("svg:title")
      .text(aesthetics.hoverMapper);

    // the just appended elements are now part of the update selection!
    // -> now update all the same way

    // set position of shapes by translating the enclosing g group
    // @specific for each view cell
    pointsD3.attr('transform', layout.transformMapper);

    // setup shape path generator
    // -> shape and size can be mapped by accessor-functions on the path/symbol-generator.
    // @common for all view cells
    let shapePathGen = d3.svg.symbol()
      .size(aesthetics.size.mapper)
      .type(aesthetics.shape.mapper);

    // -> color can be mapped by .attr('fill', accessor-fct) (on the path element)
    // @common for all view cells
    pointsD3.select(".path").attr({
      'd': shapePathGen,
      fill: aesthetics.color.mapper
    });

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
        templSplitDims = (()=>{let foo=fieldUsages.filter(PQL.isSplit); foo.pop(); return foo;})(), // in any case do not consider the last element
        templSplitStackDepth = templSplitDims.length;

      let axisStack = new Array(templSplitStackDepth); // axis stack
      let range = (axisType === "x axis" ? canvas.size.width : canvas.size.height); // the range in px of current axis stack level
      let repeat = 1; // number of times the axis of the current level has to be repeated

      for (let d = 0; d < templSplitStackDepth; ++d) {
        let stackOffset = Settings.geometry.axis.size * (stackDepth - d - 1);
        let dimUsage = templSplitDims[d];
        let elem = {};
        elem.FU = dimUsage;
        elem.scale = d3.scale.ordinal()
          .domain(dimUsage.extent)
          .rangeRoundPoints([0, range], 1.0);
        elem.axis = d3.svg.axis()
          .scale(elem.scale)
          .orient(axisType === "x axis" ? "bottom" : "left")
          .tickSize(0, Settings.geometry.axis.outerTickSize);

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
              ots = Settings.geometry.axis.outerTickSize,
              pad = d * Settings.geometry.axis.padding / stackDepth,
              reducedRange = [pad, range - pad];
            if (axisType === "x axis")
              axisG.select("path.domain").attr("d", "M" + reducedRange[0] + "," + sign * ots + "H" + reducedRange[1]);
            else
              axisG.select("path.domain").attr("d", "M" + sign * ots + "," + reducedRange[0] + "V" + reducedRange[1]);
          }

          // tweak tick labels
          {
            axisG.selectAll("text")
              .attr("font-size", Settings.geometry.axis.tickFontSizePx + "px");
            if (axisType === "y axis")
              axisG.selectAll("text")
                .attr("y", "-0.6em")
                .attr("transform", "rotate(-90)")
                .style("text-anchor", "middle");
          }

          // add axis label
          {
            let x = axisType === "x axis" ? canvas.size.width / repeat / 2 : -(Settings.geometry.axis.labelFontSizePx * 2 - 4),
              y = axisType === "y axis" ? canvas.size.height / repeat / 2 : Settings.geometry.axis.labelFontSizePx * 2 + 4;
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

    axis.axisD3 = pane.paneD3.append("g").classed(axisType, true);
    if (axisType === "x axis")
      axis.axisD3.attr("transform", "translate(0," + pane.size.height + ")");
    
    axis.axis = d3.svg.axis()
      .scale(axis.FU.visScale)
      .orient(axisType === "x axis" ? "bottom" : "left")
      .tickSize(-(axisType === "x axis" ? canvasSize.height : canvasSize.width), 1);
    
    // draw axis    
    axis.axis(axis.axisD3);

    axis.axisD3.selectAll("text")
      .attr("font-size", Settings.geometry.axis.tickFontSizePx + "px");

    if (axisType === "y axis") {
      axis.axisD3.selectAll("text")
        .attr("y", "-0.6em")
        .attr("transform", "rotate(-90)")
        .style("text-anchor", "middle");
    }

    // add field usage name, i.e. label of axis
    let x = axisType === "x axis" ? pane.size.width / 2 : -(Settings.geometry.axis.labelFontSizePx * 2 + 4),
      y = axisType === "y axis" ? pane.size.height / 2 : Settings.geometry.axis.labelFontSizePx * 2 + 4;
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

  /**
   * A ViewTable takes a ResultTable and turns it into an actual visual representation.
   * This visualization is attach to the DOM, as it is created within the limits of a given <svg> element.
   *
   * A ViewTable is a table of ViewPanes. Each ViewPane represents a single cell of the table.
   *
   * Note that the axis are part of the {@link ViewTable}, not the ViewPanes. Also note that axis' are based on scales. And scales are attached to (almost) each {@link FieldUsage} of this query, as they are reused accross many of the sub-viewPanes.
   *
   * @param paneD3 A <svg> element, wrapped in a D3 selection. This must already have a width and height.
   * @param [resultTable] The {@link ResultTable} to visualize with this viewTable.
   * @constructor
   * @alias module:ViewTable
   */
  var ViewTable;
  ViewTable = function (paneD3, results, queries) {

    this.results = results;
    this.queries = queries;
    this.size = results.size;
    let query = queries.base;

    /// one time on init:
    /// todo: is this actually "redo on canvas size change" ?

    // axis stack depth
    [query.layout.rows, query.layout.cols].forEach(
      rc => {
        rc.stackDepth = rc.filter(PQL.isSplit).length + !rc.filter(PQL.isAggregationOrDensity).empty();
      }
    );

    // init table canvas
    this.canvas = initCanvas(paneD3,
      0, // margin around the canvas
      {
        top: 5, right: 5,
        bottom: query.layout.cols.stackDepth * Settings.geometry.axis.size,
        left: query.layout.rows.stackDepth * Settings.geometry.axis.size
      } // padding for axis
    );

    // infer size of atomic plots
    this.subPaneSize = {
      height: this.canvas.size.height / this.size.rows,
      width: this.canvas.size.width / this.size.cols
    };

    // extents
    attachExtents(query, queries, results);

    // create scales
    // todo: move scales outside of atomic panes, like extents

    // create visuals mappers
    // todo: move mappers outside of atomic panes, like extents

    // create axis
    // todo: implement
    // find a nice way to create the stack of them. somehow matches the result of the table algebra stuff ... ?!

    // create table of ViewPanes
    this.at = new Array(this.size.rows);
    for (let rIdx = 0; rIdx < this.size.rows; ++rIdx) {
      this.at[rIdx] = new Array(this.size.cols);
      for (let cIdx = 0; cIdx < this.size.cols; ++cIdx) {

        let subPane = addAtomicPane(
          this.canvas.canvasD3,
          this.subPaneSize,
          {x: cIdx * this.subPaneSize.width, y: rIdx * this.subPaneSize.height}
        );

        this.at[rIdx][cIdx] = drawAtomicPane(
          this.queries.at[rIdx][cIdx],
          this.results.at[rIdx][cIdx],
          subPane
        );

        if (cIdx === 0) attachAtomicAxis(this.at[rIdx][cIdx], this.queries.at[rIdx][cIdx], this.canvas.size, 'y axis');
        if (rIdx === (this.size.rows - 1)) attachAtomicAxis(this.at[rIdx][cIdx], this.queries.at[rIdx][cIdx], this.canvas.size, 'x axis');
      }
    }

    setupTemplatingAxis(query, this.canvas);
  };

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
   * @param query
   * @param queries
   * @param results
   */
  var attachExtents = function (query, queries, results) {

    /**
     * Utility function. Takes the "so-far extent", new data to update the extent for and a flag that informs about the kind of data: discrete or continuous.
     * @returns The updated extent
     */
    function _extentUnion(extent, newData, discreteFlag) {
      return (discreteFlag ? _.union(extent, newData) : d3.extent([...extent, ...newData]) );
    }

    /**
     * Tweaks for continuous extents.
     * (1) non-singular extent: add 5% of extent to upper and lower bound of extent
     * (2) singular extent and singular !== 0: upper = singular+5%*singular, lower = singular-5%*singular
     * (3) singular extent and singular === 0: upper = 1 , lower = -1
     */
    function _normalize (extent) {
      if (extent.length === 2) { // iff continuous extent
        if (extent[0] === extent[1]) { // if singular
          let singular = extent[0];
          if (singular === 0)
            extent = [-1, 1];
          else
            extent = [singular - 0.05*singular, singular + 0.05*singular];
        } else {
          let relOff = 0.05*(extent[1]-extent[0]);
          extent = [extent[0] - relOff, extent[1] + relOff];
        }
      }
      return extent;
    }

    // extents of splits in table algebra expression
    [...query.layout.rows, ...query.layout.cols].filter(PQL.isSplit).forEach( dim => {
      // we get the actuall value of the bounded domain of this field
      let field = dim.field;
      dim.extent = field.domain.bounded(field.extent).value;
    });

    // note: row and column extent mean the extent of the single measure left on row / column for atomic queries. these are are common across one row / column of the view table
    let color = [],
      shape = [],
      size = [];

    // init empty extent for measure on ROWS/COLS
    [...query.layout.cols, ...query.layout.rows].filter(PQL.isAggregationOrDensity).forEach(
      m => m.extent = []
    );

    // iterate over results for each atomic query
    let row = new Array(queries.size.rows);
    for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
      row[rIdx] = [];
      for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
        let r = results.at[rIdx][cIdx],
          q = queries.at[rIdx][cIdx];

        // aesthetics extents
        let qa = q.layers[0].aesthetics;
        if (qa.color instanceof VisMEL.ColorMap) 
          color = _extentUnion(color, r.extent[qa.color.fu.index], PQL.hasDiscreteYield(qa.color.fu));
        if (qa.shape instanceof VisMEL.ShapeMap)
          shape = _extentUnion(shape, r.extent[qa.shape.fu.index], PQL.hasDiscreteYield(qa.shape.fu));
        if (qa.size instanceof VisMEL.SizeMap)
          size = _extentUnion(size, r.extent[qa.size.fu.index], PQL.hasDiscreteYield(qa.size.fu));

        // row and column extents
        // note that lc.extent and lr.extent reference to the _same_ fieldUsage for all queries in one column / row. thats why this works.
        let lr = q.layout.rows[0];
        if (PQL.isAggregationOrDensity(lr))
          lr.extent = _extentUnion(lr.extent, r.extent[lr.index], PQL.hasDiscreteYield(lr));
        let lc = q.layout.cols[0];
        if (PQL.isAggregationOrDensity(lc))
          lc.extent = _extentUnion(lc.extent, r.extent[lc.index], PQL.hasDiscreteYield(lc));
      }
    }

    // normalize row and column extents
    for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
      let lc = queries.at[0][cIdx].layout.cols[0];
      if (PQL.isFieldUsage(lc))
        lc.extent = _normalize(lc.extent);
    }
    for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
      let lr = queries.at[rIdx][0].layout.rows[0];
      if (PQL.isFieldUsage(lr))
        lr.extent = _normalize(lr.extent);
    }

    // attach extents to field usages of all queries. Note that all atomic queries use references to the field usages of the base query
    {
      let qa = query.layers[0].aesthetics;
      if (qa.color instanceof VisMEL.ColorMap) qa.color.fu.extent = _normalize(color);
      if (qa.shape instanceof VisMEL.ShapeMap) qa.shape.fu.extent = _normalize(shape);
      if (qa.size instanceof VisMEL.SizeMap) qa.size.fu.extent = _normalize(size);
    }
  };

  /**
   * Attaches scales to each {@link FieldUsage} in the given query that needs a scale.
   * A scale is a function that maps from the domain of a {@link FieldUsage} to the range of a visual variable, like shape, color, position ...
   *
   * Before scales can be set, extents needs to be set for each FieldUsage.
   *
   * @param query {VisMEL} A VisMEL query.
   * @param paneSize {{width, height}} Width and heights of the target pane in px.
   */
  var attachScales = function (query, paneSize) {

    let aesthetics = query.layers[0].aesthetics;

    if (aesthetics.color instanceof VisMEL.ColorMap)
      aesthetics.color.visScale = ScaleGen.color(aesthetics.color, aesthetics.color.fu.extent);

    if (aesthetics.size instanceof VisMEL.SizeMap)
      aesthetics.size.visScale = ScaleGen.size(aesthetics.size, aesthetics.size.fu.extent, [Settings.maps.minSize, Settings.maps.maxSize]);

    if (aesthetics.shape instanceof VisMEL.ShapeMap)
      aesthetics.shape.visScale = ScaleGen.shape(aesthetics.shape, aesthetics.shape.fu.extent);

    // let row = query.layout.rows[0];
    // if (PQL.isFieldUsage(row))
    //   row.visScale = ScaleGen.position(row, row.extent, [Settings.geometry.axis.padding, paneSize.height - Settings.geometry.axis.padding]);
    //
    // let col = query.layout.cols[0];
    // if (PQL.isFieldUsage(col))
    //   col.visScale = ScaleGen.position(col, col.extent, [paneSize.width - Settings.geometry.axis.padding, Settings.geometry.axis.padding]);

    let row = query.layout.rows[0];
    if (PQL.isFieldUsage(row))
      row.visScale = ScaleGen.position(row, row.extent, [paneSize.height - Settings.geometry.axis.padding, Settings.geometry.axis.padding]);

    let col = query.layout.cols[0];
    if (PQL.isFieldUsage(col))
      col.visScale = ScaleGen.position(col, col.extent, [Settings.geometry.axis.padding, paneSize.width - Settings.geometry.axis.padding]);

    // else: todo: scale for dimensions? in case I decide to keep the "last dimension" in the atomic query

    // no need for scales of: filters, details
  };


  /**
   * Setup mappers for the given query. Mappers are function that map data item to visual attributes, like a svg path,
   * color, size and others. Mappers are used in D3 to bind data to visuals.
   *
   * Before mappers can be set up, the scales need to be set up.
   *
   * todo: add mapper for hovering on marks
   */
  var attachMappers = function (query, paneSize, data) {
    let aesthetics = query.layers[0].aesthetics;

    // todo: performance: improve test for interval vs value? e.g. don't test single data items, but decide for each variable
    function _valueOrAvg(data) {
      return _.isArray(data) ? data[0] + data[1] / 2 : data;
    }

    let color = aesthetics.color;
    color.mapper = ( color instanceof VisMEL.ColorMap ?
      d => color.visScale(_valueOrAvg(d[color.fu.index])) :
      Settings.maps.color );

    let size = aesthetics.size;
    size.mapper = ( size instanceof VisMEL.SizeMap ?
      function (d) {
        return size.visScale(_valueOrAvg(d[size.fu.index]));
      } :
      Settings.maps.size );

    let shape = aesthetics.shape;
    shape.mapper = ( shape instanceof VisMEL.ShapeMap ?
      function (d) {
        return shape.visScale(_valueOrAvg(d[shape.fu.index]));
      } :
      Settings.maps.shape );

    aesthetics.hoverMapper = (d) => d.reduce(
      (prev,di,i) => prev + data.header[i] + ": " + di + "\n", "");

    let layout = query.layout;
    let colFU = layout.cols[0],
      rowFU = layout.rows[0];
    let isColFU = PQL.isFieldUsage(colFU),
      isRowFU = PQL.isFieldUsage(rowFU);
    let xPos = paneSize.width / 2,
      yPos = paneSize.height / 2;

    if (isColFU && isRowFU) {
      layout.transformMapper = function (d) {
        return 'translate(' +
          colFU.visScale(d[colFU.index]) + ',' +
          rowFU.visScale(d[rowFU.index]) + ')';
      };
    }
    else if (isColFU && !isRowFU) {
      layout.transformMapper = function (d) {
        return 'translate(' +
          colFU.visScale(d[colFU.index]) + ',' +
          yPos + ')';
      };
    }
    else if (!isColFU && isRowFU) {
      layout.transformMapper = function (d) {
        return 'translate(' +
          xPos + ',' +
          rowFU.visScale(d[rowFU.index]) + ')';
      };
    }
    else {
      // todo: jitter?
      layout.transformMapper = 'translate(' + xPos + ',' + yPos + ')';
    }

  };

  return ViewTable;
});