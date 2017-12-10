/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * @module main
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/emitter', 'd3', './init', './PQL', './VisMEL', './VisMELShelfDropping', './shelves', './visuals', './interaction', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './TraceGenerator', './RemoteModelling', './ViewSettings'],
  function (Emitter, d3, init, PQL, VisMEL, drop, sh, vis, inter, UnRedo, QueryTable, ModelTable, RT, ViewTable, AtomicPlotly, Remote, Config) {
    'use strict';

    // the default model to be loaded on startup
    const DEFAULT_MODEL = 'mcg_mpg_chris_map';
    //const DEFAULT_MODEL = 'mcg_crabs';

    // the default model server
    // const DEFAULT_SERVER_ADDRESS = 'http://probmodvis.pythonanywhere.com/webservice';
    const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:5000/webservice';

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
      drop(shelves.column, shelves.meas.at(0));
      drop(shelves.row, shelves.dim.at(0));

      //drop(shelves.filter, shelves.meas.at(1));
      // drop(shelves.detail, shelves.meas.at(2));
      // drop(shelves.color, shelves.dim.at(1));
      // drop(shelves.shape, shelves.dim.at(2));
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


    class Context {
      /**
       * Creates an new context. If no parameters are given, the context is empty.
       * However, you can also specify the server, or the server and the modelName, or the server, the modelname and existing shelves for these.
       *
       * Note that the context is not immediately visual when instanciated. Call this.makeGUI for that.
       */
      constructor (server, modelName, shelves) {

        /**
         * Creates and returns a function to update a context. _On calling this function the
         * context does not need to be provided again!_
         *
         * @param c the context.
         */
        function makeContextedUpdateFct (c) {

          // Note that this function accesses the file scope!
          function update (commit = true) {
            console.log("updating!");
            try {
              let mode = $('input[name=datavsmodel]:checked','#pl-datavsmodel-form').val();
              c.model = c.basemodel.localCopy();
              c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.model, mode);
              c.query.rebase(c.model);  // important! rebase on the basemodel's copy to prevent modification of basemodel
              //c.config = staticConfig();
              c.queryTable = new QueryTable(c.query);
              c.modelTable = new ModelTable(c.queryTable);
            }
            catch (error) {
              console.error(error);
              infoBox.message(error);
            }
            c.modelTable.model()
              .then(() => infoBox.hide())

              .then(() => RT.aggrCollection(c.queryTable, c.modelTable, c.config.visConfig.aggregations.active))
              .then(res => c.aggrRT = res)
              //.then(() => RT.samplesCollection(c.queryTable, c.model, c.config.visConfig.data.active))
              .then(() => RT.samplesCollection(c.queryTable, c.modelTable, c.config.visConfig.data.active))
              .then(res => c.dataRT = res)
              .then(() => RT.uniDensityCollection(c.queryTable, c.modelTable, c.config.visConfig.marginals.active))
              .then(res => c.uniDensityRT = res)
              .then(() => RT.biDensityCollection(c.queryTable, c.modelTable, c.config.visConfig.contour.active))
              .then(res => c.biDensityRT = res)
              .then(() => c.viewTable = new ViewTable(c.$visuals.visPanel.get(0), c.aggrRT, c.dataRT, c.uniDensityRT, c.biDensityRT, c.queryTable))
              .then(() => {
                if (commit) {
                  // TODO: commit only if something changed!
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

        // other configuration
        this.config = {
          visConfig: {
            aggregations: { active: Config.views.aggregations.active },
            data: { active: Config.views.data.active, },
            marginals: { active: Config.views.marginals.active },
            contour: { active: Config.views.contour.active },
          },
        };
        // let configCopy = JSON.parse(JSON.stringify(Config.views)); // whaaat? this seems the standard solution to deep cloning ... lol
        // Object.assign(this.config.visConfig, configCopy); // set initial config

        // the stages of the pipeline: query -> ... -> visualization
        this.query = {};
        this.queryTable = {};
        this.modelTable = {};
        this.aggrRT = {};
        this.dataRT = {};
        this.uniDensityRT = {};
        this.biDensityRT = {};
        this.viewTable = {};
        //this.remove = remove;

        // update is not an instance method that needs to be called with a proper this. it always knows its context.
        this.update = _.debounce(makeContextedUpdateFct(this), 200);
        this.unredoer = new UnRedo(20);
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
        let $visuals = this.$visuals;
        except = new Set(except);
        for (const key of Object.keys($visuals))
          if (!except.has(key)) {
            if (flag) $visuals[key].show();
            else $visuals[key].hide();
          }
      }

      /**
       * Attaches all visuals to the appropriate containers of the actual DOM (see code).
       */
      attachVisuals() {
        let $visuals = this.$visuals;
        $('#pl-model-container').append($visuals.models);
        $('#pl-layout-container').append($visuals.layout);
        $('#pl-mappings-container').append($visuals.mappings);
        $('#pl-visualization-container').append($visuals.visualization);
        $('#pl-config-container').append($visuals.visConfig);
      }

      /**
       * Utility function. Clears the given collection of shelves, except for measure and dimension shelves.
       */
      clearShelves (except = []) {
        except = new Set(except);
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
        //  - neither of it updates the selection $oldVis.models refers to. hence we have to set that as well.
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
       * Returns the visualization config according to the state of the GUI.
       */
      getVisConfig () {
        this.$visuals.visConfig
      }

      /**
       * Creates a deep copy of this context. This means a new (local view on the) model is created, as well as a copy of the shelves and their contents.  As the standard new context it is already "visual" (i.e. attachVisuals is called), but its "hidden" before (i.e. hideVisuals() is called).
       * Note that the pipeline including the visualization is not copied, but rerun.
       */
      copy () {
        // TODO: undo/redo states are lost on copy
        let copiedContext = new Context(this.server, this.basemodel.name, this.copyShelves());

        // additional stuff to copy
        copiedContext.config = JSON.parse(JSON.stringify(this.config));

        // now make it visual
        copiedContext.makeGUI();

        return copiedContext;
      }

      static _makeVisualization(context) {
        var $paneDiv = $('<div class="pl-visualization-pane"></div>');


        var $removeButton = $('<div class="pl-remove-button noselect pl-hidden"> x </div>');
        $removeButton.click( context.remove.bind(context) );

        var $nav = $removeButton;
        return $('<div class="pl-visualization"></div>')
          .append($paneDiv, $nav)
          .click( () => activate(context, ['visualization', 'visPanel']) )
          .resizable({
            ghost: true,
            helper: "pl-resizing",
            stop: (event, ui) => {
              let c = context;

              // redraw
              // TODO: what is visPanel, ... ?
              c.viewTable = new ViewTable(c.$visuals.visPanel.get(0), c.aggrRT, c.dataRT, c.uniDensityRT, c.biDensityRT, c.queryTable);
            }
          });
      }

      /**
       * Creates a visual, interactable representation of the shelves in the given context and returns this as an object with three attributes: models, mappings and  layout respectively. Each are a jQuery selection of the visual representation, respectively.
       * @param context
       * @private
       */
      static _makeShelvesGUI (context) {
        var shelves = context.shelves;

        // make all shelves visual and interactable
        // i.e. creates DOM elements that are attach in .$visual of each shelf
        //shelves.modeldata.beVisual({label: 'Model vs Data'}).beInteractable();
        shelves.meas.beVisual({label: 'Quantitative'}).beInteractable();
        shelves.dim.beVisual({label: 'Categorical'}).beInteractable();
        shelves.detail.beVisual({label: 'Details'}).beInteractable();
        shelves.color.beVisual({label: 'Color'}).beInteractable();
        shelves.filter.beVisual({label: 'Filter'}).beInteractable();
        shelves.shape.beVisual({label: 'Shape'}).beInteractable();
        shelves.size.beVisual({label: 'Size'}).beInteractable();
        shelves.remove.beVisual({label: 'Drop here to remove'}).beInteractable();
        shelves.column.beVisual({label: 'X-Axis'}).beInteractable();
        shelves.row.beVisual({label: 'Y-Axis'}).beInteractable();

        var visual = {};

        // shelves visuals
        visual.models = $('<div class="pl-model"></div>').append(
          //shelves.modeldata.$visual, $('<hr>'),
          shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), $('<hr>'), shelves.remove.$visual, $('<hr>'));

        // old:
        // visual.mappings = $('<div class="pl-mappings"></div>').append(
        //   shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
        //   $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, );
        // TODO HACK for paper
        visual.mappings = $('<div class="pl-mappings"></div>').append(
          shelves.filter.$visual, $('<hr>'));

        visual.layout = $('<div class="pl-layout"></div>').append( shelves.column.$visual, $('<hr>'), shelves.row.$visual, $('<hr>'));

        // Enables user querying for shelves
        // shelves emit ChangedEvent. Now we bind to it.
        for (const key of Object.keys(shelves))
          shelves[key].on(Emitter.ChangedEvent, context.update);

        return visual;
      }

      /**
       * Creates and returns GUI for visualization config.
       *
       * An context update is triggered, if the state of the config is changed.
       *
       * @param context
       * @return {void|*|jQuery}
       * @private
       */
      static _makeVisConfig (context) {

        // TODO: clean up. this is a quick hack for the paper only.
        let nameMap = {
          'aggregations': 'aggregation',
          'marginals': 'marginal',
          'contour': 'density',
          'data': 'data',
        };

        let title = $('<div class="shelf-title">Facets</div>');
        // create checkboxes
        // let checkBoxes = ['contour', 'marginals', 'aggregations', 'data'].map( // TODO: HACK for paper
        let checkBoxes = ['contour', 'marginals', 'aggregations'].map(
          what => {
            // TODO PL: much room for optimization, as often we simply need to redraw what we already have ...
            let $checkBox = $('<input type="checkbox">' + nameMap[what] + '</input>')
              .prop("checked", context.config.visConfig[what].active)
              .change( (e) => {
                // update the config and ...
                context.config.visConfig[what].active = e.target.checked;
                // ... trigger an update
                context.update()
              });
            return $('<div class="pl-config-onoff">  </div>').append($checkBox);
          }
        );
        let $visConfig = $('<div class="pl-config-visualization shelf vertical"></div>').append(
          title,
          ...checkBoxes
        );
        return $visConfig;
      }

      /**
       * Create and return GUI for shelves and models.
       *
       * Note: this is GUI stuff that is instantiated for each context. "Singleton" GUI elements
       * are not managed like this.
       */
      static _makeGUI(context) {
        var visual = Context._makeShelvesGUI(context);
        visual.visConfig = Context._makeVisConfig(context);
        visual.visualization = Context._makeVisualization(context);
        visual.visPanel = $('div.pl-visualization-pane', visual.visualization);
        return visual;
      }

      /* Creates, hides and attaches GUI elements for this context to the DOM
      **/
      makeGUI() {
        // this creates all GUI elements
        this.$visuals = Context._makeGUI(this);

        this.displayVisuals(false);
        this.attachVisuals();
        return this;
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
              var context = new Context(DEFAULT_SERVER_ADDRESS, modelName).makeGUI();

              // fetch model
              context.basemodel.update()
                .then(() => sh.populate(context.basemodel, context.shelves.dim, context.shelves.meas))
                .then(() => activate(context, ['visualization', 'visPanel']))
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Could not load remote model '" + modelName + "' from Server '" + context.server + "' !");
                  // TODO: remove vis and everything else ...
                });
            }
          });

        this.$visual = $('<div class="pl-model-selector"></div>')
          .append($('<div>Load Model:</div>'))
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
        /*var $save = $('<div class="pl-toolbar-button"> Save </div>').click( () => {
         let c = this._context;
         c.unredoer.commit(c.copyShelves());
         console.log("saved it!");
         });*/
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
        this.$visual = $('<div class="pl-toolbar">').append(this._modelSelector.$visual, $clone, $undo,/* $save,*/ $redo, $clear, $query);

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
          _currentContext.$visuals.visualization.toggleClass('pl-active', false);
        }

        /// activate new context
        _currentContext = context;
        _currentContext.displayVisuals(true);

        // add marking for new active visualization
        _currentContext.$visuals.visualization.toggleClass('pl-active', true);

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

    return {
      /**
       * Starts the application.
       */
      start: function () {
        // create initial context with model
        let context = new Context(DEFAULT_SERVER_ADDRESS, DEFAULT_MODEL).makeGUI();

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
    };

  });
