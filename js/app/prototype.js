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

define(['lib/emitter', './init', './VisMEL', './VisMEL4Traces', './VisMELShelfDropping', './shelves', './interaction', './ShelfInteractionMixin', './ShelfGraphConnector', './visuals', './VisUtils', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './SettingsEditor', './ViewSettings', './ActivityLogger', './utils', 'd3', 'd3legend', './DependencyGraph', './FilterWidget', './PQL', './VisualizationRecommendation'],
  function (Emitter, init, VisMEL, V4T, drop, sh, inter, shInteract, ShelfGraphConnector, vis, VisUtils, UnRedo, QueryTable, ModelTable, RT, ViewTable, Remote, SettingsEditor, Settings, ActivityLogger, utils, d3, d3legend, GraphWidget, FilterWidget, PQL, VisRec) {
    'use strict';

    // the default model to be loaded on startup
    //const DEFAULT_MODEL = 'Auto_MPG';
    // const DEFAULT_MODEL = 'mcg_iris_map';
    const DEFAULT_MODEL = 'emp_titanic';

    // the default model server
    const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:5000';
    // const DEFAULT_SERVER_ADDRESS = 'http://lumen.inf-i2.uni-jena.de';

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
        drop(shelves.column, shelves.dim.at(0));
        drop(shelves.column, shelves.meas.at(1));
        drop(shelves.filter, shelves.dim.at(0));
    }

    // TODO: clean up. this is a quick hack for the paper only to rename the appearance.
    // but i guess cleanup requires deeper adaptions...
    const _facetNameMap = {
      'aggregations': 'prediction',
      'marginals': 'marginal',
      'contour': 'density',
      'data': 'data',
      'testData': 'test data',
      'predictionOffset': 'prediction offset',
    };
    const _facetNames = [...Object.keys(_facetNameMap)];

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

        // facet states and config
        let facets = JSON.parse(JSON.stringify(Settings.views));
        for (let facet of Object.keys(_facetNameMap)) {
          facets[facet].fetchState = 'not fetched'; // current fetching state of facet. One of ['not fetched', 'pending', 'fetched']
          facets[facet].data = undefined; // the last fetched data collection
        }
        this.facets = facets;
        // the stages of the pipeline in terms of queries
        this.query = {};
        this.baseQueryTable = {};
        this.baseModelTable = {};
        this.viewTable = {};

        this.boundNormalizedUpdate = _.debounce(this.update.bind(this), 150);
        this.unredoer = new UnRedo(20);

        Emitter(this);
        ActivityLogger.log({'context': this.getNameAndUUID()}, 'context.create');
      }

      /**
       * @param commit
       *
       * Note that this function accesses the file scope, as it uses the infoBox variable.
       */
      update (commit = true) {
        let c = this;

        CONTINUE_HERE_need_to_know_whether_more_than_just_facets_changed

        try {
          let mode = $('input[name=datavsmodel]:checked','#pl-datavsmodel-form').val();

          c.basemodel = c.model.localCopy();

          // get user query
          c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.basemodel, mode);
          c.query.rebase(c.basemodel);  // important! rebase on the model's copy to prevent modification of model

          // log this activity
          ActivityLogger.log({'VISMEL': c.query, 'facets': c._getFacetActiveState(), 'context': c.getNameAndUUID()}, 'vismel_query');

          // TODO: apply global filters and remove them from query. i.e. change basemodel, and basequery
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
          .then( () => c.updateFacetCollection('aggregations', RT.aggrCollection, fieldUsageCacheMap))
          .then( () => c.updateFacetCollection('data', RT.samplesCollection, fieldUsageCacheMap, {data_category:'training data', data_point_limit:Settings.tweaks.data_point_limit}))
          .then( () => c.updateFacetCollection('testData', RT.samplesCollection, fieldUsageCacheMap, {data_category:'test data', data_point_limit:Settings.tweaks.data_point_limit}))
          .then( () => c.updateFacetCollection('marginals', RT.uniDensityCollection, fieldUsageCacheMap)) // TODO: disable if one axis is empty and there is a quant dimension on the last field usage), i.e. emulate other meaning of marginal ?
          .then( () => c.updateFacetCollection('contour', RT.biDensityCollection, fieldUsageCacheMap))

          .then(() => {
            c.viewTable = new ViewTable(
              c.$visuals.visPane.get(0), c.$visuals.legendPane.get(0),
              c.facets.aggregations.data, c.facets.data.data, c.facets.testData.data, c.facets.marginals.data, c.facets.contour.data,
              c.baseQueryTable, c.facets);
            c.viewTable.on('PanZoom', (ev) => ActivityLogger.log({'context': c.getNameAndUUID(), 'changedAxis':ev}, 'PanZoom'));
          })

          .then(() => {
            // for development/debug
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


      updateFacetCollection (facetName, collectionFactory, fieldUsageCacheMap, opts=undefined) {
        if (opts === undefined)
          opts = {};
        let facet = this.facets[facetName];
        if (facet.active && facet.fetchState === 'not fetched')
          return collectionFactory(this.baseQueryTable, this.baseModelTable, fieldUsageCacheMap, facet.active, opts)
            .then(res => {
              facet.fetchedData = res;
              facet.data = res;
              facet.fetchState = 'fetched';
              return res;
            });
        else if (facet.active && facet.fetchState === 'fetched') {
          facet.data = facet.fetchedData;
          return Promise.resolve();
        }
        else {
          // result table of matching size is required
          //if (facet.data === undefined)
          facet.data = RT.getEmptyCollection(this.baseQueryTable.size, true);
          return Promise.resolve();
        }
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
        $('#pl-dashboard__container').append($visuals.visualization);
        $('#pl-facet-container').append($visuals.facets);
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

        this.boundNormalizedUpdate(false);
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
       * Returns the visualization facets according to the state of the GUI.
       */
      getFacetConfig () {
        return this.$visuals.facets
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

      /**
       * Disable or enable a facet.
       * @param facetName {String} Name of a facet.
       * @param enable {boolean} True to enable a facet, false to disable.
       */
      setFacet (facetName, enable=true) {
        if (!_facetNames.includes(facetName))
          throw RangeError("invalid facet name: " + facetName.toString());

        let facet = this.facets[facetName];

        if (!facet.possible || facet.active === enable)
          return;

        // note: disabling a facet will never invalidate the fetched result collection. this is only done when the query changes.
        facet.active = enable;
      }

      getQueryFromShelves () {
        // TODO: refetch all facets...
      }

      /**
       * Utility function for logging. Returns a dict of facet name and active-status, i.e. true if a facet is active and false if not.
       * @private
       */
      _getFacetActiveState () {
        let obj = {};
        _facetNames.map(
          facetName => obj[facetName] = this.facets[facetName].active);
        return obj;
      }

      static _makeVisualization(context) {
        let $paneDiv = $('<div class="pl-visualization__pane"></div>'),
          $removeButton = VisUtils.removeButton().click( context.remove.bind(context) ),
          $legendDiv = $('<div class="pl-legend"></div>');

        let $vis = $('<div class="pl-visualization pl-active-able"></div>')
          .append($paneDiv, $removeButton, $legendDiv)
          .mousedown( () => {
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
            handle: '.pl-visualization__pane',
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
        shelves.meas.beVisual({label: 'Quantitative'}).beInteractable().beRecommendable(shelves);
        shelves.dim.beVisual({label: 'Categorical'}).beInteractable().beRecommendable(shelves);
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

        visual.layout = $('<div class="pl-layout"></div>').append( shelves.column.$visual, $('<hr>'), shelves.row.$visual, $('<hr>'));

        // Enables user querying for shelves
        // shelves emit ChangedEvent. Now we bind to it.
        for (const key of Object.keys(shelves)) {
          shelves[key].on(Emitter.ChangedEvent, context.boundNormalizedUpdate);
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
        let title = $('<div class="pl-h2 shelf__title">Facets</div>');
        // create checkboxes
        let checkBoxes = ['contour', 'marginals', 'aggregations', 'data', 'testData', 'predictionOffset']
          .filter( what => context.facets[what].possible)
          .map(
          what => {
            // TODO PL: much room for optimization, as often we simply need to redraw what we already have ...
            let $checkBox = $('<input type="checkbox">')
              .prop({
                "checked": context.facets[what].active,
                "disabled": !context.facets[what].possible,
                "id": _facetNameMap[what]})
              .change( (e) => {
                // update the config and ...
                context.facets[what].active = e.target.checked;
                // log user activity
                ActivityLogger.log({'changedFacet': _facetNameMap[what], 'value': e.target.checked, 'facets': context._getFacetActiveState(), 'context': context.getNameAndUUID()}, "facet.change");
                // ... trigger an update
                context.boundNormalizedUpdate();
              });
            let $label = $(`<label class="pl-label pl-facet__label" for="${_facetNameMap[what]}">${_facetNameMap[what]}</label>`);
            return $('<div class="pl-facet__onOff"></div>').append($checkBox, $label);
          }
        );
        return $('<div class="pl-facet shelf vertical"></div>').append(
          //$('<hr>'),
          title,
          ...checkBoxes
        );
      }

      /**
       * Create and return GUI for shelves and models.
       *
       * Note: this is GUI stuff that is instantiated for each context. "Singleton" GUI elements
       * are not managed like this.
       */
      static _makeGUI(context) {
        let visual = Context._makeShelvesGUI(context);
        visual.facets = Context._makeFacetWidget(context);
        visual.visualization = Context._makeVisualization(context);
        visual.visPane = $('div.pl-visualization__pane', visual.visualization);
        visual.legendPane = $('div.pl-legend', visual.visualization);
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
        let $modelInput = $('<input class="pl-input" type="text" list="models"/>')
          .keydown( (event) => {
            if (event.keyCode === 13) {
              this._loadModel(event.target.value);
            }
          });

        this._$modelsDatalist = $('<datalist id="models"></datalist>');

        let $loadButton = $('<div class="pl-button pl-toolbar__button pl-model-selector__button">Go!</div>')
          .click(
            () => this._loadModel($modelInput.val())
          );

        this.$visual = $('<div class="pl-model-selector"></div>')
          .append($('<div class="pl-label pl-model-selector__label">Load Model:</div>'), $modelInput, this._$modelsDatalist, $loadButton);

        if(context !== undefined) {
          this.setContext(context);
        }
      }

      /**
       * Load model with name modelname.
       * @param modelName {String} Name of the model to load.
       * @private
       */
      _loadModel (modelName) {
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
        let $swapButton = $('<div class="pl-button"> Swap X and Y </div>').click( () => {
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
        this._$modelInfo = $('<div class="pl-text pl-details__body">'); // pl-details-model
        this._$queryInfo = $('<div class="pl-text pl-details__body">'); // pl-details-query
        this._$resultInfo = $('<div class="pl-text pl-details__body">'); // pl-details-result

        this.$visual = $('<div class>')
          .append('<div class="pl-h2 pl-details__heading">Model</div>')
          .append(this._$modelInfo)
          .append('<div class="pl-h2 pl-details__heading">Query</div>')
          .append(this._$queryInfo)
          .append('<div class="pl-h2 pl-details__heading">Result</div>')
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

      static
      _makeToolbarButton (iconName, label) {
        return VisUtils.button(label, iconName).addClass('pl-toolbar__button');
      }

      constructor (context) {
        let elems = [],
          config = Settings.toolbar;

        this._modelSelector = new ModelSelector(context);
        if (config.modelselector.active) {
          elems.push(this._modelSelector.$visual);
        }

        if (config.query.active) {
          let $query = Toolbar._makeToolbarButton("geo-position2", "Query")
            .click(() => this._context.boundNormalizedUpdate());
          elems.push($query);
        }

        if (config.clone.active) {
          let $clone = Toolbar._makeToolbarButton("clone", "Clone")
            .click(
            () => {
              let c = this._context;
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'clone');
              let contextCopy = c.copy();
              contextQueue.add(contextCopy);

              // fetch model
              contextCopy.model.update()
                .then(() => activate(contextCopy, ['visualization', 'visPane', 'legendPane']))
                .then(() => contextCopy.boundNormalizedUpdate())
                .catch((err) => {
                  console.error(err);
                  infoBox.message("Could not load remote model from Server!");
                  // TODO: remove vis and everything else ...
                });
            }
          );
          elems.push($clone);
        }

        if (config.undo.active) {
          let $undo = Toolbar._makeToolbarButton("undo", "Undo").click( () => {
            let c = this._context;
            if (c.unredoer.hasUndo) {
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'undo');
              c.loadShelves(c.unredoer.undo());
            }
            else
              infoBox.message("no undo left!");
          });
          elems.push($undo);
        }

        /*let $save = $('<div class="pl-button pl-toolbar__button"> Save </div>').click( () => {
         let c = this._context;
         c.unredoer.commit(c.copyShelves());
         });*/
        if (config.redo.active) {
          let $redo = Toolbar._makeToolbarButton("redo", "Redo").click(() => {
            let c = this._context;
            if (c.unredoer.hasRedo) {
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'redo');
              c.loadShelves(c.unredoer.redo());
            }
            else
              infoBox.message("no redo left!");
          });
          elems.push($redo);
        }

        if (config.clear.active) {
          let $clear = Toolbar._makeToolbarButton("clear", "Clear").click(
            () => {
              let c = this._context;
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'clear');
              c.clearShelves(['dim', 'meas']);
            });
          elems.push($clear);
        }

        if (config.details.active) {
          let $detailsHideButton = Toolbar._makeToolbarButton("details", "Details").click(() => {
            $('.pl-details').toggle()
          });
          elems.push($detailsHideButton);
        }

        if (config.graph.active) {
          let $graphButtons = $('<div class="pl-toolbar_multiButtonList"></div>');

          if (config.graph.graph.active) {
            let $graphManagerToggleButton = Toolbar._makeToolbarButton("graph", "Graph")
              .click(() => {
                let isVisible = $('.pl-layout-lower-left').css('display') !== 'none';
                // TODO: ugly as hell!
                $('.pl-layout-lower-left').toggle();
                if (isVisible) {
                  $('.pl-layout-upper-left ').css('height', '100%');
                } else {
                  $('.pl-layout-upper-left ').css('height', '67%');
                }
              });
            $graphButtons.append($graphManagerToggleButton);
          }

          if (config.graph.threshold.active) {
            let $thesholdHideButton = $('<div class="pl-button pl-toolbar__button">Threshold</div>')
              .click(() => $('.dg_slider-container').toggle());
            $graphButtons.append($thesholdHideButton);
          }

          elems.push($graphButtons);
        }

        if (config.config.active) {
          let $configHideButton = Toolbar._makeToolbarButton("config", "Config").click(() => {
            $('.pl-config').toggle()
          });
          elems.push($configHideButton);
        }

        if (config.reloadmodels.active) {
          let $reload = Toolbar._makeToolbarButton("update", "Sync Models").click(
            () => this._modelSelector.reloadModels());
          elems.push($reload);
        }

        this.$visual = $('<div class="pl-column pl-toolbar">').append(...elems);

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

        // hide if it's the current one
        if (context === this._context)
          this._get(context).$visual.hide();
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
          this._get(this._context).$visual.hide();

        // show new one
        let widget = this._get(context);
        widget.$visual.show();
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
       * @param context A context. The same context may or may not have been set before.
       */
      setContext(context) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");

        let widget = this._get(context),
          hasContext = this._contextSet.has(context),
          that = this;

        /* three possible cases:
         (1) this very context has been set before: then simply activate it
         (2) this very context has not been set before but a context of the same model (e.g. mcg_iris_map) has been set:
           then connect the new context's shelves to the widget and activate pl-graph-pane
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
        let $form = $('<form class="pl-likert__optionList"></form>');
        for (let i=0; i<stepNb; ++i) {
          // <input type="radio" value="${stepValues[i]}" name="plLikert" class="pl-likert__option" ${(i===0?"checked":"")}>
          $form.append(
            `<div>                 
                <input type="radio" value="${stepValues[i]}" id="${stepValues[i]}" name="plLikert" class="pl-likert__option" ${(i===0?"":"")}>
                <label for="${stepValues[i]}" class="pl-label">${stepLabels[i]}</label>
             </div>`)
        }
        let $legend = $(
          `<div class="pl-likert__scaleLabelContainer">
            <div class='pl-label pl-likert__scaleLabel'> ${labelLow} </div>
            <div class='pl-label pl-likert__scaleLabel'> ${labelHigh} </div>
           </div>`);

        let $visual = $('<div class="pl-likert"></div>')
          .append($(`<div class="pl-h2 pl-survey__title">${question}</div>`))
          .append($form)
          .append($legend);

        // define function to retrieve current value
        $visual.value = () => $('input[name=plLikert]:checked', $visual).val();

        return $visual;
      }

      /**
       * Creates and returns a widget that provides a input field for subject id, a text field to describe gained insight and a button to commit insight.
       *
       * the function onUserIdChanged is called when the user id changes.
       */
      static
      _makeUserIdWidget (onUserIdChanged) {

        // make input field for user id
        let $userIdInput = $('<input class="pl-input pl-survey__content pl-survey__userId" type="text" name="UserID" value="UNSET">');

        // listen to changes
        $userIdInput.change(()=>{
          onUserIdChanged($userIdInput.val());
        });

        // compose to whole widget
        return $('<div class="pl-survey__userid"></div>')
          .append('<div class="pl-h2 pl-survey__title">User Id</div>')
          .append($userIdInput);
      }


      static
      _makeInsightWidget (callback) {
        let $insightTextarea = $('<textarea class="pl-input pl-survey__content" name="insight">your insight here...</textarea>');
        let $likertScale = SurveyWidget._makeLikertScaleWidget(
          'not confident at all',
          'extremely confident',
          7,
          'Confidence that your insight is correct?');
        //let $likertScale = SurveyWidget._makeLikertScaleWidget('not confident at all', 'extremely confident', 7, 'How confident are you that your insight is correct?');
        let $commitButton = $('<div class="pl-button pl-survey__content">report & clear</div>')
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

        return $('<div class="pl-insight-report"></div>').append(
          '<div class="pl-h2 pl-survey__title">Report Insight</div>',
          $insightTextarea,
          $likertScale,
          $commitButton);
      }

      /**
       * @param onIdChange Callback for user id change.
       * @param onInsightReport Callback for reporting.
       */
      constructor (container, onIdChange, onInsightReport) {
        // this._$title = $('<div class="pl-h1 pl-column__title">User Study</div>');
        // this._$content = $('<div class="pl-column-content"></div>')
        //   .append([SurveyWidget._makeUserIdWidget(onIdChange),
        //     SurveyWidget._makeInsightWidget(onInsightReport)]);
        //
        //
        // this.$visual = $('<div id="pl-survey-container"></div>')
        //   .append(this._$title)
        //   .append(this._$content);

        $(container).append(
          SurveyWidget._makeUserIdWidget(onIdChange),
          SurveyWidget._makeInsightWidget(onInsightReport));
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
     * Make the given container pannable, i.e. by dragging the container its elements that match given cssFilter are moved accordingly.
     *
     * Note that all elements matching cssSelection must be positioned absolutely or fixed!
     *
     * @param container The container to make pannable.
     * @param cssSelector A CSS selector that matches the element to pane.
     */

    function makePannable(container, cssSelector) {
      const dataKey = '__pl-pannable.initialPos';
      let $c = $(container);

      let $draggedElements = undefined,
        initialMousePos = undefined,
        panning = false;

      $c.on('mousedown', (ev, foo, bar) => {          
          panning = (ev.target === ev.currentTarget);
          if (!panning)
            return;
          $draggedElements = $(cssSelector, $c);
          initialMousePos = [ev.pageX, ev.pageY];
          $draggedElements.each(
            (idx, elem) => {
              elem[dataKey] = $(elem).position(); //{top: +elem.style.top, left: +elem.style.left};              
            });
          return;
        })
        .on('mousemove', (ev) => {
          if (!panning)
            return;
          let deltaX = initialMousePos[0] - ev.pageX,
            deltaY = initialMousePos[1] - ev.pageY;
          $draggedElements.each( (idx, elem) => {
            let initialPos = elem[dataKey];
            elem.style.top = initialPos.top - deltaY + "px";
            elem.style.left = initialPos.left - deltaX + "px";
          });
        })
        .on('mouseup', (ev) => {
          panning = false;
        });
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
    toolbar.$visual.appendTo($('#pl-toolbar__container'));

    // create x-y swap button
    let swapper = new ShelfSwapper();
    swapper.$visual.appendTo($('#pl-layout-container'));

    // details view
    let detailsView = new DetailsView();
    detailsView.$visual.appendTo($('#pl-details-container'));

    // create survey widget
    if (Settings.userStudy.enabled) {
      let surveyWidget = new SurveyWidget(
        $('#pl-survey-container'),
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
      //surveyWidget.$visual.appendTo($('#pl-survey'));
    }

    // dependency graph widget
    let graphWidgetManager = new GraphWidgetManager(undefined, document.getElementById('pl-graph-container'));
    if (!Settings.graphWidget.enable) {
      $('.pl-layout-lower-left').hide();
      $('.pl-layout-upper-left').css('height', '95%');
    }

    // context queue
    let contextQueue = new ContextQueue();
    contextQueue.on("ContextQueueEmpty", () => {
      infoBox.message("Load a model to start!", "info")
    });

    // setup editor for settings
    SettingsEditor.setEditor(document.getElementById('pl-config-container'));
    // NOTE: SettingsEditor represents a singelton! The returned editor by setEditor() is an instance of jsoneditor (something different, which is encapsulated)

    // watch for changes
    // TODO: implement smart reload (i.e. only redraw, for example)
    SettingsEditor.watch('root', () => {
        contextQueue.first().boundNormalizedUpdate();
    });

    // make dash board pannable
    makePannable('#pl-dashboard__container', '.pl-visualization');

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
          })
          .then(() => activate(context, ['visualization', 'visPane', 'legendPane']))  // activate that context
          .then(() => initialQuerySetup(context.shelves)) // on initial startup only
          .catch((err) => {
            console.error(err);
            infoBox.message("Could not load remote model from Server!");
          });
      }
    };

  });
