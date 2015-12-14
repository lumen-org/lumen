/**
 * Initialize a pane for charting.
 */
function initPane () {
  "use strict";

  /* My Box Model:
   like http://www.w3schools.com/css/css_boxmodel.asp but without Border and with the convention
   that the "Content" area is the actual drawing area for the chart, but axis are drawn in the margins. */
// margin convention: http://bl.ocks.org/mbostock/3019563
  var svgMargin = 40;
  var svgPadding = 40;
  var pane = {};
  pane.outerHeight = 800;
  pane.outerWidth = 800;
  pane.margin  = {top: svgMargin, right: svgMargin, bottom: svgMargin, left: svgMargin};
  pane.padding = {top: svgPadding, right: svgPadding, bottom: svgPadding, left: svgPadding};
  pane.width   = pane.outerWidth - pane.margin.left - pane.margin.right -  pane.padding.left - pane.padding.right; // i.e. inner width
  pane.height  = pane.outerHeight- pane.margin.top - pane.margin.bottom - pane.padding.top - pane.padding.bottom; // i.e. inner height
  pane.pane = d3.select("body").append("svg")
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
    height: pane.height+ pane.padding.top + pane.padding.bottom,});

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
 * Asynchroniously load data and call callback when ready
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
function onSvgChanged () {
  "use strict";
  // todo fix ?
  scale.x.range([0, pane.width]);
  scale.y.range([pane.height, 0]);   // inverts y axis
  scale.radius.range([5,20]);
}

/**
 * Adpot to changed data
 * @param dataset
 */
function onDataChanged (dataset) {
  "use strict";

  function onMouseOver(d) {
    var mark = d3.select(this);
    mark.select("circle")
      .attr("fill", "orange");
    mark.append("textArea")
      .text(attrMappers.hoverText)
      .attr("text-anchor", "middle")
      .attr("x", attrMappers.x)
      .attr("y", attrMappers.y)
      //.attr("font-family", "sans-serif")
      .attr("font-size", "15px")
      .attr("clip-path", "url(#canvasClipPath)")
      .style("pointer-events", "none");

    //et this bar's x/y values, then augment for the tooltip
    var xPosition = parseFloat(mark.attr("x")); // + xScale.rangeBand() / 2;
    //var yPosition = parseFloat(d3.select(this).attr("y")) / 2 + h / 2;
    var yPosition = pane.height / 2;

//Update the tooltip position and value
    var tooltip = d3.select("#tooltip")
      .style("left", xPosition + "px")
      .style("top", yPosition + "px");
    tooltip.select("#daphne").text(d.daphne);
    tooltip.select("#philipp").text(d.philipp);

//Show the tooltip
    d3.select("#tooltip").classed("hidden", false);

  }

  function onMouseOut (d) {
    var mark = d3.select(this);
    mark.select("circle")
      .attr("fill", attrMappers.color(d));
    mark.select("textArea")
      .remove();

    d3.select("#tooltip").classed("hidden", true);
  }

  var mapperGenerator = {
    pred : function(fct) {
      return function (d, i) {
        //problem : i is always 0 !? something about "this" ?
        //if (i <=0 || i >= dataset.length) return 1; // todo: hacky!!
        if (i===0) i=1;
        return fct(dataset[i-1], i-1);
      };
    }
  };

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
        return "yellow";
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
    },
    hoverText: function (d, i) {
      return d.daphne;
    }
  };
  attrMappers.predX = mapperGenerator.pred(attrMappers.x);
  attrMappers.predY = mapperGenerator.pred(attrMappers.y);

  // calculate virtual fields
  var prev = 0;
  for (var i=0; i<dataset.length; ++i) {
    dataset[i].diff = dataset[i].pages - prev;
    prev = dataset[i].pages;
  }

  // update scales
  var extent = {
    dates: d3.extent(dataset, function (d) {return d.date;}),
    pages: d3.extent(dataset, function (d) {return d.pages;}),
    diff: d3.extent(dataset, function (d) {return Math.abs(d.diff);})
  };
  scale.x.domain(extent.dates);
  scale.y.domain([0,extent.pages[1]]);
  scale.radius.domain([0,extent.diff[1]]);

  // update / remove / add marks

  // store update selection
  var points = pane.points.selectAll(".point").data(dataset);
  var lines = pane.lines.selectAll(".lines").data(dataset);

  // add new elements
  var newPoints = points.enter().append("g").classed("point mark", true);
  var newLines = lines.enter().append("g").classed("line mark", true);

  newPoints
    // handles hovering
    .on('mouseover', onMouseOver)
    .on('mouseout', onMouseOut);

  newLines
    .append("line")
    .attr("clip-path", "url(#canvasClipPath)");

  newPoints
    .append("circle")
    .attr("clip-path", "url(#canvasClipPath)");

  // the just appended elements are now part of the update selection!
  // -> then update all remaining the same way
  points.select("circle")
    //.transition()
    .attr("cx", attrMappers.x)
    .attr("cy", attrMappers.y)
    .attr("r", attrMappers.size)
    .attr("fill", attrMappers.color)
    .attr("stroke", attrMappers.stroke)
    .attr("stroke-width", attrMappers.strokeWidth);

  lines.select("line")
    .attr({
      x1: attrMappers.predX,
      y1: attrMappers.predY,
      x2: attrMappers.x,
      y2: attrMappers.y,
      "stroke-width": 3,
      stroke: attrMappers.color
    });

  // remove gone ones
  lines.exit().remove();
  points.exit().remove();

  // update axis
  pane.axis.x.call(axis.x);
  pane.axis.y.call(axis.y);
}


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
    //.innerTickSize(-10)
    .outerTickSize(0),
  y: d3.svg.axis()
    .scale(scale.y)
    .orient("left")
    .innerTickSize(-(pane.height + pane.padding.top))
    .outerTickSize(0)
};

onSvgChanged();

loadData(onDataChanged);
