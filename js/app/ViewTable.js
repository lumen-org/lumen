/**
 *
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

define(['lib/logger', 'd3', 'lib/colorbrewer', './Field', './VisMEL', './ResultTable'], function (Logger, d3, cbrew, F, VisMEL, ResultTable) {
  "use strict";

  var logger = Logger.get('pl-ViewTable');
  logger.setLevel(Logger.DEBUG);

  var scaleGenerator = {};
  /**
   * Creates a color scale based on a given field usage.
   * @param fu A {@link FieldUsage}.
   * @returns the created color scale.
   * todo: respect scales and ordering as set in the FUsageT attributes
   */
  scaleGenerator.color = function (fu) {
    // the following is how I think this may be done for the color mapping.
    var colormap = [],
      scale = [];
    switch(fu.kind) {
      case F.FieldT.Kind.cont:
        scale = d3.scale.linear();
        colormap = cbrew.Blues["9"];
        break;
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal();
        var l = fu.domain.length;
        if (l <= 2) {
          colormap = cbrew.Set1[3].slice(0, l);
        } else if (l <= 9) {
          colormap = cbrew.Set1[l];
        } else { //if (l <= 12) {
          if (l > 12) {
            logger.warn("the domain of the dimension " + fu.name + " has too many elements: " + l + "\n I'll just use 12, anyway.");
            l = 12;
          }
          colormap = cbrew.Paired[l];
        }
        break;
      default:
        throw new TypeError("invalid Field.Kind" + fu.kind);
    }
    return scale.domain(fu.domain)
      .range(colormap);
  };


  /**
   * Creates a 'positional' scale based on given field usage and desired range.
   * @param fu A {@link FieldUsage}.
   * @param range
   */
  scaleGenerator.pos = function (fu, range) {
    var scale = [];
    switch(fu.kind) {
      case F.FieldT.Kind.cont:
        // continuous domain: todo: map according to FUsageT.Scale attribute
        scale = d3.scale.linear()
          .domain(fu.domain)
          .range(range);
        break;
      case F.FieldT.Kind.discrete:
        // categorial domain: map to center of equally sized bands
        scale = d3.scale.ordinal()
          .domain(fu.domain)
          .rangeRoundPoints(range, 1.0);  // 1.0 makes points centered in their band
        break;
      default:
        throw new TypeError("invalid Field.Kind: " + fu.kind);
    }
    return scale;
  };
  // todo: all the other aesthetics


  /**
   * Creates a canvas within the given <svg> element, respecting the given margin and padding.
   * @param paneD3 A <svg> element wrapped in a D3 selection.
   * @param margin Margin (outer) for the drawing canvas
   * @param padding Padding (inner) for the drawing canvas
   * @returns {{}} A wrapper object that contains the basic the geometry of the pane, its canvas (the drawing area), margin and padding
   */
  function setupCanvas(paneD3, margin, padding) {
    // normalize arguments
    if (_.isFinite(margin))
      margin = {top: margin, right: margin, bottom: margin, left: margin};
    if (_.isFinite(padding))
      padding = {top: padding, right: padding, bottom: padding, left: padding};

    // setup basic geometry of actual drawing canvas, with margin (outer) and padding (inner)
    var canvas = {};
    canvas.paneD3 = paneD3;
    canvas.outerWidth  = canvas.paneD3.attr2num("width");
    canvas.outerHeight = canvas.paneD3.attr2num("height");
    canvas.padding  = padding;
    canvas.margin = margin;
    canvas.width   = canvas.outerWidth - canvas.margin.left - canvas.margin.right -  canvas.padding.left - canvas.padding.right; // i.e. inner width
    canvas.height  = canvas.outerHeight- canvas.margin.top - canvas.margin.bottom - canvas.padding.top - canvas.padding.bottom; // i.e. inner height

    // setup the real canvas for drawing and a clippath
    canvas.canvasD3 = canvas.paneD3.append("g")
      .attr("transform", "translate(" + (canvas.margin.left + canvas.padding.left) + "," + (canvas.margin.top + canvas.padding.top) + ")");
    canvas.clipPathD3 = canvas.canvasD3
      .append("clipPath")
      .attr("id", "canvasClipPath");
    canvas.clipPathD3
      .append("rect")
      .attr({
        x : -canvas.padding.left,
        y : -canvas.padding.top,
        width: canvas.width + canvas.padding.left + canvas.padding.right,
        height: canvas.height+ canvas.padding.top + canvas.padding.bottom
      });
    
    return canvas;
  }


  /**
   * todo: is that needed?
   * todo: document me
   * @param canvas
   */
  function setupAxis(canvas) {
    canvas.axis = {};
    canvas.axis.x = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0," + (canvas.height + canvas.padding.bottom) + ")");
    canvas.axis.y = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(" + (-canvas.padding.left) + ",0)");
  }


    /**
   * A ViewTable takes a ResultTable and turns it into an actual visual representation.
   * This visualization is attach to the DOM, as it is created within the limits of a given <svg> element.
   *
   * A ViewTable is, as you would expect, a table of {@link ViewPane}s. Each {@link ViewPane} represents a single cell of the table.
   *
   * Note that the axis are part of the {@link ViewTable}, not the {@link ViewPane}s. Also note that axis' are based on scales. And scales are attached to (almost) each {@link F.FieldUsage} of this query, as they are reused accross many of the sub-{@link ViewPane}s.
   *
   * @param paneD3 A <svg> element, wrapped in a D3 selection. This must already have a width and height.
   * @param [resultTable] The {@link ResultTable} to visualize with this viewTable.
   * @constructor
   * @alias module:ViewTable
   */
  var ViewTable; ViewTable = function (paneD3, resultTable) {

    this.query = resultTable.query;
    this.resultTable = resultTable;

    /// one time on init:
    /// todo: is this actually "redo on canvas size change" ?

    // init table canvas
    this.canvas = setupCanvas(paneD3, 25, 25);

    // infer configuration (e.g. sizes of subplots)
    this.updateConfig();

    // add scales to field usages of this query
    this.setupScales(this.query);

    // init axis
    // 1. axis of discrete variables:

    // 2. axis of

    // create table of ViewPanes
    this.at = new Array(this.config.rows);
    for (var rIdx=0; rIdx<this.config.rows; rIdx++) {
      this.at[rIdx] = new Array(this.config.cols);
      for (var cIdx=0; cIdx<this.config.rows; cIdx++) {
        // todo: continue here
        this.at[rIdx][cIdx] = 1;
      }
    }

    /// redo on data change

    // augment data (min, max, ...)

    // update scales (data changed)

    // add marks for new data
    // remove marks for gone data

    // update visual attributes of current marks

    if (resultTable)
      this.update(resultTable);
  };


  ViewTable.prototype.updateConfig = function () {
    this.config = {
      rows: this.resultTable.rows,
      cols: this.resultTable.cols
    };
    // the size of a subpane in px
    this.config.subPane = {
      height: this.canvas.width / this.config.cols,
      width: this.canvas.height / this.config.rows
    };
  };


  /**
   * Attaches scales to each {@link FieldUsage} in the given query that needs a scale.
   * A scale in this context is a function that maps from the domain of a {@link FieldUsage} to the range the visual variable representing it in the visualization.
   * @param query {VisMEL} A VisMEL query.
   */
  ViewTable.prototype.setupScales = function (query) {

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

    var aesthetics = query.layers[0].aestetics;
    aesthetics.color.visScale = scaleGenerator.color(aesthetics.color);

    query.layout.cols.forEach( function(c){c.visScale = scaleGenerator.pos(c, this.config.subPane.width);}, this );
    query.layout.rows.forEach( function(c){c.visScale = scaleGenerator.pos(c, this.config.subPane.height);}, this );

    //aesthetics.color.visScale = ... todo!!
    // set domain: already there for dimensions. what to do for measures? todo: implement too!
    // set range :
    // set interpolation?

    // no need for scales in: filters, details

    // then, i can use it like this, for example:
    // heights.visScale(180); // assuming heights is a FieldUsage :)
  };


  /**
   * Update this {@link ViewTable} with the given {@link ResultTable}.
   */
  ViewTable.prototype.update = function (resultTable) {
    //todo? just create a new ViewTable ... :-)
  };


  /**
   * A ViewPane is a
   */
  var ViewPane; ViewPane = function () {
  };

  return ViewTable;
}); // http://jsbin.com/viqenirimu/edit?html,output