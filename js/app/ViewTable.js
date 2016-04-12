/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * ToDo:
 *
 * http://jsbin.com/viqenirimu/edit?html,output
 *
 * @module ViewTable
 * @author Philipp Lucas
 */

define(['lib/logger', 'd3', './Field', './VisMEL', './ResultTable', './ScaleGenerator', './ViewSettings'], function (Logger, d3, F, VisMEL, ResultTable, ScaleGen, Settings) {
  "use strict";

  var logger = Logger.get('pl-ViewTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Creates a pane within the given <svg> element, respecting the given margin and padding.
   * @param canvasD3 A <svg> element wrapped in a D3 selection.
   * @param margin Margin (outer) for the drawing canvas
   * @param padding Padding (inner) for the drawing canvas
   * @returns {{}} A wrapper object that contains properties of the geometry of the pane, the pane (the root of this , its canvas (the drawing area), margin and padding
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
    canvas.width = canvas.outerWidth - canvas.margin.left - canvas.margin.right - canvas.padding.left - canvas.padding.right; // i.e. inner width
    canvas.height = canvas.outerHeight - canvas.margin.top - canvas.margin.bottom - canvas.padding.top - canvas.padding.bottom; // i.e. inner height

    // remove all previous content of canvasD3
    canvasD3.selectAll("g").remove();

    // setup the real canvas for drawing and a clip path
    canvas.canvasD3 = canvas.paneD3.append("g")
      .attr("transform", "translate(" + (canvas.margin.left + canvas.padding.left) + "," + (canvas.margin.top + canvas.padding.top) + ")");

    canvas.clipPathD3 = canvas.canvasD3
      .append("clipPath")
      .attr("id", "canvasClipPath");
    canvas.clipPathD3
      .append("rect")
      .attr({
        x: -canvas.padding.left,
        y: -canvas.padding.top,
        width: canvas.width + canvas.padding.left + canvas.padding.right,
        height: canvas.height + canvas.padding.top + canvas.padding.bottom
      });

    return canvas;
  }


  function initAtomicPaneD3 (parentD3, size, offset) {
    /// create subpane
    // note: as it is a svg element no translation relative to the full view pane is required
    // note: d3 selection are arrays of arrays, hence it is a "four fold"-array. just so that you aren't confused.
    let subPaneD3 = parentD3.append('svg')
      .attr({
        "width": size.width,
        "height": size.height,
        "x": offset.x,
        "y": offset.y
      });

    // border of subpane
    subPaneD3.append('rect')
      .attr({
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        stroke: Settings.appearance.pane.borderColor,
        'stroke-width': 2,
        'fill': Settings.appearance.pane.fill
        //'fill-opacity': 0
      });
    return subPaneD3;
  }


  function buildAtomicPane (query, samples, subPaneD3, size, extent) {

    // working variables
    let aesthetics = query.layers[0].aesthetics;
    let layout = query.layout;

    // the subpane is a collection of variables that make up a subpane, including its data marks
    let subpane = {};

    /// create subpane
    // note: as it is a svg element no translation relative to the full view pane is required
    // note: d3 selection are arrays of arrays, hence it is a "four fold"-array. just so that you aren't confused.
    subpane.paneD3 = subPaneD3;

    /// plot samples

    // create a group for point marks
    // @init
    subpane.pointsD3 = subpane.paneD3.append("g");

    /// update / remove / add marks
    // store update selection, this also creates enter and exit subselections
    // @update
    let pointsD3 = subpane.pointsD3
      .selectAll(".point")
      // todo: fix: use tuple-storage in result table already
      .data(
        // converts column based to tuple based!
        function () {
          if (samples.length === 0)
            return [];
          var len = samples[0].length;
          var tupleData = new Array(len);
          for (let i = 0; i < len; ++i) {
            tupleData[i] = samples.map(function (dim) {
              return dim[i];
            }); // jshint ignore:line
          }
          return tupleData;
        }
      ); // jshint ignore:line

    // add scales to field usages of this query
    attachScales(query, size, extent);

    // attach mappers
    attachMappers(query, samples, size);

    // add new svg elements for enter subselection
    let newPointsD3 = pointsD3
      .enter()
      .append("g")
      .classed("point mark", true);
    newPointsD3
      .append("path")
      .classed("path", true);

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

    return subpane;
  }


  /**
   * Creates axis for the templated part of the query, i.e. axis for the splitting dimensions that create the atomic panes.
   *
   * This attaches an axis object to the provided canvas, for both the horizontal and vertical axis.
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
  function setupAxis(query, canvas) {

    function _buildAxis (splittingDims, canvas, orientation) {
      /// build up axis stack
      // todo: do this for for both: horizontal and vertical
      // for horizontal axis stack
      let dimUsages = splittingDims.filter(F.isDimension);
      let stackDepth = dimUsages.length;
      let axisStack = new Array(stackDepth);
      let range = (orientation === "xaxis" ? canvas.width : canvas.height); // the range in px of current axis stack level
      let repeat = 1; // number of times the axis of the current level has to be repeated

      for (let d = 0; d < stackDepth; ++d) {
        let dimUsage = dimUsages[d];
        let elem = {};
        elem.FU = dimUsage;
        elem.scale = d3.scale.ordinal()
          .domain(dimUsage.extent)
          .rangeRoundPoints([0, range], 1.0);
        elem.axis = d3.svg.axis()
          .scale(elem.scale)
          .orient(orientation === "xaxis" ? "bottom" : "left")
          .tickSize(1, 1);

        elem.axisD3 = new Array(repeat);
        for (let r = 0; r < repeat; ++r) {
          // attach g element
          let xOffset, yOffset;
          if (orientation === "xaxis") {
            xOffset = canvas.width / repeat * r
            yOffset = canvas.height + canvas.padding.bottom / stackDepth * (stackDepth - d - 1);
          } else {
            xOffset = - canvas.padding.left / stackDepth * (stackDepth - d - 1);
            yOffset = canvas.height / repeat * r;
          }
          let axisG = canvas.canvasD3.append("g")
            .classed("axis", true)
            .attr("transform", "translate(" + xOffset + "," + yOffset + ")");
          elem.axisD3.push(axisG);

          // draw axis on it
          elem.axis(axisG);
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
    canvas.axisStack.x = _buildAxis(query.layout.cols, canvas, "xaxis");
    canvas.axisStack.y = _buildAxis(query.layout.rows, canvas, "yaxis");
  }

  /**
   * Returns a mapping from the usages to the index in the result table. e.g. the usage 'color' maps to the index of the fieldUsage that encodes color.
   * Note that this map is common for all atomic queries of a templated query.
   * @param queries
   * @returns {{}}
   */
  function usage2idx(queries) {
    // this works because the same usage always has the same index, e.g. the values that are encoded to color are at the same index in the result table for all atomic queries of one templated query

    let usage2idx = {};
    let query = queries.at[0][0];//queries.base;

    let aesthetics = query.layers[0].aesthetics;
    ['color', 'shape', 'size'].forEach(
      function (key) {
        if ( F.isFieldUsage(aesthetics[key]) )
          usage2idx[key] = aesthetics[key].index;
      }
    );

    let layout = query.layout;
    if (F.isFieldUsage(layout.cols[0]))
      usage2idx['x'] = layout.cols[0].index;
    if (F.isFieldUsage(layout.rows[0]))
      usage2idx['y'] = layout.rows[0].index;

    //let splitX

    return usage2idx;
  }

  /**
   * A ViewTable takes a ResultTable and turns it into an actual visual representation.
   * This visualization is attach to the DOM, as it is created within the limits of a given <svg> element.
   *
   * A ViewTable is a table of {@link ViewPane}s. Each {@link ViewPane} represents a single cell of the table.
   *
   * Note that the axis are part of the {@link ViewTable}, not the {@link ViewPane}s. Also note that axis' are based on scales. And scales are attached to (almost) each {@link F.FieldUsage} of this query, as they are reused accross many of the sub-{@link ViewPane}s.
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

    // init table canvas
    this.canvas = initCanvas(paneD3, 0, {top: 5, right: 5, bottom: 60, left: 60});

    // infer size of atomic plots
    this.subPaneSize = {
      height: this.canvas.height / this.size.rows,
      width: this.canvas.width  / this.size.cols
    };

    let canvas = this.canvas;
    //let u2idx = usage2idx(queries);

    /// extents
    // extents are per Field, hence are common for all of its Field Usages ??
    // todo: really? what about multiple use as continuous and discrete field usage?
    let extents = globalExtents(query, queries, results); //, u2idx);
    // todo: also attach extents to table algebra FU ... needed to create proper axis. just resplitting is no option, since filters or other may have reduced the actual values in the result table

    setupAxis(query, this.canvas);

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
        let subPaneD3 = initAtomicPaneD3(
          canvas.canvasD3,
          this.subPaneSize,
          {x: cIdx * this.subPaneSize.width, y: rIdx * this.subPaneSize.height}
        );

        this.at[rIdx][cIdx] = buildAtomicPane(
          this.queries.at[rIdx][cIdx],
          this.results.at[rIdx][cIdx],
          subPaneD3,
          this.subPaneSize,
          { color: extents.color,
            shape: extents.shape,
            size: extents.size,
            row: extents.row[rIdx],
            col: extents.col[cIdx]
          }
        );
      }
    }
  };

  /**
   * Returns a collection of 'global' extents of the values of those {@link FieldUsage}s that are mapped to visuals.
   * Note that results may consist of single values, but also of intervals (continuous FU) and sets of single values (discrete FU).
   * For discrete {@link FieldUsage}s the extent is the set of unique values / tuple of values that occurred in the results for this particular {@link FieldUsage}. Tuple are not reduced to their individual values.
   * For continuous {@link FieldUsage}s the extent is the minimum and maximum value that occurred in the results of this particular {@link FieldUsage}, wrapped as an 2-element array. Intervals are reduced to their bounding values.
   *
   * The returned extent consists of:
   *
   *   - splitX: extent
   *
   *
   * @param queries
   * @param results
   */
  var globalExtents = function (query, queries, results, u2idx) {

    /**
     * Utility function. Takes the "so-far extent", new data to update the extent for and a flag that informs about the kind of data: discrete or continuous.
     * @returns The updated extent
     */
    function extentUnion(e1, e2, discreteFlag) {
      return (discreteFlag ? _.union(e1, e2) : d3.extent([...e1, ...e2]) );
    }

    //for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
    //  for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
    //    u2idx.keys
    //  }
    //}

    // todo: fix this ???
    query.layout.rows.filter(F.isDimension).forEach( function (dim) {
      dim.extent = dim.splitToValues();
    });

    query.layout.cols.filter(F.isDimension).forEach( function (dim) {
      dim.extent = dim.splitToValues();
    });

    // todo: what is splitX splitY again?
    let splitX = query.layout.rows.filter(F.isDimension).map( function (dim) {
      //return results[dim.index].extent;
      // this works since dimension filters are applied before templating is done, and since there is no way that atomic queries/panes disappear (as opposed to aggregation values, which may be removed due to filters on aggregations)
      return dim.splitToValues();
    } );
    let splitY = query.layout.cols.filter(F.isDimension).map( function (dim) {
      return dim.splitToValues();
    } );

    let color = [],
      shape = [],
      size = [];
    // iterate over results for each atomic query
    let row = new Array(queries.size.rows);
    for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
      row[rIdx] = [];
      for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
        let r = results.at[rIdx][cIdx],
          q = queries.at[rIdx][cIdx];

        // aesthetics extents
        let qa = q.layers[0].aesthetics;
        if (F.isFieldUsage(qa.color))
          color = extentUnion(color, r[qa.color.index].extent, qa.color.isDiscrete());
        if (F.isFieldUsage(qa.shape))
          shape = extentUnion(shape, r[qa.shape.index].extent, qa.shape.isDiscrete());
        if (F.isFieldUsage(qa.size))
          size = extentUnion(size, r[qa.size.index].extent, qa.size.isDiscrete());

        // row extents
        let lr = q.layout.rows[0];
        if (F.isMeasure(lr))
          row[rIdx] = extentUnion(row[rIdx], r[lr.index].extent, lr.isDiscrete());
      }
    }

    // column extents
    let col = new Array(queries.size.cols);
    for (let cIdx = 0; cIdx < queries.size.cols; ++cIdx) {
      col[cIdx] = [];
      for (let rIdx = 0; rIdx < queries.size.rows; ++rIdx) {
        let r = results.at[rIdx][cIdx],
          q = queries.at[rIdx][cIdx];
        let lc = q.layout.cols[0];
        if (F.isMeasure(lc))
          col[cIdx] = extentUnion(col[cIdx], r[lc.index].extent, lc.isDiscrete());
      }
    }

    return {
      color: color,
      shape: shape,
      size: size,
      row: row,
      col: col,
      splitX: splitX,
      splitY: splitY
    };
  };

  /**
   * Attaches scales to each {@link FieldUsage} in the given query that needs a scale.
   * A scale is a function that maps from the domain of a {@link FieldUsage} to the range of a visual variable, like shape, color, position ...
   *
   * @param query {VisMEL} A VisMEL query.
   * @param paneSize {{width, height}} Width and heights of the target pane in px.
   */
  var attachScales = function (query, paneSize, extent) {

    let aesthetics = query.layers[0].aesthetics;

    if (F.isFieldUsage(aesthetics.color))
      aesthetics.color.visScale = ScaleGen.color(aesthetics.color, extent.color);

    if (F.isFieldUsage(aesthetics.size))
      aesthetics.size.visScale = ScaleGen.position(aesthetics.size, extent.size, [Settings.maps.minSize, Settings.maps.maxSize]);

    if (F.isFieldUsage(aesthetics.shape))
      aesthetics.shape.visScale = ScaleGen.shape(aesthetics.shape, extent.shape);

    let row = query.layout.rows[0];
    if (F.isFieldUsage(row) && row.isMeasure())
      row.visScale = ScaleGen.position(row, extent.row, [0, paneSize.height]);
    // else: todo: scale for dimensions? in case I decide to keep the "last dimension" in the atomic query

    let col = query.layout.cols[0];
    if (F.isFieldUsage(col) && col.isMeasure())
      col.visScale = ScaleGen.position(col, extent.col, [paneSize.width, 0]);

    // no need for scales of: filters, details
  };


  /**
   * Setup mappers for the given query. Mappers are function that map data item to visual attributes, like a svg path, color, size and others. Mappers are used in D3 to bind data to visuals.
   *
   * Before mappers can be set up, the scales need to be set up.
   *
   * todo: add mapper for hovering on marks
   */
  var attachMappers = function (query, results, paneSize) {
    let aesthetics = query.layers[0].aesthetics;

    let color = aesthetics.color;
    color.mapper = ( F.isFieldUsage(color) ?
      function (d) {
        return color.visScale(d[color.index]);
      } :
      Settings.maps.color );

    let size = aesthetics.size;
    size.mapper = ( F.isFieldUsage(size) ?
      function (d) {
        return size.visScale(d[size.index]);
      } :
      Settings.maps.size );

    let shape = aesthetics.shape;
    shape.mapper = ( F.isFieldUsage(shape) ?
      function (d) {
        return shape.visScale(d[shape.index]);
      } :
      Settings.maps.shape );

    let layout = query.layout;
    let colFU = layout.cols[0],
      rowFU = layout.rows[0];
    let isColMeas = F.isMeasure(colFU),
      isRowMeas = F.isMeasure(rowFU);
    let xPos = paneSize.width / 2,
      yPos = paneSize.height / 2;

    if (isColMeas && isRowMeas) {
      layout.transformMapper = function (d) {
        return 'translate(' +
          colFU.visScale(d[colFU.index]) + ',' +
          rowFU.visScale(d[rowFU.index]) + ')';
      };
    }
    else if (isColMeas && !isRowMeas) {
      layout.transformMapper = function (d) {
        return 'translate(' +
          colFU.visScale(d[colFU.index]) + ',' +
          yPos + ')';
      };
    }
    else if (!isColMeas && isRowMeas) {
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