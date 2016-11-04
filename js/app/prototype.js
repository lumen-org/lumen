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
     * Utility function. Clears the given collection of shelves
     */
    function clear (shelves) {
      shelves.detail.clear();
      shelves.color.clear();
      shelves.filter.clear();
      shelves.shape.clear();
      shelves.size.clear();
      shelves.row.clear();
      shelves.column.clear();
    }


    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
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

    /**
     * An info box allows receives messages that it shows.
     */
    class InfoBox {
      constructor (id) {
        this.id = id;
        this._$visual = $('<div class="pl-info-box" id="' + id + '"></div>');
        this._$visual.click( () => {
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
        this._$visual.text(str);
        this.show();
      }

      get $visual () {
        return this._$visual;
      }
    }

    /**
     * Create and return GUI for shelves and models.
     */
    function makeGUI(model, shelves, update) {
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

      // add all shelves visuals to containers
      var models = $('<div class="pl-model"></div>').append(
        shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));
      var mappings = $('<div class="pl-mappings"></div>').append(
        shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
        $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, $('<hr>'));
      var layout = $('<div class="pl-layout"></div>').append( shelves.row.$visual, $('<hr>'), shelves.column.$visual, $('<hr>'));

      // Enables user querying for given shelves.
      for (const key of Object.keys(shelves))
        shelves[key].on(Emitter.ChangedEvent, update);

      return {'models':models, 'mappings':mappings, 'layout':layout};
    }

    /**
     * Creates and returns a toolbar.
     */
    function makeToolbar (shelves, update) {
      var $modelSelect = $('<div> Model: custom MVG ... </div>');
      var $undo = $('<div class="pl-toolbar-button"> Undo </div>').click( () => {console.log("undo it!");});
      var $redo = $('<div class="pl-toolbar-button"> Redo </div>').click( () => {console.log("redo it!");});
      var $clear = $('<div class="pl-toolbar-button"> Clear </div>').click( () => clear(shelves));
      var $query = $('<div class="pl-toolbar-button">Query!</div>')
        .click( () => { //eval('console.log("");'); // prevents auto-optimization of the closure
          update();
      });
      return $('<div class="pl-toolbar">').append($modelSelect, $undo, $redo, $clear, $query);
    }

    /**
     * Creates and returns a new, empty context.
     */
    function makeContext() {

      /**
       * Creates and returns a function to update a context. On calling this function the
       * context does not need to be provided again.
       *
       * @param c the context.
       */
      function makeContextedUpdateFct (c) {

        // Note that this function accesses the local scope!
        function update () {
          try {
            c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.model);
            c.queryTable = new QueryTable(c.query);
            c.modelTable = new ModelTable(c.queryTable);
          }
          catch (error) {
            console.error(error);
            infoBox.message(error);
          }
          c.modelTable.model()
            .then(() => {
              // console.log("modeltable done");
              infoBox.hide();
              c.resultTable = new ResultTable(c.modelTable, c.queryTable);
              // console.log("result table instantiated");
            })
            .then(() => c.resultTable.fetch())
            .then(() => {
              // console.log("result table done");
              c.viewTable = new ViewTable(c.visualD3, c.resultTable, c.queryTable);
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
        }

        return update;
      }

      var context = {
        // server and model
        server: "",
        model: {},
        // shelves configuration
        shelves: sh.construct(),
        // the stages of the pipeline: query -> ... -> visualization
        query: {},
        queryTable: {},
        modelTable: {},
        resultTable: {},
        viewTable: {}
      };
      context.update = _.debounce(makeContextedUpdateFct(context), 200);

      return context;
    }

    /**
     * Activates a context and enables interactive editing of a query on/for it.
     * @param context Context to activate.
     */
    function activate (context) {
      // set local references to the chosen context
      server = "http://127.0.0.1:5000/webservice";
      model = context.model;
      query = context.query;
      if(context.hasOwnProperty('modelTable')) {
        modelTable = context.modelTable;
      } else {
        modelTable = {};
      }
      if(context.hasOwnProperty('resultTable')) {
        resultTable = context.resultTable;
      } else {
        resultTable = {};
      }
      if(context.hasOwnProperty('viewTable')) {
        viewTable = context.viewTable;
      } else {
        viewTable = {};
      }
      // update shelves
    }

    /// independent of context

    // set the whole body as "remove element", i.e. dropping it anywhere there will remove the dragged element
    inter.asRemoveElem($(document.body).find('main'));

    // create info box
    var infoBox = new InfoBox("info-box");
    infoBox.$visual.insertBefore($('main'));


    function testPQL(server) { // jshint ignore:line
      function printResult(res) {
        console.log(res);
        return res;
      }
      var mb = new Remote.ModelBase(server);
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

    function testVisMEL(server) {
      //var c = context;
      var mb = new Remote.ModelBase(server);
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
          testPQL(context.server);
        else if (testVisMELflag)
          testVisMEL(context.server);
        else {
          console.log("Starting the actual app!");

          //// per context

          //
          var context = makeContext();
          context.server = "http://127.0.0.1:5000/webservice";

          // TODO: as much as possible should be in makeContext!
          // also the context needs to know about the visuals such that it can enable and disable it
          // hiding and showing the different DOM elements for the visualizations is what needs to be done in activate(context)!

          // create and insert tool bar
          makeToolbar(context.shelves, context.update).insertBefore($('main'));

          // visualization base element
          context.visualD3 = d3.select("#pl-visualization-container")
            .append("svg")
            .classed("pl-visualization", true)
            .attr({width: 300, height: 300});

          let $visuals = makeGUI(context.model, context.shelves, context.update);
          $('#pl-model-container').append($visuals.models);
          $('#pl-mappings-container').append($visuals.mappings);
          $('#pl-layout-container').append($visuals.layout);

          // get initial model
          context.model = new Remote.Model('mvg4', context.server);
          context.model.update()
            .then(() => {
              // on model change
            })
            .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas)) // on model change
            .then(() => initialQuerySetup(context.shelves)) // on initial startup only
            //.then(() => enableQuerying(context.shelves, context.update))  // remove later, debug
            .catch((err) => {
              console.error(err);
              infoBox.message("Could not load remote model from Server!");
            });
        }
      }
    };

  });