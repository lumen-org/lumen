/**
 * Main component that assembles and manages the actual GUI of the EMV tool.
 *
 * # Fields, Field Usages, Models and Shelves
 * About {@F.Field} and {@F.FieldUsage}
 *
 * @module main
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './Field', './shelves','./DummyModel', './visuals', './interaction', './VisMEL', './QueryTable', './ModelTable', './ResultTable', './ViewTable'],
  function (e, d3, init, F, sh, dmodel, vis, inter, VisMEL, QueryTable, ModelTable, ResultTable, ViewTable) {
    'use strict';

    var query = {},
      queryTable = {},
      modelTable = {},
      resultTable = {},
      viewTable = {};

    // visualiztion base element
    var visPaneD3 = d3.select("#visDiv")
      .append("svg")
      .attr({
        width:400,
        height:400
      });

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

    // do some drag and drops to start with some VisMEL query

    // basic setup 1
    //inter.onDrop(shelf.row, shelf.dim.at(0));
    //inter.onDrop(shelf.column, shelf.meas.at(1));
    //inter.onDrop(shelf.color, shelf.dim.at(2));

    // multi-mixed use of a continuous variable as both, dimension and measure
    inter.onDrop(shelf.column, shelf.meas.at(0));
    inter.onDrop(shelf.row, shelf.meas.at(1));
    inter.onDrop(shelf.dim, shelf.meas.at(0));
    inter.onDrop(shelf.color, shelf.dim.at(3));

    /*inter.onDrop(shelf.row, shelf.dim.at(1));
    inter.onDrop(shelf.row, shelf.meas.at(0));*/

//    inter.onDrop(shelf.shape, shelf.dim.at(0));
//    inter.onDrop(shelf.size, shelf.meas.at(2));


    //inter.onDrop(shelf.filter, shelf.dim.at(2));
    //inter.onDrop(shelf.detail, shelf.dim.at(1));
    //inter.onDrop(shelf.shape, shelf.dim.at(0));
    //inter.onDrop(shelf.size, shelf.meas.at(2));
    //inter.onDrop(shelf.row, shelf.dim.at(0));
    //inter.onDrop(shelf.row, shelf.meas.at(0));
    //inter.onDrop(shelf.column, shelf.dim.at(1));
    //inter.onDrop(shelf.column, shelf.meas.at(1));

    function onUpdate () {
      // templated query
      query = new VisMEL(shelf, model);
      // evaulate template and thus create atomic queries from it
      queryTable = new QueryTable(query);
      modelTable = new ModelTable(queryTable);
      resultTable = new ResultTable(modelTable, queryTable);
      viewTable = new ViewTable(visPaneD3, resultTable, queryTable);

     /* $('#queryTextBox').text(
        "layout:\n" + query.layout.toString() +
        "\nlayers:\n" + query.layers.toString() );*/

      console.log("query: ");
      console.log(query);
      console.log("ModelTabel: ");
      console.log(modelTable);
      console.log("resultTable: ");
      console.log(resultTable);
      console.log("viewTable: ");
      console.log(viewTable);
      console.log("...");
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