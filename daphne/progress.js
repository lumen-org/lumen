/**
 * meaning of css classes:
 *
 *  - .mark: super class of <g> elements that contain marks to represent data
 *  - .point: class of <g> elements that contain one-dimensional  "pointy" marks to represent data
 *  - .line: class of <g> elements that contain two-dimensional "line-y" marks
 *  - .shape: class of a svg element that actually is the geometric shape representating a .point .mark. This may be a circle, a rect or other svg elements
 */

/**
 * Initialize a pane for charting.
 */
function initPane () {
  "use strict";

  /* My Box Model:
   like http://www.w3schools.com/css/css_boxmodel.asp but without Border and with the convention
   that the "Content" area is the actual drawing area for the chart, but axis are drawn in the margins. */

  // canvas geometry
  // -> margin convention: http://bl.ocks.org/mbostock/3019563
  var svgMargin = 40;
  var svgPadding = 40;
  var pane = {};
  pane.outerHeight = 800;
  pane.outerWidth = 800;
  pane.margin  = {top: svgMargin, right: svgMargin, bottom: svgMargin, left: svgMargin};
  pane.padding = {top: svgPadding, right: svgPadding, bottom: svgPadding, left: svgPadding};
  pane.width   = pane.outerWidth - pane.margin.left - pane.margin.right -  pane.padding.left - pane.padding.right; // i.e. inner width
  pane.height  = pane.outerHeight- pane.margin.top - pane.margin.bottom - pane.padding.top - pane.padding.bottom; // i.e. inner height
  pane.pane = d3.select("#graphicscontainer").append("svg")
    .attr("width", pane.outerWidth)
    .attr("height", pane.outerHeight);
  pane.canvas = pane.pane
    .append("g")
    .attr("transform", "translate(" + (pane.margin.left + pane.padding.left) + "," + (pane.margin.top + pane.padding.top) + ")");
  pane.clipPath = pane.canvas.append("clipPath").attr("id", "canvasClipPath");
  pane.clipPath.append("rect").attr({
    x : -pane.padding.left,
    y : -pane.padding.top,
    width: pane.width + pane.padding.left + pane.padding.right,
    height: pane.height+ pane.padding.top + pane.padding.bottom});

  // add axis
  pane.axis = {};
  pane.axis.x = pane.canvas.append("g")
    .classed("axis", true)
    .attr("transform", "translate(0," + (pane.height + pane.padding.bottom) + ")");
  pane.axis.y = pane.canvas.append("g")
    .classed("axis", true)
    .attr("transform", "translate(" + (-pane.padding.left) + ",0)");

  // add basic group elements
  pane.lines  = pane.canvas.append("g");
  pane.points = pane.canvas.append("g");
  return pane;
}

/**
 * Asynchronously load data and call callback when ready
 * @param callback
 */
function loadData (callback) {
  "use strict";
  var dateFormat = d3.time.format("%d.%m.%Y");
  function accessor (d) {
    return {
      date: dateFormat.parse(d.Date),
      pages: +d.Pages,
      daphne: d.DaphneComment,
      philipp: d.PhilippComment
    };
  }
  d3.tsv('Daphne_Lernfortschritt.csv', accessor, callback);
}


/**
 * Adopt to changes of pixel dimensions of the pane
 * todo: this isn't really working yet, I don't even know if I'd ever need it
 */
function onCanvasSizeChanged () {
  "use strict";
  // todo fix ?
  scale.x.range([0, pane.width]);
  scale.y.range([pane.height, 0]);   // inverts y axis
  scale.radius.range([5,20]);
}


/**
 * @param elem A D3 selection of a svg DOM element
 * @returns {*} The center of the svg DOM element
 */
function getCenter (elem) {
  "use strict";
  var name = elem[0][0].nodeName.toLowerCase();
  if (name === 'rect')
    return {
      x: parseFloat(elem.attr("x")) + parseFloat(elem.attr("width")) / 2,
      y: parseFloat(elem.attr("y")) + parseFloat(elem.attr("height")) / 2
    };
  else if (name === 'circle')
    return {
      x: parseFloat(elem.attr("cx")),
      y: parseFloat(elem.attr("cy"))
    };
  else
    throw new Error("unknown elem class.");
}

/**
 * Recalculates all virtual fields for the given data set.
 */
function updateVirtualFields (dataset) {
  "use strict";
  var prev = 0;
  for (var i=0; i<dataset.length; ++i) {
    dataset[i].diff = dataset[i].pages - prev;
    prev = dataset[i].pages;
  }
}

/**
 * Adpot to changed data
 * @param dataset
 */
