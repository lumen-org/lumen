/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * @module main
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './PQL', './VisMEL', './VisMELShelfDropping', './shelves', './visuals', './interaction', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './TableAlgebra'],
  function (Emitter, d3, init, PQL, VisMEL, drop, sh, vis, inter, UnRedo, QueryTable, ModelTable, ResultTable, ViewTable, Remote, TableAlgebraExpr) {
    'use strict';

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
      // drop(shelves.dim, shelves.meas.at(0));
      // drop(shelves.column, shelves.meas.at(1));
      //drop(shelves.filter, shelves.meas.at(1));
      //drop(shelves.detail, shelves.dim.at(0));
      //drop(shelves.shape, shelves.dim.at(0));
      //drop(shelves.size, shelves.meas.at(2));
      //drop(shelves.row, shelves.dim.at(0));
      //drop(shelves.row, shelves.meas.at(1));
      //drop(shelves.color, shelves.meas.at(2));
    }

    /**
     * An info box receives messages that it shows.
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
     * A model selector, i.e. an input field whose value is used as a model name.
     * On input confirmation a new context is created, the according model is fetched and activated.
     */
    class ModelSelector {

      constructor (context) {
        this._context = context;

        let $modelInput = $('<input type="text" value=""/>')
          .keydown( (event) => {
            var modelName = event.target.value;
            if (event.keyCode === 13) {

              // create new context and visualization with that model if it exists
              var context = new Context("http://127.0.0.1:5000/webservice", modelName);

              // fetch model
              context.basemodel.update()
                .then(() => sh.populate(context.basemodel, context.shelves.dim, context.shelves.meas))
                .then(() => activate(context, ['visualization', 'visPanel']))
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Could not load remote model from Server!");
                  // TODO: remove vis and everything else ...
                });
            }
          });

        this.$visual = $('<div class="pl-model-selector"></div>')
          .append($('<div>load new model:</div>'))
          .append($modelInput);

        if(context !== undefined)
          this.setContext(context);
      }

      /**
       * Sets the context that the toolbar controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context; // TODO: not even tht is needed ...
        //TODO in the future: fetch available models from the modelserver...? for now we are done!
      }
    }

    /**
     * A toolbar to control a context.
     */
    class Toolbar {

      constructor (context) {

        var $undo = $('<div class="pl-toolbar-button"> Undo </div>').click( () => {
          let c = this._context;
          if (c.unredoer.hasUndo)
            c.loadShelves(c.unredoer.undo());
          else
            infoBox.message("no undo left!");
        });
        var $save = $('<div class="pl-toolbar-button"> Save </div>').click( () => {
          let c = this._context;
          c.unredoer.commit(c.copyShelves());
          console.log("saved it!");
        });
        var $redo = $('<div class="pl-toolbar-button"> Redo </div>').click( () => {
          let c = this._context;
          if (c.unredoer.hasRedo)
            c.loadShelves(c.unredoer.redo());
          else
            infoBox.message("no redo left!");
        });
        var $clear = $('<div class="pl-toolbar-button"> Clear </div>').click(
          () => this._context.clearShelves(['dim','meas']));
        var $clone = $('<div class="pl-toolbar-button"> Clone </div>').click(
          () => {
            let clone = this._context.copy();
            // fetch model
            clone.basemodel.update()
              .then(() => activate(clone, ['visualization', 'visPanel']))
              .then(() => clone.update())
              .catch((err) => {
                console.error(err);
                infoBox.message("Could not load remote model from Server!");
                // TODO: remove vis and everything else ...
              });
          }
        );

        var $query = $('<div class="pl-toolbar-button">Query!</div>').click(
          () => this._context.update());

        this._modelSelector = new ModelSelector(context);
        this.$visual = $('<div class="pl-toolbar">').append(this._modelSelector.$visual, $clone, $undo, $save, $redo, $clear, $query);

        if(context !== undefined)
          this.setContext(context);
      }

      /**
       * Sets the context that the toolbar controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");

        this._context = context;
        this._modelSelector.setContext(context);

      }
    }


    class Context {
      /**
       * Creates an new context. If no parameters are given, the context is empty.
       * However, you can also specify the server, or the server and the modelName, or the server, the modelname and existing shelves for these.
       */
      constructor (server, modelName, shelves) {

        /**
         * Creates and returns a function to update a context. _On calling this function the
         * context does not need to be provided again!_
         *
         * @param c the context.
         */
        function makeContextedUpdateFct (c) {

          // Note that this function accesses the local scope!
          function update (commit = true) {
            console.log("updating!");
            try {
              let mode = $('input[name=datavsmodel]:checked','#pl-datavsmodel-form').val();

              c.model = c.basemodel.localCopy();
              c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.model, mode);
              c.query.rebase(c.model);  // important! rebase on the basemodel's copy to prevent modification of basemodel
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
                c.viewTable = new ViewTable(c.$visuals.visPanel.get(0), c.resultTable, c.queryTable, c);
                // console.log("view table done");
              })
              .then(() => {
                // TODO: commit only if something changed!
                if (commit) {
                  c.unredoer.commit(c.copyShelves());
                  console.log("commiting");
                }
              })
              .then(() => {
                console.log("context: ");
                console.log(c);
              })
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

        // server and model
        // note that basemodel is expected to be constant, i.e. it never is changed
        this.server = server;
        if (modelName !== undefined && server !== undefined)
          this.basemodel = new Remote.Model(modelName, server);
        else
          this.basemodel = {};

        // shelves configuration
        if (modelName !== undefined && server !== undefined && shelves !== undefined)
          this.shelves = shelves;
        else
          this.shelves = sh.construct();

        // the stages of the pipeline: query -> ... -> visualization
        this.query = {};
        this.queryTable = {};
        this.modelTable = {};
        this.resultTable = {};
        this.viewTable = {};
        //this.remove = remove;

        // update is not an instance method that needs to be called with a proper this. it always knows its context.
        this.update = _.debounce(makeContextedUpdateFct(this), 200);
        this.unredoer = new UnRedo(20);

        // this creates all GUI elements
        this.$visuals = Context._makeGUI(this);

        this.displayVisuals(false);
        this.attachVisuals();
      }

      /**
       * destructor of this context
       */
      remove() {
        let $visuals = this.$visuals;
        for(let visual in $visuals) {
          if ($visuals.hasOwnProperty(visual))
            $visuals[visual].remove();
        }
      }

      /**
       * Hide or show visuals. You can specify which visuals to except from it.
       */
      displayVisuals(flag, except = []) {
        var $visuals = this.$visuals;
        var except = new Set(except);
        for (const key of Object.keys($visuals))
          if (!except.has(key))
            flag ? $visuals[key].show() : $visuals[key].hide();
      }

      /**
       * Attaches all visuals to the appropriate containers of the actual DOM (see code).
       */
      attachVisuals() {
        var $visuals = this.$visuals;
        $('#pl-model-container').append($visuals.models);
        $('#pl-layout-container').append($visuals.layout);
        $('#pl-mappings-container').append($visuals.mappings);
        $('#pl-visualization-container').append($visuals.visualization);
      }

      /**
       * Utility function. Clears the given collection of shelves, except for measure and dimension shelves.
       */
      clearShelves (except = []) {
        var except = new Set(except);
        for (const key of Object.keys(this.shelves))
          if (!except.has(key))
            this.shelves[key].clear();
      }

      /**
       * Loads a new configuration of shelves in this context. Note that the shelves must match the model. The shelves replace the currently set shelves, and are also set as made visual and interactive.
       * @param shelves A new configuration of shelves.
       */
      loadShelves (shelves) {
        // make new visual representations
        this.shelves = shelves;
        var $newVis = Context._makeShelvesGUI(this);

        // replace current visuals with the ones
        // some more details, by the example of the '.pl-model'-div
        //  - replaceWith replaces some selection with something else: we want to replace the old '.pl-model'-div with the new one
        //  - however, that does not delete the old one. so we do that with remove(). Note that replaceWith returns the replaced elements.
        //  - neither it update the selection $oldVis.models refers to. hence we have to ste that as well.
        let $oldVis = this.$visuals;
        for (const key of Object.keys($newVis)) {
          $oldVis[key].replaceWith($newVis[key]).remove();
          $oldVis[key] = $newVis[key];
        }

        this.update(false);
      }

      /**
       * Returns a deep copy of the shelves of this context (excluding any visuals).
       */
      copyShelves() {
        var shelvesCopy = {};
        for (const key of Object.keys(this.shelves))
          shelvesCopy[key] = this.shelves[key].copy();
        return shelvesCopy;
      }

      /**
       * Creates a deep copy of this context. This means a new (local view on the) model is created, as well as a copy of the shelves and their contents.  As the standard new context it is already "visual" (i.e. attachVisuals is called), but its "hidden" before (i.e. hideVisuals() is called).
       * Note that the pipeline including the visualization is not copied, but rerun (i.e. query, querytable, modelTable)
       */
      copy () {
        // TODO: undo/redo states are lost on copy
        return new Context(this.server, this.basemodel.name, this.copyShelves());
      }

      static _makeVisualization(context) {
        var $pane = $('<svg class="pl-visualization-svg"></svg>');

        var $removeButton = $('<div class="pl-remove-button noselect pl-hidden"> x </div>');
        $removeButton.click( context.remove.bind(context) );

        var $title = $('<div>' + context.basemodel.name + '</div>');
        var $nav = $removeButton;
        return $('<div class="pl-visualization"></div>')
          .append($title, $nav, $pane)
          .click( () => activate(context, ['visualization', 'visPanel']) );
      }

      /**
       * Creates a visual, interactable representation of the shelves in the given context and returns this as an object with three attributes: models, mappings and  layout respectively. Each are a jQuery selection of the visual representation, respectively.
       * @param context
       * @private
       */
      static _makeShelvesGUI (context) {
        var shelves = context.shelves;

        // make all shelves visual and interactable
        shelves.modeldata.beVisual({label: 'Model vs Data'}).beInteractable();
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

        var visual = {};

        // shelves visuals
        visual.models = $('<div class="pl-model"></div>').append(
          shelves.modeldata.$visual, $('<hr>'), shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));
        visual.mappings = $('<div class="pl-mappings"></div>').append(
          shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
          $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, $('<hr>'));
        visual.layout = $('<div class="pl-layout"></div>').append( shelves.row.$visual, $('<hr>'), shelves.column.$visual, $('<hr>'));

        // Enables user querying for shelves
        for (const key of Object.keys(shelves))
          shelves[key].on(Emitter.ChangedEvent, context.update);

        return visual;
      }

      /**
       * Create and return GUI for shelves and models.
       *
       * Note: this is GUI stuff that is instantiated for each context. "Singleton" GUI elements
       * are not managed like this.
       */
      static _makeGUI(context) {
        var visual = Context._makeShelvesGUI(context);
        visual.visualization = Context._makeVisualization(context);
        visual.visPanel = $('.pl-visualization-svg', visual.visualization);
        return visual;
      }
    }


    /**
     * Activates a context and enables interactive editing of a query on/for it.
     * It hides all visuals of the current context, except those specified.
     * @param context Context to activate.
     */
    var activate = (function(){
      // don't get confused. In the end it returns a function. And that function has a closure to hold its private variable _currentContext. That's it.
      var _currentContext = {};

      function _activate (context, except = []) {
        /// disable old context
        if (!_.isEmpty(_currentContext)) {
          _currentContext.displayVisuals(false, except);
            // remove marking for current active visualization
          _currentContext.$visuals['visualization'].toggleClass('pl-active', false);
        }

        /// activate new context
        _currentContext = context;
        _currentContext.displayVisuals(true);

        // add marking for new active visualization
        _currentContext.$visuals['visualization'].toggleClass('pl-active', true);

        toolbar.setContext(context);
        // TODO: later maybe its nicer to emit a signal on context change. but for now its easier this way.
        //activate.emit("ContextChanged");
      }

      return _activate;
    })();

    // set the whole body as "remove element", i.e. dropping it anywhere there will remove the dragged element
    inter.asRemoveElem($(document.body).find('main'));

    // create info box
    var infoBox = new InfoBox("info-box");
    infoBox.$visual.insertAfter($('main'));

    // create toolbar
    var toolbar = new Toolbar();
    toolbar.$visual.appendTo($('#pl-toolbar-container'));

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
          testPQL("http://127.0.0.1:5000/webservice");
        else if (testVisMELflag)
          testVisMEL("http://127.0.0.1:5000/webservice");
        else {
          console.log("Starting the actual app!");

          // create initial context with model
          var context = new Context("http://127.0.0.1:5000/webservice", 'cg_crabs');
          //var context = new Context("http://127.0.0.1:5000/webservice", 'categorical_dummy');
          // var context = new Context("http://127.0.0.1:5000/webservice", 'iris');
          // var context = new Context("http://127.0.0.1:5000/webservice", 'mvg4');

          // activate that context
          activate(context, ['visualization', 'visPanel']);

          // fetch model
          context.basemodel.update()
            .then(() => sh.populate(context.basemodel, context.shelves.dim, context.shelves.meas)) // on model change
            .then(() => initialQuerySetup(context.shelves)) // on initial startup only
            .catch((err) => {
              console.error(err);
              infoBox.message("Could not load remote model from Server!");
            });
        }
      }
    };

  });