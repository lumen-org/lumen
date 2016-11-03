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
    function populateGUI(model, shelves) {
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
      $('#pl-model').append(
        shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));
      $('#pl-mappings').append(
        shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
        $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, $('<hr>'));
      $('#pl-layout').append( shelves.row.$visual, $('<hr>'), shelves.column.$visual, $('<hr>'));

      // set the whole body as "remove element", i.e. dropping it anywhere there will remove the dragged element
      inter.asRemoveElem($(document.body).find('main'));
    }

    function makeToolbar (id) {
      var $modelSelect = $('<div> Model: custom MVG ... </div>');
      var $undo = $('<div class="pl-toolbar-button"> Undo </div>').click( () => {console.log("undo it!");});
      var $redo = $('<div class="pl-toolbar-button"> Redo </div>').click( () => {console.log("redo it!");});
      var $clear = $('<div class="pl-toolbar-button"> Clear </div>').click( () => clear(shelves));
      var $query = $('<div class="pl-toolbar-button">Generate Query!</div>')
        .click( () => { //eval('console.log("");'); // prevents auto-optimization of the closure
          onUpdate();
      });
      return $('<div id="' + id + '">').append($modelSelect, $undo, $redo, $clear, $query);
    }

    function clear (shelves) {
      shelves.detail.clear();
      shelves.color.clear();
      shelves.filter.clear();
      shelves.shape.clear();
      shelves.size.clear();
      shelves.row.clear();
      shelves.column.clear();
    }

    class InfoBox {
      constructor (id) {
        this.id = id;
        this.$visual = $('<div class="pl-info-box" id="' + id + '"></div>');
        this.$visual.click( () => {
          this.hide();
        });
      }

      hide () {
        this.$visual.hide();
      }

      show () {
        this.$visual.show();
      }

      message (str, type="error") {
        this.$visual.text(str);
        this.show();
      }
    }

    /**
     * do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
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

    var onUpdate = _.debounce(
      function () {
        try {
          query = VisMEL.VisMEL.FromShelves(shelves, model);
          queryTable = new QueryTable(query);
          modelTable = new ModelTable(queryTable);
        }
        catch (error) {
          console.error(error);
          infoBox.message(error);
        }
        modelTable.model()
          .then(() => {
            // console.log("modeltable done");
            infoBox.hide();
            resultTable = new ResultTable(modelTable, queryTable);
            // console.log("result table instantiated");
          })
          .then(() => resultTable.fetch())
          .then(() => {
            // console.log("result table done");
            viewTable = new ViewTable(visPaneD3, resultTable, queryTable);
            // console.log("view table done");
          })
          /*.then(() => {
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
           })*/
          .catch((reason) => {
            console.error(reason);
            if (reason instanceof XMLHttpRequest) {
              infoBox.message(reason.responseText);
            } else if (reason instanceof Error) {
              infoBox.message(reason.toString());
            }
          });
      }, 200);


    /**
     * Enables user querying for given shelves.
     */
    function enableQuerying(shelves) {
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

    // create tool bar
    makeToolbar("pl-toolbar").insertBefore($('main'));

    // create info box
    var infoBox = new InfoBox("info-box");
    infoBox.$visual.insertBefore($('main'));

    // visualization base element
    var visPaneD3 = d3.select("#pl-visualization")
      .append("svg")
      .attr({
        width: 400,
        height: 400
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
          console.log("Starting the actual app!");
          // get initial model
          model = new Remote.Model('mvg4', "http://127.0.0.1:5000/webservice");
          model.update()
            .then(() => populateGUI(model, shelves))
            .then(() => initialQuerySetup(shelves))
            .then(() => enableQuerying(shelves))
            .catch((err) => {
              console.error(err);
              infoBox.message("Could not load remote model from Server!");
            });
        }
      }
    };

  });