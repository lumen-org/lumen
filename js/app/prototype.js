/**
 * Main component that assembles and manages the actual GUI of the PMV web client.
 *
 * Activity Logging:
 *   * userId: the subjects unique id (configured by its own GUI widget)
 *   *
 *
 *
 * @module main
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */

define(['lib/emitter', './init', './VisMEL', './VisMEL4Traces', './VisMELShelfDropping', './shelves', './interaction', './ShelfInteractionMixin', './ShelfGraphConnector', './visuals', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './SettingsEditor', './ViewSettings', './ActivityLogger', './utils', 'd3', 'd3legend', './DependencyGraph', './FilterWidget', './PQL'],
  function (Emitter, init, VisMEL, V4T, drop, sh, inter, shInteract, ShelfGraphConnector, vis, UnRedo, QueryTable, ModelTable, RT, ViewTable, Remote, SettingsEditor, Settings, ActivityLogger, utils, d3, d3legend, GraphWidget, FilterWidget, PQL) {
    'use strict';

    // the default model to be loaded on startup
    //const DEFAULT_MODEL = 'Auto_MPG';
    const DEFAULT_MODEL = 'mcg_iris_map';
    // const DEFAULT_MODEL = 'emp_titanic';

    // the default model server
    const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:5000';
    // const DEFAULT_SERVER_ADDRESS = 'http://lumen.inf-i2.uni-jena.de';

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
        drop(shelves.column, shelves.dim.at(0));
        drop(shelves.column, shelves.meas.at(1));
    }

    // TODO: clean up. this is a quick hack for the paper only to rename the appearance.
    // but i guess cleanup requires deeper adaptions...
    let _facetNameMap = {
      'aggregations': 'prediction',
      'marginals': 'marginal',
      'contour': 'density',
      'data': 'data',
      'testData': 'test data',
      'predictionOffset': 'prediction offset',
    };

    function _getFacetActiveState () {
      let obj = {};
      Object.keys(_facetNameMap).map(
        facetName => obj[_facetNameMap[facetName]] = Settings.views[facetName].active );
      return obj;
    }

    /**
     * monotone z-index generator. used to push activated contexts visually to the front.
     * Usage: zIndex = zIndexGenerator++;
     */
    let zIndexGenerator = 1;

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
        this.$visual.fadeOut(400);
      }

      show () {
        this.$visual.fadeIn(200);
      }

      message (str, type="warning", timeout=3500) {
        if (type !== "warning" && type !== "info")
          throw RangeError('Invalid message type: ' + type);
        let toAdd =  "pl-info-box_" + (type === "warning"?"warning":"information"),
          toRemove =  "pl-info-box_" + (type === "warning"?"information":"warning");
        this._$visual.text(str).addClass(toAdd).removeClass(toRemove);
        this.show();
        let that = this;
        setTimeout( () => {
            that.hide()
        }, 3500);
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
            try {
              let mode = $('input[name=datavsmodel]:checked','#pl-datavsmodel-form').val();

              c.basemodel = c.model.localCopy();

              // get user query
              c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.basemodel, mode);
              c.query.rebase(c.basemodel);  // important! rebase on the model's copy to prevent modification of model

              // log this activity
              ActivityLogger.log({'VISMEL': c.query, 'facets': _getFacetActiveState(), 'context': c.getNameAndUUID()}, 'vismel_query');

              // TODO: apply global filters and remove them from query
              // i.e. change basemodel, and basequery
              c.basequery = c.query;

              c.baseQueryTable = new QueryTable(c.basequery);
              c.baseModelTable = new ModelTable(c.baseQueryTable);
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

              .then(() => RT.samplesCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.data.active, {data_category:'training data', data_point_limit:Settings.tweaks.data_point_limit}))
              .then(res => c.dataRT = res)

              .then(() => RT.samplesCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.testData.active, {data_category:'test data', data_point_limit:Settings.tweaks.data_point_limit}))
              .then(res => c.testDataRT = res)

              .then(() => RT.uniDensityCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap,
                c.config.visConfig.marginals.active) //  || (TODO: if one axis is empty and there is a quant dimension on the last field usage), i.e. emulate other meaning of marginal.
              )
              .then(res => c.uniDensityRT = res)

              .then(() => RT.biDensityCollection(c.baseQueryTable, c.baseModelTable, fieldUsageCacheMap, c.config.visConfig.contour.active))
              .then(res => c.biDensityRT = res)

              .then(() => {
                  c.viewTable = new ViewTable(c.$visuals.visPane.get(0), c.$visuals.legendPane.get(0), c.aggrRT, c.dataRT, c.testDataRT, c.uniDensityRT, c.biDensityRT, c.baseQueryTable, c.config);
                  c.viewTable.on('PanZoom', (ev) => ActivityLogger.log({'context': c.getNameAndUUID(), 'changedAxis':ev}, 'PanZoom'));
              })

              .then(() => {
                // for development               
              })

              .then(() => {
                if (commit) {
                  // TODO: commit only if something changed!
                  c.unredoer.commit(c.copyShelves());
                }
              })
              .then(() => {
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
        this.uuid = utils.uuid();
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
            aggregations: { active: Settings.views.aggregations.active },
            data: { active: Settings.views.data.active, },
            testData: { active: Settings.views.testData.active, },
            marginals: { active: Settings.views.marginals.active },
            contour: { active: Settings.views.contour.active },
            predictionOffset: { active: Settings.views.predictionOffset.active},
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
        this.update = _.debounce(makeContextedUpdateFct(this), 150);
        this.unredoer = new UnRedo(20);

        // emitter mixin
        Emitter(this);

        ActivityLogger.log({'context': this.getNameAndUUID()}, 'context.create');
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
        ActivityLogger.log({'context': this.getNameAndUUID()}, 'context.close');
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
        let $newVis = Context._makeShelvesGUI(this);

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
        let shelvesCopy = {};
        for (const key of Object.keys(this.shelves))
          shelvesCopy[key] = this.shelves[key].copy();
        return shelvesCopy;
      }

      /**
       * Returns the visualization config according to the state of the GUI.
       */
      getVisConfig () {
        return this.$visuals.visConfig
      }

      /**
       * Returns am object with the name of the model and the universally unique ID, both of this context.
       * @returns {{name, uuid: *}}
       */
      getNameAndUUID () {
         return {'name': this.model.name, 'uuid': this.uuid};
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
        let $visCopy = copiedContext.$visuals.visualization,
          $vis = this.$visuals.visualization;
        $visCopy.css({
          width: $vis.css('width'),
          height: $vis.css('height'),
        });

        // position  
        let pos = $vis.position();
        pos.top += Settings.gui.clone_offset;
        pos.left += Settings.gui.clone_offset;
        $visCopy.css(pos);

        return copiedContext;
      }

      static _makeVisualization(context) {
        let $paneDiv = $('<div class="pl-visualization-pane"></div>');
        let $removeButton = $('<div class="pl-remove-button noselect pl-hidden"> x </div>');
        $removeButton.click( context.remove.bind(context) );
        let $legendDiv = $('<div class="pl-legend-pane"></div>');

        let $vis = $('<div class="pl-visualization"></div>')
          .append($paneDiv, $removeButton, $legendDiv)
          .click( () => {
            if (contextQueue.first().uuid !== context.uuid) {
              activate(context, ['visualization', 'visPane', 'legendPane']);
              ActivityLogger.log({'context': context.getNameAndUUID()}, 'context.activate');
            }
          })
          .resizable({
            ghost: true,
            helper: "pl-resizing",
            stop: (event, ui) => {
              let c = context;
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'resize');
              c.viewTable.onPaneResize(event);
            }
          });

        $vis.draggable(
          { stop:
              (event, ui) => ActivityLogger.log({'context': context.getNameAndUUID()}, 'move'),
            handle: '.pl-visualization-pane',
            drag: (ev, ui) => {
              // TODO: this is a rather dirty hack to prevent that the whole visualization widget is dragged when the user zooms using the plotly provided interaction.
              // this is a reported change of behaviour, according to here: https://community.plot.ly/t/click-and-drag-inside-jquery-sortable-div-change-in-1-34-0/8396
              if (ev.toElement.className === 'dragcover'){
                return false;
              }
            }
          }); // yeah, that was easy. just made it draggable!
        $vis.css( "position", "absolute" ); // we want absolute position, such they do not influence each others positions
        return $vis;
      }

      /**
       * Creates a visual, interactable representation of the shelves in the given context and returns this as an object with three attributes: models, mappings and  layout respectively. Each are a jQuery selection of the visual representation, respectively.
       * @param context
       * @private
       */
      static _makeShelvesGUI (context) {
        let shelves = context.shelves;

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

        let visual = {};

        // shelves visuals
        visual.models = $('<div class="pl-model"></div>').append(
          //shelves.modeldata.$visual, $('<hr>'),
          shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));

        visual.mappings = $('<div class="pl-mappings"></div>').append(
          shelves.filter.$visual, $('<hr>'), shelves.detail.$visual, $('<hr>'), shelves.color.$visual,
          $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, $('<hr>'));
        // HACK for paper
        // visual.mappings = $('<div class="pl-mappings"></div>').append(
        //  shelves.filter.$visual, $('<hr>'));

        visual.layout = $('<div class="pl-layout"></div>').append( shelves.column.$visual, $('<hr>'), shelves.row.$visual, $('<hr>'));

        // Enables user querying for shelves
        // shelves emit ChangedEvent. Now we bind to it.
        for (const key of Object.keys(shelves)) {
          shelves[key].on(Emitter.ChangedEvent, context.update);
          shelves[key].on(Emitter.ChangedEvent, event => {
             // heuristic to detect ChangedEvents that are not already covered with the Shelf.Event.* events below
             if (event && event.hasOwnProperty('type')) {
               let logEvent = Object.assign({'context': context.getNameAndUUID()}, event);
               delete logEvent.type;
               ActivityLogger.log(logEvent, event.type);
             }
          });
          shelves[key].on(sh.Shelf.Event.Add, record => ActivityLogger.log({shelf:record.shelf.type, what: record.content.toJSON(), 'context': context.getNameAndUUID()}, sh.Shelf.Event.Add) );
          shelves[key].on(sh.Shelf.Event.Remove, record => ActivityLogger.log({shelf:record.shelf.type, what: record.content.toJSON(), 'context': context.getNameAndUUID()}, sh.Shelf.Event.Remove) );
        }
        return visual;
      }

      /**
       * Creates and returns GUI to visible facets .
       *
       * An context update is triggered if the state of the config is changed.
       *
       * @param context
       * @private
       */
      static _makeFacetWidget (context) {
        let title = $('<div class="shelf-title">Facets</div>');
        // create checkboxes
        let checkBoxes = ['contour', 'marginals', 'aggregations', 'data', 'testData', 'predictionOffset']
          .map(
          what => {
            // TODO PL: much room for optimization, as often we simply need to redraw what we already have ...
            let $checkBox = $('<input type="checkbox">' + _facetNameMap[what] + '</input>')
              .prop("checked", context.config.visConfig[what].active)
              .prop("disabled", context.config.visConfig[what].possible)
              .change( (e) => {
                // update the config and ...
                context.config.visConfig[what].active = e.target.checked;

                // log user activity
                ActivityLogger.log({'changedFacet': _facetNameMap[what], 'value': e.target.checked, 'facets': _getFacetActiveState(), 'context': context.getNameAndUUID()}, "facet.change");

                // ... trigger an update
                context.update()
              });
            return $('<div class="pl-config-onoff"></div>').append($checkBox);
          }
        );
        let $visConfig = $('<div class="pl-config-visualization shelf vertical"></div>').append(
          //$('<hr>'),
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
        let visual = Context._makeShelvesGUI(context);
        visual.visConfig = Context._makeFacetWidget(context);
        visual.visualization = Context._makeVisualization(context);
        visual.visPane = $('div.pl-visualization-pane', visual.visualization);
        visual.legendPane = $('div.pl-legend-pane', visual.visualization);
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
            let modelName = event.target.value;
            if (event.keyCode === 13) {

              // create new context and visualization with that model if it exists
              let context = new Context(DEFAULT_SERVER_ADDRESS + Settings.meta.modelbase_subdomain, modelName).makeGUI();
              contextQueue.add(context);

              // fetch model
              context.model.update()
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Could not load remote model '" + modelName + "' from Server '" + context.server + "' !");
                  // TODO: remove vis and everything else ...
                })
                .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas))
                .then(() => activate(context, ['visualization', 'visPane', 'legendPane']))
                .then(() => infoBox.message("Drag'n'drop attributes onto the specification to create a visualization!", "info", 5000))
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Internal error: " + err.toString());
                })
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

      _setModels(models) {
        let $datalist = this._$modelsDatalist;
        $datalist.empty();
        for (let name of models) {
          // filter any names that begin with "__" since these are only 'internal' models
          if (!name.startsWith("__"))
            $datalist.append($("<option>").attr('value',name).text(name))
        }
      }

      /**
       * Refetch the available models on the server.
       */
      refetchModels() {
        this._context.modelbase.listModels().then( res => this._setModels(res.models) );
      }

      /**
       * Trigger a reloading of available models on the server side and then refetch the available models
       */
      reloadModels () {
        this._context.modelbase.reload().then( res => this._setModels(res.models) );
      }

      /**
       * Sets the context that the toolbar controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
        this.refetchModels();
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
          ActivityLogger.log({'context': this._context.getNameAndUUID()}, 'swap_x_y');
          sh.swap(shelves.row, shelves.column);
        });
        this.$visual = $('<div class="pl-swapper">').append($swapButton);
        this.$visual.hide(); // hide on default

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
        this._context.on("ContextDeletedEvent", (c) => {
          if (this._context.uuid === c.uuid)
            this.$visual.hide()
        });
        this.$visual.show();
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
        this._$modelInfo = $('<div>'); // pl-details-model
        this._$queryInfo = $('<div>'); // pl-details-query
        this._$resultInfo = $('<div>'); // pl-details-result

        this.$visual = $('<div class>')
          .append('<div class="pl-details-heading">Model</div>')
          .append(this._$modelInfo)
          .append('<div class="pl-details-heading">Query</div>')
          .append(this._$queryInfo)
          .append('<div class="pl-details-heading">Result</div>')
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
        this.$visual.show();
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
          .append('<div>Model name: ' + model.name + '</div>')
          .append('<div>Model class: " + to come</div>');
      }

      /**
       * Sets the context that it controls.
       * @param context A context.
       */
      setContext (context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
        this.update();
        // bind to events of this context
        this._context.on("ContextQueryFinishSuccessEvent", () => this.update());
        this._context.on("ContextDeletedEvent", c => {
          if (this._context.uuid === c.uuid)
            this.$visual.hide()
        });
      }
    }

    /**
     * A toolbar to control a context.
     * After instantiation its GUI is available under the .$visual attribute.
     */
    class Toolbar {

      constructor (context) {

        this._modelSelector = new ModelSelector(context);

        let $undo = $('<div class="pl-toolbar-button"> Undo </div>').click( () => {
          let c = this._context;
          if (c.unredoer.hasUndo) {
            ActivityLogger.log({'context': c.getNameAndUUID()}, 'undo');
            c.loadShelves(c.unredoer.undo());
          }
          else
            infoBox.message("no undo left!");
        });
        /*let $save = $('<div class="pl-toolbar-button"> Save </div>').click( () => {
         let c = this._context;
         c.unredoer.commit(c.copyShelves());
         });*/
        let $redo = $('<div class="pl-toolbar-button"> Redo </div>').click( () => {
          let c = this._context;
          if (c.unredoer.hasRedo) {
            ActivityLogger.log({'context': c.getNameAndUUID()}, 'redo');
            c.loadShelves(c.unredoer.redo());
          }
          else
            infoBox.message("no redo left!");
        });
        let $clear = $('<div class="pl-toolbar-button"> Clear </div>').click(
          () => {
            let c = this._context;
            ActivityLogger.log({'context': c.getNameAndUUID()}, 'clear');
            c.clearShelves(['dim','meas']);
          });
        let $clone = $('<div class="pl-toolbar-button"> Clone </div>').click(
          () => {
            let c = this._context;
            ActivityLogger.log({'context': c.getNameAndUUID()}, 'clone');
            let contextCopy = c.copy();
            contextQueue.add(contextCopy);

            // fetch model
            contextCopy.model.update()
              .then(() => activate(contextCopy, ['visualization', 'visPane', 'legendPane']))
              .then(() => contextCopy.update())
              .catch((err) => {
                console.error(err);
                infoBox.message("Could not load remote model from Server!");
                // TODO: remove vis and everything else ...
              });
          }
        );

        let $query = $('<div class="pl-toolbar-button">Query!</div>').click(
          () => this._context.update());

        let $reload = $('<div class="pl-toolbar-button">Reload Models</div>').click(
          () => this._modelSelector.reloadModels());

        let $configHideButton = $('<div class="pl-toolbar-button">Config</div>').click( () => {
          $('.pl-config').toggle()
        });

        let $detailsHideButton = $('<div class="pl-toolbar-button">Details</div>').click( () => {
          $('.pl-details').toggle()
        });

        let $graphManagerToggleButton = $('<div class="pl-toolbar-button">Graph</div>').click( () => {
          $('.pl-lower').toggle()
        });


        this.$visual = $('<div class="pl-toolbar">').append(this._modelSelector.$visual, $query, $clone, $undo,/* $save,*/ $redo, $clear, $detailsHideButton, $graphManagerToggleButton, $configHideButton, $reload);

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
     * A wrapper around a GraphWidget that manages GraphWidgets for contexts.
     *
     * It always shows the GraphWidget for the active Context, creates them transparently if a not-seen-before context is set and remember previously set contexts. It automatically removes GraphWidgets for destroyed contexts.
     *
     * Visual consistency across contexts:
     *
     * In order to get the identical layout of the graph across different contexts over the same model a GraphWidgetManager actually only keeps different graphs for different model names instead of for different context instances. Even if all contexts that belong to a particular GraphWidget are destructed, the GraphWidget is kept. This has the advantage that even if a user closes all contexts and then open a previously explored model the graph is restored.
     *
     * Internal notes:
     *
     * This applies a different design choice than for example the way visualizations of a context are managed. The reasons are:
     *   * the graph widget is optional, in contrast to the visualization or the specification panel
     *   * I've learned and now believe this would overall be the better strategy because it decouples functionality better
     *
     * This also applies a different design choice than used for the Toolbar, DetailsView etc. Because a GraphWidget creates state beyond what is already existent in a context, we need a construct to make that state persistent.
     */
    class GraphWidgetManager {

      constructor (context, domContainer) {
        this._context = context;
        this._context2widgetMap = new Map(); // map of context ('s hash value) to widgets. depends on _contextHash().
        this._contextSet = new Set();  // set of all contexts ever set. required to add event listeners appropriately
        this.$visual = $(domContainer);  // jQuery reference to its visual representation
        if(context !== undefined) {
          this.setContext(context);
        }
      }

      /**
       * Returns the chosen key for mapping a given context.
       * @param context
       * @returns {string}
       * @private
       */
      static _contextHash(context) {
        return context.model.name;
        // return context; // old
      }

      // just a short cut
      _get(context) {
        return this._context2widgetMap.get(GraphWidgetManager._contextHash(context))
      }

      // just a short cut
      _has(context) {
        return this._context2widgetMap.has(GraphWidgetManager._contextHash(context))
      }

      // just a short cut
      _set(context, value) {
        return this._context2widgetMap.set(GraphWidgetManager._contextHash(context), value);
      }

      _removeContext (context) {
        // remove from the set
        this._contextSet.delete(context);

        // hide it if it is the current one
        if (context === this._context)
          $(this._get(context).container()).hide();
      }

      /**
       * Activate the given context.
       *
       * @param context Context to activate, i.e. to be set as the context that the widget represent. The context must have been set using .setContext() beforehand.
       */
      activate(context) {
        if (!this._contextSet.has(context))
          throw RangeError("just must call setContext() before!");

        // hide current one
        if (this._context !== undefined)
          $(this._get(this._context).container()).hide();

        // show new one
        let widget = this._get(context);
        $(widget.container()).show();
        widget.redraw();
        this._context = context;
      }

      /**
       * Register a context at compatible widget.
       * @param widget
       * @param context
       * @private
       */
      _registerContext (widget, context) {
        ShelfGraphConnector.connect(widget, context.shelves);  // enable drag'n'drop between graph and shelves
        this._contextSet.add(context);
        // remove on context deletion
        let that = this;
        context.on("ContextDeletedEvent", context => that._removeContext(context));
      }

      /**
       * Sets the context that the toolbar controls.
       * @param context A context. It makes no difference whether the same context have been set before or not.
       */
      setContext(context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");

        let widget = this._get(context),
          hasContext = this._contextSet.has(context),
          that = this;

        /* three possible cases:
         (1) this very context has been set before: then simply activate it
         (2) this very context has not been set before, but a context of the same model (e.g. mcg_iris_map) has been set:
           then connect the new contexts shelves to the widget and activate the context
         (3) its entirely new in terms of context and the underlying model: then we need to fetch the graph of the model and then activate the context
         */
        let promise = new Promise((resolve, reject) => {
          if (widget === undefined && hasContext)
            throw RangeError("context has been added before! cannot overwrite!");
          else if (widget !== undefined && hasContext)
            resolve();
          else if (widget === undefined && !hasContext) {
            // need to retrieve graph
            return context.model.pciGraph_get().then(
              graph => {
                // create a new div to draw on
                let $vis = $('<div class=pl-graph-pane></div>').hide();
                this.$visual.append($vis);

                // make new graph widget
                widget = new GraphWidget($vis[0], graph);
                this._set(context, widget);

                // register the widget with the context
                this._registerContext(widget, context);

                // register to events of widget for logging user actions
                widget.on('Node.DragMoved', node => ActivityLogger.log({'context': context.getNameAndUUID(), 'dimension':node}, 'GraphWidget.Node.DragMoved'));
                widget.on('Node.Selected', node => ActivityLogger.log({'context': context.getNameAndUUID(), 'dimension':node}, 'GraphWidget.Node.Selected'));
                widget.on('Node.Unselected', node => ActivityLogger.log({'context': context.getNameAndUUID(), 'dimension':node}, 'GraphWidget.Node.Unselected'));

                resolve();
              });
            // need to add both
          } else if (widget !== undefined && !hasContext) {
            this._registerContext(widget, context);
            resolve();
          }
        }).then(
          () => that.activate(context)
        );
      }
    }

    /**
     * A widget for user studies. It allow a subject to report feedback.
     *
     * After instantiation its GUI is available under the .$visual attribute as a jQuery object
     */
    class SurveyWidget {

      static
      _makeLikertScaleWidget (labelLow, labelHigh, stepNb, question, stepLabels=[], stepValues=[]) {

        // generate labels and values, if not specified
        if (stepLabels.length === 0)
          if (stepValues.length === 0) {
            stepLabels = _.range(1, 1+stepNb);
            stepValues = _.range(1, 1+stepNb);
          } else
            stepLabels = stepValues;
        else if (stepValues.length === 0)
          stepValues = stepLabels;

        // create form with radio buttons as options and a legend below
        let $form = $('<form class="plLikert_optionsContainer"></form>');
        for (let i=0; i<stepNb; ++i) {
          // <input type="radio" value="${stepValues[i]}" name="plLikert" class="plLikert_option" ${(i===0?"checked":"")}>
          $form.append(
            `<div>                 
                <input type="radio" value="${stepValues[i]}" name="plLikert" class="plLikert_option" ${(i===0?"":"")}>
                <label>${stepLabels[i]}</label>
             </div>`)
        }
        let $legend = $(
          `<div class="plLikert_scaleDescriptionContainer">
            <div class='plLikert_description'> ${labelLow} </div>
            <div class='plLikert_description'> ${labelHigh} </div>
           </div>`);

        let $visual = $('<div class="plLikert_widgetContainer"></div>')
          .append($(`<div class="pl-survey-title">${question}</div>`))
          .append($form)
          .append($legend);

        // define function to retrieve current value
        $visual.value = () => $('input[name=plLikert]:checked', $visual).val();

        return $visual;
      }

      /**
       * Creates and returns a widget that provides a input field for subject id, a text field to describe gained insight and a button to commit insight.
       *
       * callback is called when the user id changes.
       */
      static
      _makeUserIdWidget (callback) {

        // make input field for user id
        let $userIdInput = $('<input class="pl-survey-content" type="text" name="UserID" value="UNSET">');

        // listen to changes
        $userIdInput.change(()=>{
          callback($userIdInput.val());
        });

        // compose to whole widget
        return $('<div></div>')
          .append('<div class="pl-survey-title">User Id</div>')
          .append($userIdInput);
      }


      static
      _makeInsightWidget (callback) {
        let $insightTextarea = $('<textarea class="pl-survey-content" name="insight">your insight here...</textarea>');
        let $likertScale = SurveyWidget._makeLikertScaleWidget('not confident at all', 'extremely confident', 7, 'How confident are you that your insight is correct?');
        let $commitButton = $('<div class="pl-toolbar-button pl-survey-content">report & clear</div>')
          .click( () => {
            let confidence = $likertScale.value();
            if (confidence === undefined) {
              infoBox.message('please specify how confident you are!');
            } else {
              callback($insightTextarea.val(), confidence);
              // reset state
              $insightTextarea.val("");
              $('input[type="radio"]', $likertScale).each(
                (i, elem) => {elem.checked = false}
              );
            }
          });

        return $('<div class="pl-insight-report-container"></div>').append(
          '<div class="pl-survey-title">Report Insight</div>',
          $insightTextarea,
          $likertScale,
          $commitButton);
      }

      /**
       * @param onIdChange Callback for user id change.
       * @param onInsightReport Callback for reporting.
       */
      constructor (onIdChange, onInsightReport) {
        this._$title = $('<div class="pl-column-title">User Study</div>');
        this._$content = $('<div class="pl-column-content"></div>')
          .append([SurveyWidget._makeUserIdWidget(onIdChange),
            SurveyWidget._makeInsightWidget(onInsightReport)]);


        this.$visual = $('<div id="pl-survey-container"></div>')
          .append(this._$title)
          .append(this._$content);
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
     *  Note that contexts are not automatically added to this this queue when instantiated, but need to be by calling .append().
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
        return this._first === undefined;
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
     * It hides the visuals of the current context, and show those of the new context. It also sets the new context
     * in those widgets that are singeltons and require a set context.
     *
     * Note: This is the single point of control over what to do when activating a new context!
     *
     * @param context Context to activate.
     */
    let activate = (function(){
      // don't get confused. In the end it returns a function. And that function has a closure to hold its private variable _currentContext. That's it.
      let _currentContext = {};

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

        // move it to the front
        _currentContext.$visuals.visualization.css("z-index",zIndexGenerator++);

        // set context in singelton widgets
        toolbar.setContext(context);
        swapper.setContext(context);
        detailsView.setContext(context);
        graphWidgetManager.setContext(context);

        // emit signal from the new context, that the new context is now active
        context.emit("ContextActivatedEvent", context);

        // emit signal from this activate function with new context as argument
        activate.emit("ContextChanged", context);
      }

      return _activate;
    })();
    Emitter(activate);

    // set the whole body as "remove element", i.e. dropping it anywhere there will remove the dragged element
    shInteract.asRemoveElem($(document.body).find('main'));

    // activity logger
    ActivityLogger.logPath(Settings.meta.activity_logging_filename);
    ActivityLogger.logServerUrl(DEFAULT_SERVER_ADDRESS + Settings.meta.activity_logging_subdomain);
    ActivityLogger.additionalFixedContent({'userId':'NOT_SET'});
    ActivityLogger.mode(Settings.meta.activity_logging_mode);

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

    // create survey widget
    if (Settings.userStudy.enabled) {
      let surveyWidget = new SurveyWidget(
        newID  => {
          infoBox.message("set user id to: " + newID.toString(), "info");
          ActivityLogger.log({'newUserId': newID}, 'userid.change');
          ActivityLogger.additionalFixedContent({'userId': newID});
        },
        (report, confidence) => {
          infoBox.message("reported insight: " + report.toString(), "info");
          ActivityLogger.log({'report': report, 'confidence': confidence}, 'insight');
        }
      );
      surveyWidget.$visual.appendTo($('#pl-survey-widget'));
    }

    // dependency graph widget
    let graphWidgetManager = new GraphWidgetManager(undefined, document.getElementById('pl-graph-manager-container'));
    if (!Settings.graphWidget.enable) {
      $('.pl-lower').hide();
      $('.pl-upper').css('height', '95%');
    }

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
        contextQueue.first().update();
    });

    return {
      /**
       * Starts the application.
       */
      start: function () {
        // create initial context with model
        let context = new Context(DEFAULT_SERVER_ADDRESS + Settings.meta.modelbase_subdomain, DEFAULT_MODEL).makeGUI();
        contextQueue.add(context);

        // fetch model
        context.model.update()
          .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas)) // on model change
          .then(() => {

            let getMarginalDistribution = function (model, dimNameOrField, mode='probability') {
               // given a model and a dimension name / field
              let field = PQL.isField(dimNameOrField) ? dimNameOrField : model.fields.get(dimName);

              // get a sampling of the marginal distribution over that field "using standard splits"
              // TODO: add all existing filters as conditions
              return model.predict([field.name, new PQL.Density(field, mode)], [], new PQL.Split(field, PQL.SplitMethod.equiinterval, 20) );
            };

            // DEBUG / DEVELOP
            let m = context.model;
            let f = m.byIndex[1];
            let p = Promise.resolve([[1,2,3,4,5,6],[1,2,3,4,3,2]]);
            // let w = new FilterWidget(f, () => p, $('#pl-playground'));
            let w = new FilterWidget(f, () => getMarginalDistribution(m, f), $('#pl-playground'));
          })
          .then(() => initialQuerySetup(context.shelves)) // on initial startup only
          .then(() => activate(context, ['visualization', 'visPane', 'legendPane']))  // activate that context
          .catch((err) => {
            console.error(err);
            infoBox.message("Could not load remote model from Server!");
          });

      }
    };

  });
