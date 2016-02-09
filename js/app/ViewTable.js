/**
 *
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
 *  - debug: fix for missing measures on row/column
 *  - debug: fix for multiple usage of the same field
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
  function setupCanvas(canvasD3, margin, padding) {
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
  ViewTable = function (paneD3, resultTable) {

    this.query = resultTable.query;
    this.resultTable = resultTable;

    /// one time on init:
    /// todo: is this actually "redo on canvas size change" ?

    // init table canvas
    this.canvas = setupCanvas(paneD3, 25, 25);

    // infer configuration (e.g. sizes of subplots)
    this.updateConfig();

    // add scales to field usages of this query
    this.attachScales(this.query);

    // attach mappers
    this.attachMappers(this.query);

    // shortcuts for usage
    var _config = this.config;
    var _canvas = this.canvas;
    var _aesthetics = this.query.layers[0].aesthetics;
    var _layout = this.query.layout;

    // init axis
    // 1. axis of discrete variables:
    // 2. axis of ??
    // todo: implement later

    // create table of ViewPanes
    this.at = new Array(_config.rows);
    for (let rIdx = 0; rIdx < _config.rows; rIdx++) {
      this.at[rIdx] = new Array(_config.cols);
      for (let cIdx = 0; cIdx < _config.cols; cIdx++) {

        let samples = this.resultTable.at[rIdx][cIdx];

        // subpane is a collection of variables that make up a subpane, including its data marks
        let subpane = {};

        /// create subpane
        // note: as it is a svg element no translation relative to the full view pane is required
        // note: d3 selection are arrays of arrays, hence it is a "four fold"-array. just so that you aren't confused.
        subpane.paneD3 = _canvas.canvasD3.append('svg')
          .attr({
            "width": _config.subPane.width,
            "height": _config.subPane.height,
            "x": cIdx * _config.subPane.width,
            "y": rIdx * _config.subPane.height
          });

        // @debug
        subpane.paneD3.append('rect')
          .attr({
            x: 0,
            y: 0,
            width: _config.subPane.width,
            height: _config.subPane.height,
            stroke: Settings.appearance.pane.borderColor,
            'stroke-width': 2,
            'fill': Settings.appearance.pane.fill
            //'fill-opacity': 0
          });


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
        pointsD3.attr('transform', _layout.transformMapper);

        // setup shape path generator
        // -> shape and size can be mapped by accessor-functions on the path/symbol-generator.
        let shapePathGen = d3.svg.symbol()
          .size(_aesthetics.size.mapper)
          .type(_aesthetics.shape.mapper);

        // -> color can be mapped by .attr('fill', accessor-fct) (on the path element)
        pointsD3.select(".path").attr({
          'd': shapePathGen,
          fill: _aesthetics.color.mapper
        });

        // save it
        this.at[rIdx][cIdx] = subpane;
      }
    }

    /// redo on data change

    // augment data (min, max, ...)

    // update scales (data changed)

    // add marks for new data
    // remove marks for gone data
  };


  /**
   * todo: document me
   */
  ViewTable.prototype.updateConfig = function () {
    this.config = {
      rows: this.resultTable.rows,
      cols: this.resultTable.cols
    };
    // the size of a subpane in px
    this.config.subPane = {
      height: this.canvas.height / this.config.rows,
      width: this.canvas.width  / this.config.cols
    };
  };


  /**
   * Attaches scales to each {@link FieldUsage} in the given query that needs a scale.
   * A scale is a function that maps from the domain of a {@link FieldUsage} to the range of a visual variable, like shape, color, position ...
   *
   * @param query {VisMEL} A VisMEL query.
   */
  ViewTable.prototype.attachScales = function (query) {

    /* todo: consider these notes!!
     notes:
     - a '"scale" maps values of an input domain to values of an output range.'
     - x and y scales are common for a row / column
     - this holds for both: measures and dimensions! but it seems tricky...
     - however: there definitely is always at most one scale per FieldUsage:
     - measures:
     - maps to x/y, then it's common for a whole row/column
     - maps to shape, color, size: obviously common
     - dimensions:
     - part of row/column-NSF statements: maybe there is no use for a scale here ... not sure...
     - "on details": simply splits into more marks - no other visual implication ... no scale needed
     - maps to shape, color, size: obviously needs discrete scale to shape / color / size ...
     - idea: attach scales to the field usages!?
     - "traverse" query for fieldUsages and add them accordingly!?
     */

    /* Note: aren't the scales already in the fieldUsages?! hence just in something like:
     query.layer[0].aesthetics.color.scale ?
     answer: not really, this is more a kind of "simple preprocessing/prescaling".
     but the actual scale we talk about here, are for mapping to *visual* dimensions!
     however, we will very much access the scales like that (with a different name), once we created
     them here in this function!
     */

    let aesthetics = query.layers[0].aesthetics;

    if (!_.isEmpty(aesthetics.color)) {
      aesthetics.color.visScale = ScaleGen.color(aesthetics.color);
    }

    if (!_.isEmpty(aesthetics.size)) {
      aesthetics.size.visScale = ScaleGen.position(aesthetics.size,
        [Settings.maps.minSize, Settings.maps.maxSize]);
    }

    if (!_.isEmpty(aesthetics.shape)) {
      aesthetics.shape.visScale = ScaleGen.shape(aesthetics.shape);
    }

    // todo: warum mache ich das für alle field usages in cols and rows?
    // erst einmal brauche ich nur eine scale für die measures. und die measures erstrecken sich immer entlang der subpane. später brauche ich auch scales für dimensions, um die Aufteilung der Pane zu beschriften.
    query.layout.cols.filter(F.isMeasure).forEach(
      function (c) {
        c.visScale = ScaleGen.position(c, [0, this.config.subPane.width]);
      },
      this);
    query.layout.rows.filter(F.isMeasure).forEach(
      function (c) {
        // note: invert range interval, since origin is in the upper left, not bottom left
        c.visScale = ScaleGen.position(c, [this.config.subPane.height, 0]);
      },
      this);

    // no need for scales in: filters, details
  };


  /**
   * Setup mappers for the given query. Mappers are function that map data item to visual attributes, like a svg path, color, size and others. Mappers are used in D3 to bind data to visuals.
   *
   * Before mappers can be set up, the scales need to be set up.
   *
   * todo: add mapper for hovering on marks
   */
  ViewTable.prototype.attachMappers = function (query) {
    let aesthetics = query.layers[0].aesthetics;
    let indexes = this.resultTable.indexes;

    {
      let color = aesthetics.color;
      color.mapper = (_.isEmpty(color) ?
        Settings.maps.color :
        function (d) {
          return color.visScale(d[indexes.color]);
        } );
    }
    {
      let size = aesthetics.size;
      size.mapper = (_.isEmpty(size) ?
        Settings.maps.size :
        function (d) {
          return size.visScale(d[indexes.size]);
        } );
    }
    {
      let shape = aesthetics.shape;
      shape.mapper = (_.isEmpty(shape) ?
          Settings.maps.shape:
          function (d) {
            return shape.visScale(d[indexes.shape]);
          }
      );
    }
    {
      let _layout = query.layout;
      let colFU = _layout.cols.last(),
        rowFU = _layout.rows.last();
      let colHasMeas = F.isMeasure(colFU),
        rowHasMeas = F.isMeasure(rowFU);
      let xPos = this.config.subPane.width/2,
        yPos = this.config.subPane.height/2;

      if (colHasMeas && rowHasMeas) {
        _layout.transformMapper = function (d) {
          return 'translate(' +
            colFU.visScale(d[indexes.x]) + ',' +
            rowFU.visScale(d[indexes.y]) + ')';
        };
      }
      else if (colHasMeas && !rowHasMeas) {
        _layout.transformMapper = function (d) {
          return 'translate(' +
            colFU.visScale(d[indexes.x]) + ',' +
            yPos + ')';
        };
      }
      else if (!colHasMeas && rowHasMeas) {
        _layout.transformMapper = function (d) {
          return 'translate(' +
            xPos + ',' +
            rowFU.visScale(d[indexes.y])+ ')';
        };
      }
      else {
        // todo: jitter?
        _layout.transformMapper = 'translate(' + xPos + ',' + yPos + ')';
      }
    }

  };

  return ViewTable;
}); // http://jsbin.com/viqenirimu/edit?html,output