/**
 *
 *
 * @module ViewTable
 * @author Philipp Lucas
 */

define(['lib/logger', 'd3', 'lib/colorbrewer', './Field', './VisMEL', './ResultTable'], function (Logger, d3, cbrew, F, VisMEL, ResultTable) {
  "use strict";

  var logger = Logger.get('pl-ViewTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Creates a canvas within the given <svg> element, respecting the given margin and padding.
   * @param paneDOM A <svg> DOM element.
   * @param margin Margin (outer) for the drawing canvas
   * @param padding Padding (inner) for the drawing canvas
   * @returns {{}} A canvas object that warps the basic the geometry of the pane, its canvas, margin and padding
   */
  function setupCanvas(paneDOM, margin, padding) {
    // normalize arguments
    if (_.isFinite(margin))
      margin = {top: margin, right: margin, buttom: margin, left: margin};
    if (_.isFinite(padding))
      padding = {top: padding, right: padding, buttom: padding, left: padding};

    // setup basic geometry of actual drawing canvas, with margin (outer) and padding (inner)
    var canvas = {};
    canvas.paneD3 = d3.select(paneDOM); 
    canvas.outerHeight = canvas.paneD3.attr2num("width");
    canvas.outerHeight = canvas.paneD3.attr2num("height");
    canvas.padding  = padding;
    canvas.margin = margin;
    canvas.width   = canvas.outerWidth - canvas.margin.left - canvas.margin.right -  canvas.padding.left - canvas.padding.right; // i.e. inner width
    canvas.height  = canvas.outerHeight- canvas.margin.top - canvas.margin.bottom - canvas.padding.top - canvas.padding.bottom; // i.e. inner height

    // setup the real canvas for drawing and a clippath
    canvas.canvasD3 = canvas.paneD3.append("g")
      .attr("transform", "translate(" + (canvas.margin.left + canvas.padding.left) + "," + (canvas.margin.top + canvas.padding.top) + ")");
    canvas.clipPath = canvas.canvas.append("clipPath").attr("id", "canvasClipPath");
    canvas.clipPath.append("rect").attr({
      x : -canvas.padding.left,
      y : -canvas.padding.top,
      width: canvas.width + canvas.padding.left + canvas.padding.right,
      height: canvas.height+ canvas.padding.top + canvas.padding.bottom});
    
    return canvas;
  }
  
  
  function setupAxisDOM(canvas) {
    canvas.axis = {};
    canvas.axis.x = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(0," + (canvas.height + canvas.padding.bottom) + ")");
    canvas.axis.y = canvas.canvas.append("g")
      .classed("axis", true)
      .attr("transform", "translate(" + (-canvas.padding.left) + ",0)");
  }


  /**
   *
   * @param query {VisMEL} A VisMEL query.
   */
  function setupScales (query) {

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

     /* todo: aren't the scales already in the fieldUsages?! hence just in something like:
      query.layer[0].aesthetics.color.scale ?
      answer: not really, this is more a kind of "simple preprocessing/prescaling".
      but the actual scale we talk about here, are for mapping to *visual* dimensions!
      however, we will very much access the scales like that (with a different name), once we created
      them here in this function!
     */

    // setup row and col NSF (partial) scales

    // setup aesthetics scales
    var aesthetics = query.layers[0].aestetics;

    // the following is how I think this may be done for the color mapping.
    // todo: all the other aestetics
    var color = aesthetics.color;
    var colormap = [],
      scale = [];
    switch(color.kind) {
      case F.FieldT.Kind.cont:
        scale = d3.scale.linear();
        colormap = cbrew.Blues["9"];
        break;
      case F.FieldT.Kind.discrete:
        scale = d3.scale.ordinal();
        var l = domain.length;
        if (l <= 2) {
          colormap = cbrew.Set1[3].slice(0, l - 1);
        } else if (l <= 9) {
          colormap = cbrew.Set1[l];
        } else { //if (l <= 12) {
          if (l > 12) {
            logger.warn("the domain of the dimension " + color.name + " has too many elements: " + l);
            l = 12;
          }
          colormap = cbrew.Paired[l];
        }
        break;
      default:
        throw new TypeError("invalid Field.Kind");
    }
    scale.domain(color.domain).range(colormap);

    //aesthetics.color.visScale = ... todo!!
      // set domain: already there for dimensions. what to do for measures? todo: implement too!
      // set range :
      // set interpolation?

    // no need for scales in: filters, details

    // then, i can use it like this, for example:
    // heights.visScale(180); // assuming heights is a FieldUsage :)

    return scales;
  }


  /**
   * A ViewTable takes a ResultTable and turns it into an actual visual representation.
   * This visualization is attach to the DOM, as it is created within the limits of a given <svg> element.
   *
   * A ViewTable is, not very surprisingly, a table of {@link ViewPane}s. Each {@link ViewPane} represents a single cell of the table.
   *
   * Note that the axis are part of the {@link ViewTable}, not the {@link ViewPane}s. They are (actually the scales that the axis are based on) reused in the {@link ViewPanes}s, however.
   *
   * @param paneDOM A <svg> DOM element. This must already have a width and height.
   * @param [resultTable] The {@link ResultTable} to visualize with this viewTable.
   * @constructor
   * @alias module:ViewTable
   */
  var ViewTable; ViewTable = function (paneDOM, resultTable) {

    /// one time on init:

    // init table canvas
    this.canvas = setupCanvas(paneDOM, 25, 25);

    // init scales
    this.scale = setupScales(resultTable);

    // init axis
    // 1. axis of discrete variables: todo!

    // 2. axis of


    // create table of ViewPanes


    /// redo on data change (same everything else...)

    // augment data (min, max, ...)

    // update scales (data changed)

    // add marks for new data
    // remove marks for gone data

    // update visual attributes of current marks

    if (resultTable)
      this.update(resultTable);
  };

  /**
   * Update this {@link ViewTable} with the given {@link ResultTable}.
   */
  ViewTable.prototype.update = function (resultTable) {


  };


  /**
   * A ViewPane is a
   */
  var ViewPane; ViewPane = function () {

  };

  return ViewTable;
}); // http://jsbin.com/viqenirimu/edit?html,output