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
  var svgMargin = 40;
  var svgPadding = 40;
  var pane = {};
  pane.outerHeight = 800;
  pane.outerWidth = 800;
  pane.margin  = {top: svgMargin, right: svgMargin, bottom: svgMargin, left: svgMargin};
  pane.padding = {top: svgPadding, right: svgPadding, bottom: svgPadding, left: svgPadding};
  pane.width   = pane.outerWidth - pane.margin.left - pane.margin.right -  pane.padding.left - pane.padding.right; // i.e. inner width
  pane.height  = pane.outerHeight- pane.margin.top - pane.margin.bottom - pane.padding.top - pane.padding.bottom; // i.e. inner height
  pane.canvas = d3.select("body").append("svg")
    .attr("width", pane.outerWidth)
    .attr("height", pane.outerHeight)
    .append("g")
    .attr("transform", "translate(" + (pane.margin.left + pane.padding.left) + "," + (pane.margin.top + pane.padding.top) + ")");

  // add axis
  pane.axis = {};
  pane.axis.x = pane.canvas.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + (pane.height + pane.padding.bottom) + ")");
  //.call(axis.x);
  pane.axis.y = pane.canvas.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(" + (-pane.padding.left) + ",0)");
  //.call(axis.y);

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
 */
function onSvgChanged () {
  "use strict";
  // todo fix ?
  scale.x.range([0, pane.width]);
  scale.y.range([pane.height, 0]);   // invert y axis
  scale.radius.range([5,20]);
}

/**
 * Adpot to changed data
 * @param dataset
 */
function onDataChanged (dataset) {
  "use strict";
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
  var circles = pane.canvas.selectAll("circle").data(dataset); // update selection

  // add new elements
  circles.enter().append("circle");

  // the just appended elements are now part of the update selection!
  // -> then update all remaining the same way
  circles
    //.transition()
    .attr("cx", function(d) {
      return scale.x(d.date);
    })
    .attr("cy", function(d) {
      return scale.y(d.pages);
    })
    .attr("r", function(d) {
      return scale.radius(Math.abs(d.diff));
    })
    .attr("fill", function(d) {
      if (Math.abs(d.diff) < 10)
        return "yellow";
      else if (d.diff > 0)
        return "green";
      else
        return "red";
    })
    .attr("stroke", function(d,i) {
      return "black";
    })
    .attr("stroke-width", function (d) {
      return 1.5;
    });

  // remove gone ones
  circles.exit().remove();

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
  x: d3.svg.axis().scale(scale.x).orient("bottom"),
  y: d3.svg.axis().scale(scale.y).orient("left")
};

onSvgChanged();

loadData(onDataChanged);
