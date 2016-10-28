/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * @module main
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './PQL', './VisMEL', './VisMELShelfDropping', './shelves', './visuals', './interaction', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './TableAlgebra'],
  function (Emitter, d3, init, PQL, VisMEL, drop, sh, vis, inter, QueryTable, ModelTable, ResultTable, ViewTable, Remote, TableAlgebraExpr) {
    'use strict';

    /**
     * Populates the shelves of the GUI with the fields of the model and makes them interactable.
     */
    function populateGUI() {

      console.log("populating gui...");

      // populate shelves
      sh.populate(model, shelves.dim, shelves.meas);

      // make all shelves visual and interactable
      shelves.meas.beVisual({label: 'Measures'}).beInteractable();
      shelves.dim.beVisual({label: 'Dimensions'}).beInteractable();
      shelves.detail.beVisual({label: 'Details'}).beInteractable();
      shelves.color.beVisual({label: 'Color'}).beInteractable();
      shelves.filter.beVisual({label: 'Filter'}).beInteractable();
      shelves.shape.beVisual({label: 'Shape'}).beInteractable();
      shelves.size.beVisual({label: 'Size'}).beInteractable();
      shelves.remove.beVisual({label: 'Drag here to remove'}).beInteractable();
      shelves.row.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal}).beInteractable();
      shelves.column.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal}).beInteractable();

      // add all shelves to the DOM
      $('#shelves').append(shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.filter.$visual,
        $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual, $('<hr>'), shelves.shape.$visual,
        $('<hr>'), shelves.size.$visual, $('<hr>'), shelves.remove.$visual);
      $('#layout').append(shelves.row.$visual, $('<hr>'), shelves.column.$visual);
      inter.asRemoveElem($(document.body).find('main'));
    }

    /**
     * do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup() {
      drop(shelves.dim, shelves.meas.at(0));
      //drop(shelves.filter, shelves.meas.at(1));
      //drop(shelves.detail, shelves.dim.at(0));
      //drop(shelves.shape, shelves.dim.at(0));
      //drop(shelves.size, shelves.meas.at(2));
      //drop(shelves.row, shelves.dim.at(0));
      //drop(shelves.row, shelves.meas.at(1));
      //drop(shelves.color, shelves.meas.at(2));
      drop(shelves.column, shelves.meas.at(1));
    }


    function onUpdate() {
      query = VisMEL.VisMEL.FromShelves(shelves, model);
      queryTable = new QueryTable(query);
      modelTable = new ModelTable(queryTable);
      modelTable.model()
        .then(() => {
          resultTable = new ResultTable(modelTable, queryTable);
        })
        .then(() => resultTable.fetch())
        .then(() => {
          viewTable = new ViewTable(visPaneD3, resultTable, queryTable);
        })
        .then(() => {
          console.log("query: ");
          console.log(query);
          console.log("QueryTable: ");
          console.log(queryTable);
          console.log("ModelTabel: ");
          console.log(modelTable);
          console.log("resultTable: ");
          console.log(resultTable);
          console.log("viewTable: ");
          console.log(viewTable);
          console.log("...");
        });
    }

    /**
     * Enables user querying.
     */
    function enableQuerying() {
      for (const key of Object.keys(shelves))
        shelves[key].on(Emitter.ChangedEvent, onUpdate);
      // trigger initial query execution
      onUpdate();
    }

    // locally 'global' variables
    var model = {},
      query = {},
      queryTable = {},
      modelTable = {},
      resultTable = {},
      viewTable = {};

    // define shelves
    var shelves = sh.construct();

    // visualization base element
    var visPaneD3 = d3.select("#visDiv")
      .append("svg")
      .attr({
        width: 400,
        height: 400
      });

    $('#debug-stuff').append($('<button type="button" id="update-button">Generate Query!</button>'));
    $('#update-button').click( function() {
      onUpdate();
      //eval('console.log("");'); // prevents auto-optimization of the closure
    });

    function testPQL() { // jshint ignore:line
      function printResult(res) {
        console.log(res);
        return res;
      }
      var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
      var iris, pw, pl, sw, sl;
      mb.get('iris')
        .then( iris_ => {
          iris = iris_;
          pw = iris.fields.get("petal_width");
          pl = iris.fields.get("petal_length");
          sw = iris.fields.get("sepal_width");
          sl = iris.fields.get("sepal_length");
        })
        .then( () => mb.header('iris'))
        .then(printResult)
        .then( () => mb.get('iris'))
        .then(printResult)
        .then(iris => iris.copy("iris_copy"))
        .then(ic => ic.model(['sepal_length', 'petal_length', 'sepal_width']))
        .then(printResult)
        .then(ic => {
          iris = ic.model("*", [new PQL.Filter(sl, "equals", 5)]);
          return iris;
        })
        .then(printResult)
        .then(ic => ic.predict(
          ["petal_length", new PQL.Density(pl)],
          [],
          new PQL.Split(pl, "equiDist", [5])))
        .then(printResult)
        .then( () => iris)
        .then(ic => ic.predict(
          [sw, pl, new PQL.Density(pl)],
          [],
          [new PQL.Split(pl, "equiDist", [5]), new PQL.Split(sw, "equiDist", [3])]))
        .then(printResult)
        .then( () => iris);
    }

    function testVisMEL() {
      var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
      var query, iris, pw, pl, sw, sl;
      mb.get('iris')
        .then( iris_ => {
          iris = iris_;
          pw = iris.fields.get("petal_width");
          pl = iris.fields.get("petal_length");
          sw = iris.fields.get("sepal_width");
          sl = iris.fields.get("sepal_length");
        })
        .then( () => {
          let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
          let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
          let pl_split = new PQL.Split(pl, "equiDist", [20]);
          let sl_split = new PQL.Split(sl, "equiDist", [20]);
          let plsl_density = new PQL.Density([pl,sl]);
          query = new VisMEL.VisMEL(iris);
          query.layout.rows = new TableAlgebraExpr([pw_aggr]);
          query.layout.cols = new TableAlgebraExpr([sw_aggr]);
          query.layers[0].aesthetics.details.push(sl_split);
          query.layers[0].aesthetics.details.push(pl_split);
          query.layers[0].aesthetics.color = new VisMEL.ColorMap(plsl_density, 'rgb');
          query.layers[0].aesthetics.size = new VisMEL.SizeMap(plsl_density);
          return query;
        })
        .then(query => {
          queryTable = new QueryTable(query);
          modelTable = new ModelTable(queryTable);
          return modelTable.model();
        })
        .then(() => {
          resultTable = new ResultTable(modelTable, queryTable);
          return resultTable.fetch();
        })
        .then(() => {
          viewTable = new ViewTable(visPaneD3, resultTable, queryTable);
        });
    } // function testVisMEL

    return {
      /**
       * Starts the application.
       */
      start: function () {

        var testPQLflag = false,
          testVisMELflag = false;

        if (testPQLflag)
          testPQL();
        else if (testVisMELflag)
          testVisMEL();
        else {

          // get initial model
          model = new Remote.Model('mvg4', "http://127.0.0.1:5000/webservice");
          model.update().then(populateGUI)
            .then(initialQuerySetup)
            .then(enableQuerying)
            //.then( () => {debugger; console.log(shelves);})
            .catch((err) => {
              console.error(err);
              throw "Could not load remote model from Server - see above";
            });
        }
      }
    };

  });