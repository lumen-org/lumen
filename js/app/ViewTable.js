/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * ToDo:
 *  - split into ViewPanes instead of a whole view table?
 *  - debug: fix for multiple measures on row/column
 *  - debug: fix for multiple usage of the same field
 *  - debug: fix for 3 dims on rows/cols
 *
 * // http://jsbin.com/viqenirimu/edit?html,output
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


  function buildAtomicPane (query, samples, subPaneD3, size) {

    // working variables
    let aesthetics = query.layers[0].aesthetics;
    let layout = query.layout;

    // add scales to field usages of this query
    attachScales(query, size);

    // attach mappers
    attachMappers(query, samples, size);

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
   * todo: is that needed?
   * todo: document me
   * @param canvas
   *
  function setupAxis(canvas) {
    canvas.axis = {};
    canvas.axis.x = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0," + (canvas.height + canvas.padding.bottom) + ")");
    canvas.axis.y = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(" + (-canvas.padding.left) + ",0)");
  }*/


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
    this.query = queries.base;
    this.size = results.size;

    /// one time on init:
    /// todo: is this actually "redo on canvas size change" ?

    // init table canvas
    this.canvas = initCanvas(paneD3, 25, 25);

    // infer size of atomic plots
    this.subPaneSize = {
      height: this.canvas.height / this.size.rows,
      width: this.canvas.width  / this.size.cols
    };

    let canvas = this.canvas;

    // create axis
    // todo: implement

    // create table of ViewPanes
    this.at = new Array(this.size.rows);
    for (let rIdx = 0; rIdx < this.size.rows; rIdx++) {
      this.at[rIdx] = new Array(this.size.cols);
      for (let cIdx = 0; cIdx < this.size.cols; cIdx++) {
        let subPaneD3 = initAtomicPaneD3(
          canvas.canvasD3,
          this.subPaneSize,
          {x: cIdx * this.subPaneSize.width, y: rIdx * this.subPaneSize.height}
        );
        this.at[rIdx][cIdx] = buildAtomicPane(
          this.queries.at[rIdx][cIdx],
          this.results.at[rIdx][cIdx],
          subPaneD3,
          this.subPaneSize
        );
      }
    }
  };


  /**
   * Attaches scales to each {@link FieldUsage} in the given query that needs a scale.
   * A scale is a function that maps from the domain of a {@link FieldUsage} to the range of a visual variable, like shape, color, position ...
   *
   * @param query {VisMEL} A VisMEL query.
   * @param paneSize {width, height} Width and heights of the target pane in px.
   */
  var attachScales = function (query, paneSize) {

    let aesthetics = query.layers[0].aesthetics;

    if (F.isFieldUsage(aesthetics.color))
      aesthetics.color.visScale = ScaleGen.color(aesthetics.color);

    if (F.isFieldUsage(aesthetics.size))
      aesthetics.size.visScale = ScaleGen.position(aesthetics.size, [Settings.maps.minSize, Settings.maps.maxSize]);

    if (F.isFieldUsage(aesthetics.shape))
      aesthetics.shape.visScale = ScaleGen.shape(aesthetics.shape);

    let row = query.layout.rows[0];
    if (F.isFieldUsage(row) && row.isMeasure())
      row.visScale = ScaleGen.position(row, [0, paneSize.width]);
    // else: todo: scale for dimensions? in case I decide to keep the "last dimension" in the atomic query

    let col = query.layout.cols[0];
    if (F.isFieldUsage(col) && col.isMeasure())
      col.visScale = ScaleGen.position(col, [paneSize.height, 0]);

    // no need for scales in: filters, details
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