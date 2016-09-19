/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * @module main
 * @author Philipp Lucas
 */
//define(['lib/emitter', 'd3', './init', './PQL', './shelves','./DummyModel', './visuals', './interaction', './VisMEL', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling'],
//  function (e, d3, init, PQL, sh, dmodel, vis, inter, VisMEL, QueryTable, ModelTable, ResultTable, ViewTable, Remote) {

define(['lib/emitter', 'd3', './init', './PQL', './VisMEL', './shelves', './visuals', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './TableAlgebra'],
  function (e, d3, init, PQL, VisMEL, sh, vis, QueryTable, ModelTable, ResultTable, ViewTable, Remote, TableAlgebraExpr) {
    'use strict';

    /**
     * Populates the shelves of the GUI with the fields of the model and makes them interactable.
     */
    function populateGUI() {
     
      // populate shelves
      sh.populate(model, shelf.dim, shelf.meas);

      // make all shelves visual and interactable
      shelf.meas.beVisual({label: 'Measures'});
      shelf.dim.beVisual({label: 'Dimensions'});
      shelf.detail.beVisual({label: 'Details'});
      shelf.color.beVisual({label: 'Color', direction: vis.DirectionTypeT.horizontal});
      shelf.filter.beVisual({label: 'Filter', direction: vis.DirectionTypeT.box});
      shelf.shape.beVisual({label: 'Shape', direction: vis.DirectionTypeT.horizontal});
      shelf.size.beVisual({label: 'Size', direction: vis.DirectionTypeT.horizontal});
      shelf.remove.beVisual({label: 'Drag here to remove'});
      shelf.row.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal});
      shelf.column.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal});

      // shelf.meas.beVisual({label: 'Measures'}).beInteractable();
      // shelf.dim.beVisual({label: 'Dimensions'}).beInteractable();
      // shelf.detail.beVisual({label: 'Details'}).beInteractable();
      // shelf.color.beVisual({label: 'Color', direction: vis.DirectionTypeT.horizontal}).beInteractable();
      // shelf.filter.beVisual({label: 'Filter', direction: vis.DirectionTypeT.box}).beInteractable();
      // shelf.shape.beVisual({label: 'Shape', direction: vis.DirectionTypeT.horizontal}).beInteractable();
      // shelf.size.beVisual({label: 'Size', direction: vis.DirectionTypeT.horizontal}).beInteractable();
      // shelf.remove.beVisual({label: 'Drag here to remove'}).beInteractable();
      // shelf.row.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal}).beInteractable();
      // shelf.column.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal}).beInteractable();

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
      //inter.asRemoveElem($(document.body).find('main'));
    }

    /**
     * do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup() {
      //inter.onDrop(shelf.filter, shelf.dim.at(2));
      //inter.onDrop(shelf.detail, shelf.dim.at(1));
      //inter.onDrop(shelf.shape, shelf.dim.at(0));
      //inter.onDrop(shelf.size, shelf.meas.at(2));
      //inter.onDrop(shelf.row, shelf.dim.at(0));
      //inter.onDrop(shelf.row, shelf.meas.at(0));
      //inter.onDrop(shelf.column, shelf.dim.at(1));
      //inter.onDrop(shelf.column, shelf.meas.at(1));
    }


    function onUpdate() {
      if (testPQLflag || testVisMELflag)
        return;
      query = new VisMEL(shelf, model);
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
      //*/
    }

    /**
     * Enables user querying.
     */
    function enableQuerying() {
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
        width: 400,
        height: 400
      });

    var testPQLflag = false,
      testVisMELflag = false;

    if (!testPQLflag && !testVisMELflag) {
      // define shelves
      var shelf = sh.construct();
      // get initial model
      var model = new Remote.Model('mvg4', "http://127.0.0.1:5000/webservice");
      model.update().then(populateGUI)
        .then( () => {debugger;} )
        // .then(initialQuerySetup)
        // .then(enableQuerying)
        // .catch((err) => {
        //   console.error(err);
        //   throw "Could not load remote model from Server - see above";
        // });
    }
    /*$('#debug-stuff').append($('<button type="button" id="update-button">Generate Query!</button>'));
     $('#update-button').click( function() {
     onUpdate();
     //console.log(modelTable.baseModel.describe());
     //console.log(modelTable.at[0][0].describe());
     //eval('console.log("");'); // prevents auto-optimization of the closure
     });*/


    function testPQL() { // jshint ignore:line
      // put some debug / testing stuff here to be executed on loading of the app

      function printResult(res) {
        console.log(res);
        return res;
      }

      var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
      var iris_;
      mb.header('iris').then(printResult);
      mb.get('iris')
        .then(printResult)
        .then(iris => iris.copy("iris_copy"))
        .then(ic => ic.model(['sepal_length', 'petal_length', 'sepal_width']))
        .then(printResult)
        .then(ic => {
          iris_ = ic.model("*", [new PQL.Filter(ic.fields["sepal_length"], "equals", 5)]);
          return iris_;
        })
        .then(printResult)
        .then(ic => ic.predict(
          ["petal_length", new PQL.Density(ic.fields["petal_length"])],
          [],
          new PQL.Split(ic.fields["petal_length"], "equiDist", [5])))
        .then(printResult)
        .then(_ => iris_)
        .then(ic => ic.predict(
          [ic.fields["sepal_width"], ic.fields["petal_length"], new PQL.Density(ic.fields["petal_length"])],
          [],
          [new PQL.Split(ic.fields["petal_length"], "equiDist", [5]), new PQL.Split(ic.fields["sepal_width"], "equiDist", [3])]))
        .then(printResult)
        .then(_ => iris_);
    }

    function testVisMEL() {

      var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
      var query, iris, pw, pl, sw, sl;
      mb.get('iris')
        .then( iris_ => {
          iris = iris_;
          pw = iris.fields["petal_width"];
          pl = iris.fields["petal_length"];
          sw = iris.fields["sepal_width"];
          sl = iris.fields["sepal_length"];
        })
/*
        .then( () => {
          let pw_split = new PQL.Split(pw, "equiDist", [4]);
          let sw_split = new PQL.Split(sw, "equiDist", [4]);
          let pw_density = new PQL.Density([pw,sw]);
          query = new VisMEL.VisMEL(undefined, iris);
          query.layout.rows = new TableAlgebraExpr([sw_split]);
          query.layout.cols = new TableAlgebraExpr([pw_split]); 
          query.layers[0].aesthetics.color = new VisMEL.ColorMap(pw_density, 'rgb');
          return query;
        }) //*/


        .then( () => {
          let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
          let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
          let pl_split = new PQL.Split(pl, "equiDist", [20]);
          let sl_split = new PQL.Split(sl, "equiDist", [20]);
          let plsl_density = new PQL.Density([pl,sl]);
          query = new VisMEL.VisMEL(undefined, iris);
          query.layout.rows = new TableAlgebraExpr([pw_aggr]);
          query.layout.cols = new TableAlgebraExpr([sw_aggr]);
          query.layers[0].aesthetics.details.push(sl_split);          
          query.layers[0].aesthetics.details.push(pl_split);
          query.layers[0].aesthetics.color = new VisMEL.ColorMap(plsl_density, 'rgb');
          query.layers[0].aesthetics.size = new VisMEL.SizeMap(plsl_density);
          return query;
        }) //*/

/*
        .then( () => {
          let pw_split = new PQL.Split(pw, "equiDist", [4]);
          let sw_split = new PQL.Split(sw, "equiDist", [4]);
          let pl_split = new PQL.Split(pl, "equiDist", [5]);
          let sl_split = new PQL.Split(sl, "equiDist", [4]);
          let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
          let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
          query = new VisMEL.VisMEL(undefined, iris);
          query.layout.rows = new TableAlgebraExpr([pw_aggr]);
          query.layout.cols = new TableAlgebraExpr([sw_aggr]); 
          query.layers[0].aesthetics.details.push(sl_split);
          query.layers[0].aesthetics.details.push(pl_split);
          return query;
        }) //*/        
/*
        .then( () => {
          let pw_split = new PQL.Split(iris.fields["petal_width"], "equiDist", [20]); 
          let pw_aggr = new PQL.Aggregation(iris.fields["petal_width"], "maximum", "petal_width");
          let pw_density = new PQL.Density(iris.fields["petal_width"]);
          query = new VisMEL.VisMEL(undefined, iris);
          query.layout.rows = new TableAlgebraExpr([pw_density]);
          query.layout.cols = new TableAlgebraExpr([pw_split]);
          return query;           
        })//*/

/*        .then( () => {
          let sw_split = new PQL.Split(iris.fields["sepal_width"], "equiDist", [5]);
          let pl_split = new PQL.Split(iris.fields["petal_length"], "equiDist", [10]);
          let pl_density = new PQL.Density(iris.fields["petal_length"]);
          let pw_aggr = new PQL.Aggregation(iris.fields["petal_width"], "maximum", "petal_width");
          let sw_aggr = new PQL.Aggregation(iris.fields["sepal_width"], "maximum", "sepal_width");

          query = new VisMEL.VisMEL(undefined, iris);
          query.layout.rows = new TableAlgebraExpr([sw_aggr]);
          //query.layout.cols = new TableAlgebraExpr([pl_density, pw_aggr]);
          query.layout.cols = new TableAlgebraExpr([pw_aggr]);

          query.layers[0].aesthetics.color = new VisMEL.ColorMap(pw_aggr, 'rgb');
          query.layers[0].aesthetics.size = new VisMEL.SizeMap(sw_split);
          //query.layers[0].aesthetics.shape = new VisMEL.ShapeMap(sw_split);
          query.layers[0].aesthetics.details.push(sw_split);
          //query.layers[0].aesthetics.details.push(pl_split);
          return query;
        })//*/
        .then(query => {
          //console.log(query.toString());
          return query;
        })
        .then(query => {
          //query = new VisMEL(shelf, model);
          queryTable = new QueryTable(query);
          //console.log(queryTable);
          modelTable = new ModelTable(queryTable);
          return modelTable.model();
        })
        .then(() => {
          //console.log(modelTable);
          resultTable = new ResultTable(modelTable, queryTable);
          return resultTable.fetch();
        })
        .then(() => {
          //console.log(resultTable);        
          viewTable = new ViewTable(visPaneD3, resultTable, queryTable);
          //debugger;
        });
    } // function testVisMEL

    return {
      /**
       * Starts the application.
       */
      start: function () {
        if (testPQLflag) testPQL();
        if (testVisMELflag) testVisMEL();
      }
    };

  });