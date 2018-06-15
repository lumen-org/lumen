/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * @module main
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */

define(['lib/emitter', 'd3', './init', './PQL', './VisMEL', './VisMEL4Traces', './VisMELShelfDropping', './shelves', './visuals', './interaction', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './TraceGenerator', './RemoteModelling', './SettingsJSON', './SettingsEditor', './ViewSettings'],
  function (Emitter, d3, init, PQL, VisMEL, V4T, drop, sh, vis, inter, UnRedo, QueryTable, ModelTable, RT, ViewTable, AtomicPlotly, Remote, Settings, SettingsEditor, Config ) {
    'use strict';

    // the default model to be loaded on startup
    //const DEFAULT_MODEL = 'Auto_MPG';
    const DEFAULT_MODEL = 'mcg_crabs_map';

    // the default model server
    // const DEFAULT_SERVER_ADDRESS = 'http://probmodvis.pythonanywhere.com/webservice';
    const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:5000/webservice';

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
        drop(shelves.column, shelves.dim.at(0));
        drop(shelves.column, shelves.meas.at(1));
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
       * However, you can also specify the server, or the server and the modelName, or the server, the model name and existing shelves for these.
       *
       * Note that the context is not immediately visual when instantiated. Call this.makeGUI for that.
       *
       * Contexts emit signals as follows:
       *
       *   * "ContextDeletedEvent" if it is deconstructed / deleted.
       *   * "ContextQueryFinishSuccessEvent": iff the context successfully finished its update cycle.
       */
      constructor (server, modelName, shelves) {

        /**
         * Creates and returns a function to update a context. _On calling this function the
         * context does not need to be provided again!_
         *
         * The update function emits a number of signals, see documentation of the constructor.
         *
         * @param c the context.
         */
        function makeContextedUpdateFct (c) {

          // Note that this function accesses the file scope!
          function update (commit = true) {
            console.log("updating!");
            try {
              let mode = $('input[name=datavsmodel]:checked','#pl-datavsmodel-form').val();

              c.basemodel = c.model.localCopy();

              // get user query
              c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.basemodel, mode);
              c.query.rebase(c.basemodel);  // important! rebase on the model's copy to prevent modification of model

              // TODO: apply global filters and remove them from query
              // i.e. change basemodel, and basequery
              c.basequery = c.query;

              c.baseQueryTable = new QueryTable(c.basequery);
              c.baseModelTable = new ModelTable(c.baseQueryTable);

              // let foo = V4T.uniDensity(c.query, 'rows');
              // console.log(foo);
            }
            catch (error) {
              console.error(error);
              infoBox.message(error);
            }

            // used to replace value-identical FieldUsages and BaseMaps of vismel queries with reference-identical ones
            // this is crucial to link corresponding axis and results in the visualization
            // (TODO: in fact, we could even use this to link them across multiple visualizations, maybe!?)
            let fieldUsageCacheMap = new Map();

            c.baseModelTable.model()
              .then(() => infoBox.hide())

              .then(() => RT.aggrCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.aggregations.active))
              .then(res => c.aggrRT = res)

              .then(() => RT.samplesCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.data.active, {data_category:'training data'}))
              .then(res => c.dataRT = res)

              .then(() => RT.samplesCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.testData.active, {data_category:'test data'}))
              .then(res => c.testDataRT = res)

              .then(() => RT.uniDensityCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap,
                c.config.visConfig.marginals.active) //  || (TODO: if one axis is empty and there is a quant dimension on the last field usage), i.e. emulate other meaning of marginal.
              )
              .then(res => c.uniDensityRT = res)

              .then(() => RT.biDensityCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.contour.active))
              .then(res => c.biDensityRT = res)

              .then(() => c.viewTable = new ViewTable(c.$visuals.visPanel.get(0), c.aggrRT, c.dataRT, c.testDataRT, c.uniDensityRT, c.biDensityRT, c.baseQueryTable, c.config))
              .then(() => {
                if (commit) {
                  // TODO: commit only if something changed!
                  c.unredoer.commit(c.copyShelves());
                }
              })
              .then(() => {
                console.log("context: ");
                console.log(c);
              })
              .then(() => {
                c.emit("ContextQueryFinishSuccessEvent", this);
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
        // note that model is expected to be constant, i.e. it never is changed
        this.server = server;
        if (server !== undefined)
          this.modelbase = new Remote.ModelBase(server);
        if (modelName !== undefined && server !== undefined)
          this.model = new Remote.Model(modelName, server);
        else
          this.model = {};

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
            testData: { active: Config.views.testData.active, },
            marginals: { active: Config.views.marginals.active },
            contour: { active: Config.views.contour.active },
            predictionOffset: { active: Config.views.predictionOffset.active},
          }
        };
        // let configCopy = JSON.parse(JSON.stringify(Config.views)); // whaaat? this seems the standard solution to deep cloning ... lol
        // Object.assign(this.config.visConfig, configCopy); // set initial config

        // the stages of the pipeline: query -> ... -> visualization
        this.query = {};
        this.baseQueryTable = {};
        this.baseModelTable = {};
        this.aggrRT = {};
        this.dataRT = {};
        this.testDataRT = {};
        this.uniDensityRT = {};
        this.biDensityRT = {};
        this.viewTable = {};
        //this.remove = remove;

        // update is not an instance method that needs to be called with a proper this. it always knows its context.
        this.update = _.debounce(makeContextedUpdateFct(this), 200);
        this.unredoer = new UnRedo(20);

        // emitter mixin
        Emitter(this);
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
        this.emit("ContextDeletedEvent", this);
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
       * Creates a deep copy of this context.
       *
       * This means a new (local view on the) model is created, as well as a copy of the shelves and their contents. As the standard new context it is already "visual" (i.e. attachVisuals is called), but its "hidden" before (i.e. hideVisuals() is called.
       * Note that the pipeline including the visualization is not copied, but rerun.
       */
      copy () {
        // TODO: undo/redo states are lost on copy
        let copiedContext = new Context(this.server, this.model.name, this.copyShelves());

        // additional stuff to copy
        copiedContext.config = JSON.parse(JSON.stringify(this.config));

        // all the following objects are entirely recreated on a shelves change
        // hence we do not need to deep-copy, but can simply link to them!
        // TODO: i get the feeling that I should implement some sort of state machine at the same time, that manages that only required parts of the pipeline are updated
        // for (let name of ['query', 'baseQueryTable', 'baseModelTable', 'aggrRT', 'dataRT', 'testDataRT', 'uniDensityRT', 'biDensityRT', 'viewTable'])
        //   copiedContext[name] = this[name]

        // now make it visual
        copiedContext.makeGUI();

        // size of visualization
        copiedContext.$visuals.visualization.css({
          width: this.$visuals.visualization.css('width'),
          height: this.$visuals.visualization.css('height'),
        });

        return copiedContext;
      }

      static _makeVisualization(context) {
        let $paneDiv = $('<div class="pl-visualization-pane"></div>');
        let $removeButton = $('<div class="pl-remove-button noselect pl-hidden"> x </div>');
        $removeButton.click( context.remove.bind(context) );

        let $nav = $removeButton;
        let $vis = $('<div class="pl-visualization"></div>')
          .append($paneDiv, $nav)
          .click( () => activate(context, ['visualization', 'visPanel']) )
          .resizable({
            ghost: true,
            helper: "pl-resizing",
            stop: (event, ui) => {
              let c = context;
              // redraw
              // TODO: what is visPanel, ... ?
              c.viewTable = new ViewTable(c.$visuals.visPanel.get(0), c.aggrRT, c.dataRT, c.testDataRT, c.uniDensityRT, c.biDensityRT, c.baseQueryTable, c.config);
            }
          });
        $vis.draggable(); // yeah, that was easy. just made it draggable!
        $vis.css( "position", "absolute" ); // we want absolute position!
        return $vis;
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
          shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));

        visual.mappings = $('<div class="pl-mappings"></div>').append(
          shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
          $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual);
        // HACK for paper
        // visual.mappings = $('<div class="pl-mappings"></div>').append(
        //  shelves.filter.$visual, $('<hr>'));

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

        // TODO: clean up. this is a quick hack for the paper only to rename the appearance.
        let nameMap = {
          'aggregations': 'prediction',
          'marginals': 'marginal',
          'contour': 'density',
          'data': 'data',
          'testData': 'test data',
          'predictionOffset': 'prediction offset',
        };

        let title = $('<div class="shelf-title">Facets</div>');
        // create checkboxes
        let checkBoxes = ['contour', 'marginals', 'aggregations', 'data', 'testData', 'predictionOffset']
          .map(
          what => {
            // TODO PL: much room for optimization, as often we simply need to redraw what we already have ...
            let $checkBox = $('<input type="checkbox">' + nameMap[what] + '</input>')
              .prop("checked", context.config.visConfig[what].active)
              .prop("disabled", context.config.visConfig[what].possible)
              .change( (e) => {
                // update the config and ...
                context.config.visConfig[what].active = e.target.checked;
                // ... trigger an update
                context.update()
              });
            return $('<div class="pl-config-onoff"></div>').append($checkBox);
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

        let $modelInput = $('<input type="text" list="models"/>')
          .keydown( (event) => {
            var modelName = event.target.value;
            if (event.keyCode === 13) {

              // create new context and visualization with that model if it exists
              var context = new Context(DEFAULT_SERVER_ADDRESS, modelName).makeGUI();
              contextQueue.add(context);

              // fetch model
              context.model.update()
                .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas))
                .then(() => activate(context, ['visualization', 'visPanel']))
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Could not load remote model '" + modelName + "' from Server '" + context.server + "' !");
                  // TODO: remove vis and everything else ...
                });
            }
          });

        this._$modelsDatalist = $('<datalist id="models"></datalist>');

        this.$visual = $('<div class="pl-model-selector"></div>')
          .append($('<div>Load Model:</div>'))
          .append($modelInput)
          .append(this._$modelsDatalist);

        if(context !== undefined) {
          this.setContext(context);
        }
      }

      /**
       * Sets the context that the toolbar controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
        let that = this;
        context.modelbase.listModels().then(
          res => {          
            let $datalist = that._$modelsDatalist;
            $datalist.empty();
            for (let name of res.models) {
              // filter any names that begin with "__" since these are only 'internal' models
              if (!name.startsWith("__"))
                $datalist.append($("<option>").attr('value',name).text(name))
            }            
          }
        );
      }
    }

    /**
     * A ShelfSwapper swaps the contents of two shelves of a common context.
     * After instantiation its GUI is available under the .$visual attribute.
     */
    class ShelfSwapper {
      constructor (context) {
        let $swapButton = $('<div class="pl-swap-button"> Swap X and Y </div>').click( () => {
          let shelves = this._context.shelves;
          sh.swap(shelves.row, shelves.column);
        });
        this.$visual = $('<div class="pl-swapper">').append($swapButton);

        if(context !== undefined)
          this.setContext(context);
      }

      /**
       * Sets the context that it controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
      }
    }

    /**
     * A DetailsView shows more detailed information about the currently active context, such as:
     *
     *  * model name
     *  * model class
     *  * query
     *  * query results (?)
     *  * query statistics (timings?)
     */
    class DetailsView {
      constructor (context) {
        this._$modelInfo = $('<div>');
        this._$queryInfo = $('<div>');
        this._$resultInfo = $('<div>');

        this.$visual = $('<div class>')
          .append('<div class="pl-details-heading pl-details-model">Model</h3>')
          .append(this._$modelInfo)
          .append('<div class="pl-details-heading pl-details-query">Query</div>')
          .append(this._$queryInfo)
          .append('<div class="pl-details-heading pl-details-result">Result</div>')
          .append(this._$resultInfo);

        if(context !== undefined) {
          this.setContext(context);
          this.update();
        }
      }

      /**
       * Update the view with the current state of the view context.
       */
      update() {
        this.updateModelInfo();
        this.updateQueryInfo();
        this.updateResultInfo();
      }

      updateQueryInfo() {
        // TODO
      }

      updateResultInfo() {
        // TODO
      }

      updateModelInfo () {
        let model = this._context.model;
        this._$modelInfo.empty()
          .append("Model name: " + model.name + "\n")
          .append("Model class: " + "NOT IMPLEMENTED");
      }

      /**
       * Sets the context that it controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
        // bind to events of this context
        this._context.on("ContextQueryFinishSuccessEvent", () => this.update());
      }
    }

    /**
     * A toolbar to control a context.
     * After instantiation its GUI is available under the .$visual attribute.
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
            let contextCopy = this._context.copy();
            contextQueue.add(contextCopy);

            // fetch model
            contextCopy.model.update()
              .then(() => activate(contextCopy, ['visualization', 'visPanel']))
              .then(() => contextCopy.update())
              .catch((err) => {
                console.error(err);
                infoBox.message("Could not load remote model from Server!");
                // TODO: remove vis and everything else ...
              });
          }
        );

        var $query = $('<div class="pl-toolbar-button">Query!</div>').click(
          () => this._context.update());

        var $reload = $('<div class="pl-toolbar-button">Reload Models</div>').click(
          () => this._context.modelbase.reload());

        this._modelSelector = new ModelSelector(context);

        let $configHideButton = $('<div class="pl-toolbar-button">Config</div>').click( () => {
          $('.pl-config').toggle()
        });

        this.$visual = $('<div class="pl-toolbar">').append(this._modelSelector.$visual, $configHideButton,  $clone, $undo,/* $save,*/ $redo, $clear, $query, $reload);

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
     * A managed queue for Contexts.
     *
     * Its purpose is to keep track of the open contexts and their order of use.
     *
     * Elements listen to events of contexts:
     *  * if a context is deleted, the corresponding element is also deleted from the queue and the current first element of the queue is made the new active context.
     *  * if a context is activated, the corresponding element is moved to the beginning of the queue.
     *  * if the last context is deleted, a ContextQueueEmpty event is emitted.
     *
     *  Note that contexts are not automatically added to this this queue when instanciated, but need to be by calling .append().
     */
    class ContextQueue {

      static
      _makeElem(context=undefined, prev=undefined, next=undefined) {
        return {prev, next, context}
      }

      constructor() {
        this._first = undefined;
        this._last = undefined;
        Emitter(this);
      }

      empty() {
        return this._first == undefined;
      }

      /**
       * Makes elem the first element of the queue. elem must be in the queue already.
       * @param elem
       */
      _moveToFront(elem) {
        this._remove(elem);
        this._prepend(elem);
      }

      /**
       * Activates the context of the first element.
       */
      activateFirst() {
        if (this.empty())
          return;
        activate(this._first.context);
      }

      /**
       * Removes element elem from the queue.
       * @param elem
       */
      _remove(elem) {
        if (elem.prev !== undefined) elem.prev.next = elem.next;
        if (elem.next !== undefined) elem.next.prev = elem.prev;
        if (this._first === elem)
          this._first = elem.next;
        if (this._last === elem)
          this._last = elem.prev;
      }

      /**
       * Prepends the element to the front of the queue.
       * @param elem
       * @private
       */
      _prepend(elem) {
        elem.next = this._first;
        elem.prev = undefined;
        if (this.empty())
          this._last = elem;
        else
          this._first.prev = elem;
        this._first = elem;
      }

      /**
       * Adds the context as a new and as the first element to the context queue.
       * @param context
       */
      add(context) {
        let elem = ContextQueue._makeElem(context);
        let that = this;

        this._prepend(elem);

        // an element listens to a context being deleted. it then deletes itself and makes the first element of the queue the active context
        context.on("ContextDeletedEvent", () => {
          that._remove(elem);
          that.activateFirst();
          if(that.empty())
            that.emit("ContextQueueEmpty")
        });

        // an element listens to a context being activated. it then is moved to the beginning of the queue
        context.on("ContextActivatedEvent", () => {
          that._moveToFront(elem);
        })
      }

      /**
       * Returns the currently first context of the queue.
       */
      first() {
        return this.empty() ? undefined : this._first.context;
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
        swapper.setContext(context);
        detailsView.setContext(context);

        // emit signal that context is now active
        context.emit("ContextActivatedEvent", context);

        // TODO: later maybe its nicer to emit a signal on context change. but for now its easier this way.
        //activate.emit("ContextChanged");
      }

      return _activate;
    })();

    // set the whole body as "remove element", i.e. dropping it anywhere there will remove the dragged element
    inter.asRemoveElem($(document.body).find('main'));

    // create info box
    let infoBox = new InfoBox("info-box");
    infoBox.$visual.insertAfter($('main'));

    // create toolbar
    let toolbar = new Toolbar();
    toolbar.$visual.appendTo($('#pl-toolbar-container'));

    // create x-y swap button
    let swapper = new ShelfSwapper();
    swapper.$visual.appendTo($('#pl-layout-container'));

    // details view
    let detailsView = new DetailsView();
    detailsView.$visual.appendTo($('#pl-details-container'));


    // context queue
    let contextQueue = new ContextQueue();
    contextQueue.on("ContextQueueEmpty", () => {
      infoBox.message("Load a model to start!", "info")
    });

    // setup editor for settings
    SettingsEditor.setEditor(document.getElementById('pl-config-editor-container'));
    // NOTE: SettingsEditor represents a singelton! The returned editor by setEditor() is an instance of jsoneditor (something different, which is encapsulated)

    // watch for changes
    // TODO: implement smart reload (i.e. only redraw, for example)
    SettingsEditor.watch('root', () => {
        infoBox.message("something changed!");
        console.log(Config);
        contextQueue.first().update();
    });

    return {
      /**
       * Starts the application.
       */
      start: function () {
        // create initial context with model
        let context =  new Context(DEFAULT_SERVER_ADDRESS, DEFAULT_MODEL).makeGUI();
        contextQueue.add(context);

        // activate that context
        activate(context, ['visualization', 'visPanel']);

        // fetch model
        context.model.update()
          .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas)) // on model change
          .then(() => initialQuerySetup(context.shelves)) // on initial startup only
          .catch((err) => {
            console.error(err);
            infoBox.message("Could not load remote model from Server!");
          });
      }
    };

  });
