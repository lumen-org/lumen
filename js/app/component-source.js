/**
 * Main component that assembles and manages the actual GUI of the EMV tool.
 *
 * @module main
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './Field', './shelves','./DummyModel', './visuals', './interaction', './VisMEL', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModel'],
  function (e, d3, init, F, sh, dmodel, vis, inter, VisMEL, QueryTable, ModelTable, ResultTable, ViewTable, RemoteModel) {
    'use strict';

    /**
     * Populates the shelves of the GUI with the fields of the model and makes them interactable.
     */
    function populateGUI () {
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
    }

    /**
     * do some drag and drops to start with some VisMEL query
     */
    function initialQuerySetup () {
      // basic setup 1
      //inter.onDrop(shelf.row, shelf.dim.at(0));
      //inter.onDrop(shelf.column, shelf.meas.at(1));
      //inter.onDrop(shelf.color, shelf.dim.at(2));

      // multi-mixed use of a continuous variable as both, dimension and measure
      // inter.onDrop(shelf.column, shelf.dim.at(1));
      // inter.onDrop(shelf.column, shelf.dim.at(0));
      // inter.onDrop(shelf.column, shelf.meas.at(0));
      // inter.onDrop(shelf.row, shelf.meas.at(1));
      // inter.onDrop(shelf.dim, shelf.meas.at(0));
      // inter.onDrop(shelf.color, shelf.dim.at(3));

      // multi-mixed use of a continuous variable as both, dimension and measure
      //inter.onDrop(shelf.row, shelf.dim.at(1));
      //inter.onDrop(shelf.column, shelf.meas.at(2));
      //inter.onDrop(shelf.color, shelf.dim.at(2));

      //inter.onDrop(shelf.filter, shelf.dim.at(2));
      //inter.onDrop(shelf.detail, shelf.dim.at(1));
      //inter.onDrop(shelf.shape, shelf.dim.at(0));
      //inter.onDrop(shelf.size, shelf.meas.at(2));
      //inter.onDrop(shelf.row, shelf.dim.at(0));
      //inter.onDrop(shelf.row, shelf.meas.at(0));
      //inter.onDrop(shelf.column, shelf.dim.at(1));
      //inter.onDrop(shelf.column, shelf.meas.at(1));
    }


    /**
     * Trigger query execution when user implicitly specified (changed) a query
     */
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

//      console.log
    }


    /**
     * Enables user querying.
     */
    function enableQuerying () {
      // that seems important - what did it do again?
      inter.onDrop.on(inter.onDrop.dropDoneEvent, onUpdate);

      // trigger initial query execution
      onUpdate();
    }


    // locally 'global' variables
    var query = {},
      queryTable = {},
      modelTable = {},
      resultTable = {},
      viewTable = {};

    // visualization base element
    var visPaneD3 = d3.select("#visDiv")
      .append("svg")
      .attr({
        width:800,
        height:600
      });

    // define shelves
    var shelf = sh.construct();

    // get 'dummy' model
    // var model = dmodel.generator.census();
    var model = new RemoteModel('car_crashes', "http://127.0.0.1:5000/webservice");
    model.populate()
      .then(populateGUI)
      .then(initialQuerySetup)
      .then(enableQuerying)
      .catch((err) => {
        console.error(err);
        throw "Not implemented"
      });

    /*$('#debug-stuff').append($('<button type="button" id="update-button">Generate Query!</button>'));
    $('#update-button').click( function() {
      onUpdate();
      //console.log(modelTable.baseModel.describe());
      //console.log(modelTable.at[0][0].describe());
      //eval('console.log("");'); // prevents auto-optimization of the closure
    });*/

    function myScript () {
      // testing the remote model!
      var carCrashes = new RemoteModel('car_crashes', "http://127.0.0.1:5000/webservice");
      carCrashes.describe();
    }

    return {
      /**
       * Starts the application.
       */
      start: function () {
        //myScript();
      }
    };

  });