function onDataChanged (loadedData) {
  "use strict";

  dataset = loadedData;

  // calculate virtual fields
  updateVirtualFields(dataset);

  // update scales (data changed)
  var extent = {
    dates: d3.extent(dataset, function (d) {return d.date;}),
    pages: d3.extent(dataset, function (d) {return d.pages;}),
    diff: d3.extent(dataset, function (d) {return Math.abs(d.diff);})
  };
  scale.x.domain([extent.dates[0], new Date()]);
  scale.y.domain([0,extent.pages[1]]);
  scale.radius.domain([0,extent.diff[1]]);

  /// update / remove / add marks
  // store update selection
  var lines = pane.lines.selectAll(".line").data(dataset);
  var points = pane.points.selectAll(".point").data(dataset);

  // add new elements
  // note: they are grouped as to allow z-level control of how they are drawn on the canvas
  var newLines = lines.enter().append("g").classed("line mark", true);
  var newPoints = points.enter().append("g").classed("point mark", true);

  newLines
    .append("line")
    .attr("clip-path", "url(#canvasClipPath)");

  // append element based on weekday
  newPoints
    .append(elemMapper.weekend)
    .classed("shape", true)
    .attr("clip-path", "url(#canvasClipPath)")
    .on('mouseover', onMouseOver)
    .on('mouseout', onMouseOut);

  // the just appended elements are now part of the update selection!
  // -> then update all the same way
  // todo: improve: however (and that is ugly) I need different updates based on the svg element representing a data point...
  // at least I'm using the same mappers already ... i gues
  points.select(".shape") // select actual graphical object
    //.transition()
    .each(
      function (d, i) {
        var nodeName = this.nodeName.toLowerCase();
        var sel = d3.select(this);
        var x = attrMappers.x(d, i);
        var y = attrMappers.y(d, i);
        var size = attrMappers.size(d, i);

        if (nodeName === "rect")
          sel.attr("x", x - size/2)
            .attr("y", y - size/2)
            .attr("width", size)
            .attr("height", size);
        else if (nodeName === "circle")
          sel.attr("cx", x)
            .attr("cy", y)
            .attr("r", size);

        sel.attr("fill", attrMappers.color(d, i))
          .attr("stroke", attrMappers.stroke(d, i))
          .attr("stroke-width", attrMappers.strokeWidth(d, i));
      }
    );

  lines.select("line") // select actual graphical object
    .attr({
      x1: attrMappers.predX,
      y1: attrMappers.predY,
      x2: attrMappers.x,
      y2: attrMappers.y,
      "stroke-width": 2,
      stroke: attrMappers.color
    });

  // remove gone ones
  lines.exit().remove();
  points.exit().remove();

  // update axis
  pane.axis.x.call(axis.x);
  pane.axis.y.call(axis.y);
}

/**
 * Handler for mouse over event.
 * @param d The datum bound to this.
 * @param this The DOM element that the event occured on.
 */
function onMouseOver(d) {
  var shape = d3.select(this).attr("fill", "orange");
  var c = getCenter(shape);
  var tooltip = d3.select("#tooltip")
    .style("left", c.x + "px")
    .style("top", c.y + "px");
  var daphne = (d.daphne ? d.daphne : d.pages.toString());
  var philipp = (d.philipp ? d.philipp : "--");
  tooltip.select("#daphne").text(daphne);
  tooltip.select("#philipp").text(philipp);
  d3.select("#tooltip").classed("hidden", false);
}

/**
* Handler for mouse out event.
* @param d The datum bound to this.
* @param this The DOM element that the event occured on.
*/
function onMouseOut (d) {
  d3.select(this).attr("fill", attrMappers.color(d));
  d3.select("#tooltip").classed("hidden", true);
}

/**
 * Collection of generators for attribute mappers.
 */
var mapperGenerator = {
  pred : function(fct) {
    return function (d, i) {
      //if (i <=0 || i >= dataset.length) return 1; // todo: hacky. Because we have to access the closure variable dataset. Hence it breaks, if its used in a different context.
      if (i===0) i=1;
      return fct(dataset[i-1], i-1);
    };
  }
};

/**
 * Collection of mapper functions that map data items to (visual) attributes
 * @param d datum
 * @param i index
 */
var attrMappers = {
  x: function (d, i) {
    return scale.x(d.date);
  },
  y: function (d, i) {
    return scale.y(d.pages);
  },
  size: function (d, i) {
    return scale.radius(Math.abs(d.diff));
  },
  color: function (d, i) {
    if (Math.abs(d.diff) < 10)
      return "gold";
    else if (d.diff > 0)
      return "green";
    else
      return "red";
  },
  stroke: function (d, i) {
    return "black";

  },
  strokeWidth: function (d, i) {
    return 1.5;
  }
};
attrMappers.predX = mapperGenerator.pred(attrMappers.x);
attrMappers.predY = mapperGenerator.pred(attrMappers.y);

/**
 * Collection of mapper function that map data items to svg elements.
 */
var elemMapper = {
  weekend: function (d) {
    var type = "",
      day = d.date.getDay();
    if (day === 1 || day === 7)  // 1 is sunday, 7 is saturday
      type = "circle";
    else
      type = "rect";
    return document.createElementNS("http://www.w3.org/2000/svg", type);
  }
};

var dataset = [];

var pane = initPane();

var scale = {
  x : d3.time.scale(),
  y : d3.scale.linear(),
  radius : d3.scale.sqrt(),
  color: d3.scale.linear()
};

var axis = {
  x: d3.svg.axis()
    .scale(scale.x)
    .orient("bottom")
    .innerTickSize(-(pane.width + pane.padding.left))
    .outerTickSize(0),
  y: d3.svg.axis()
    .scale(scale.y)
    .orient("left")
    .innerTickSize(-(pane.height + pane.padding.top))
    .outerTickSize(0)
};

onCanvasSizeChanged();
loadData(onDataChanged);