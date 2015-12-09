/**
 * Main component that assembles and manages the actual GUI of the EMV tool.
 * @module main
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './Field', './shelves','./DummyModel', './visuals', './interaction', './VisMEL', './ModelTable', './ResultTable'],
  function (e, d3, init, F, sh, dmodel, vis, inter, VisMEL, ModelTable, ResultTable) {
    'use strict';

    var query = {},
      modelTable = {},
      resultTable = {};

    // define shelves
    var shelf = sh.construct();

    // get 'dummy' model
    var model = dmodel.generator.census();

    // populate shelves
    sh.populate(model, shelf.dim, shelf.meas);

    // make all shelves visual and interactable
    shelf.meas.beVisual({label: 'Measures'}).beInteractable();
    shelf.dim.beVisual({label: 'Dimensions'}).beInteractable();
    shelf.detail.beVisual({label: 'Details'}).beInteractable();
    shelf.color.beVisual({label: 'Color', direction: vis.DirectionTypeT.horizontal}).beInteractable();
    shelf.filter.beVisual({label: 'Filter', direction: vis.DirectionTypeT.box}).beInteractable();
    shelf.shape.beVisual({label: 'Shape', direction: vis.DirectionTypeT.horizontal}).beInteractable();
    shelf.size.beVisual({label: 'Size', direction: vis.DirectionTypeT.horizontal}).beInteractable();
    shelf.remove.beVisual({label: 'Drag here to remove'}).beInteractable();
    shelf.row.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal}).beInteractable();
    shelf.column.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal}).beInteractable();

    // add all shelves to the DOM
    var base = $('#shelves');
    base.append(shelf.meas.$visual);
    base.append(shelf.dim.$visual);
    base.append(shelf.filter.$visual);
    base.append(shelf.detail.$visual);
    base.append(shelf.color.$visual);
    base.append(shelf.shape.$visual);
    base.append(shelf.size.$visual);
    base.append(shelf.remove.$visual);
    var layout = $('#layout');
    layout.append(shelf.row.$visual);
    layout.append(shelf.column.$visual);
    inter.asRemoveElem($(document.body).find('main'));
    // do some drag and drops to start with so VisMEL query

    inter.onDrop(shelf.color, shelf.dim.at(0));
    inter.onDrop(shelf.row, shelf.meas.at(0));
    inter.onDrop(shelf.column, shelf.meas.at(1));

    //inter.onDrop(shelf.filter, shelf.dim.at(2));
    //inter.onDrop(shelf.detail, shelf.dim.at(1));
    //inter.onDrop(shelf.shape, shelf.dim.at(0));
    //inter.onDrop(shelf.size, shelf.meas.at(2));
    //inter.onDrop(shelf.row, shelf.dim.at(0));
    //inter.onDrop(shelf.row, shelf.meas.at(0));
    //inter.onDrop(shelf.column, shelf.dim.at(1));
    //inter.onDrop(shelf.column, shelf.meas.at(1));

    function onUpdate () {
      query = new VisMEL(shelf, model);
      modelTable = new ModelTable(query);
      resultTable =new ResultTable(modelTable);
      $('#queryTextBox').text(
        "layout:\n" + query.layout.toString() +
        "\nlayers:\n" + query.layers.toString() );
    }

    inter.onDrop.on(inter.onDrop.dropDoneEvent, onUpdate);

    // trigger intial query write out
    onUpdate();

    $('#debug-stuff').append($('<button type="button" id="update-button">Generate Query!</button>'));
    $('#update-button').click( function() {
      onUpdate();
      //console.log(modelTable.baseModel.describe());
      //console.log(modelTable.at[0][0].describe());
      //eval('console.log("");'); // prevents auto-optimization of the closure
    });

    function myScript () {

      /* var dataX = [1,2,3,4,5,6,7,2];
       var dataY = [4,5,1,6,7,1,2,3];

       var d3box = d3.select('#d3box');

       var xScale = d3.scale.linear()
       .domain([0, d3.max(dataX)])
       //.range([0, parseInt(d3box.style("width"),10)]);
       .range([0, 100]);

       var yScale = d3.scale.linear()
       .domain([0, d3.max(dataY)])
       .range([0, 100]);

       //debugger;

       d3box.selectAll('g')
       .data(dataX)
       .enter().append('div')
       .classed("d3bar", true)
       .style("height", "20px")
       .style("width", function(d) {return xScale(d)+"%";})
       .text( function(d){return d;});
       //debugger;
       */
    }

    return {
      /**
       * Starts the application.
       */
      start: function () {
        myScript();
      }
    };

  });