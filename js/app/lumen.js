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

define(['../run.conf', 'lib/logger', 'lib/emitter', './init', './InitialContexts', './VisMEL', './VisMEL4Traces', './VisMELShelfDropping', './VisMEL2Shelves', './shelves', './interaction', './ShelfInteractionMixin', './ShelfGraphConnector', './visuals', './VisUtils', './unredo', './QueryTable', './ModelTable', './ResultTable', './ViewTable', './RemoteModelling', './SettingsEditor', './ViewSettings', './ActivityLogger', './utils', './jsonUtils', 'd3', 'd3legend', './widgets/DependencyGraph', './ProbabilisticProgramGraph', './widgets/FilterWidget', './widgets/PosteriorPredictiveCheckWidget', './PQL', './VisualizationRecommendation', './ZIndexManager'],
  function (RunConf, Logger, Emitter, init, InitialContexts, VisMEL, V4T, drop, V2S, sh, inter, shInteract, ShelfGraphConnector, vis, VisUtils, UnRedo, QueryTable, ModelTable, RT, ViewTable, Remote, SettingsEditor, Settings, ActivityLogger, utils, jsonutils, d3, d3legend, GraphWidget, PPGraphWidget, FilterWidget, PPC, PQL,  VisRec, zIndex) {
    'use strict';

    var logger = Logger.get('pl-lumen-main');
    logger.setLevel(Logger.DEBUG);

    // activity logger
    ActivityLogger.logPath(Settings.meta.activity_logging_filename);
    ActivityLogger.logServerUrl(RunConf.DEFAULT_SERVER_ADDRESS + Settings.meta.activity_logging_subdomain);
    ActivityLogger.additionalFixedContent({'userId':'NOT_SET'});
    ActivityLogger.mode(Settings.meta.activity_logging_mode);

    /**
     * Utility function. Do some drag and drops to start with some non-empty VisMEL query
     */
    function initialQuerySetup(shelves) {
        drop(shelves.column, shelves.meas.at(0));
        drop(shelves.row, shelves.meas.at(1));
        drop(shelves.color, shelves.dim.at(1));
    }

    // TODO: clean up. this is a quick hack for the paper only to rename the appearance.
    // but i guess cleanup requires deeper adaptions...

    // careful: you cannot just change the _keys_! they are reused in multiple places!
    const _facetNameMap = {
      'aggregations': 'global prediction',
      'data aggregations': 'data aggregations',
      'predictionDataLocal': 'data-local prediction',
      'marginals': 'model marginals',
      'dataMarginals': 'data marginals',
      'contour': 'model density',
      'data density': 'data density',
      'model samples': 'model samples',
      'data': 'training data',
      'testData': 'test data',
//      'predictionOffset': 'prediction offset',
    };
    const _facetNames = [...Object.keys(_facetNameMap)];

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
        this._$visual.css("z-index", zIndex.current()+1);
        this.show();
        let that = this;
        setTimeout( () => {
            that.hide()
        }, timeout);
      }

      get $visual () {
        return this._$visual;
      }
    }

    class AlertBox {
      constructor(id, context) {
        this.id = id;
        this.context = context;
        this._$visual = $('<div class="pl-model-alert-box-background" id="' + id + '">' +
            '<div class="pl-model-alert-box-content">' +
            '<div class="pl-model-alert-box-header">' +
            '<span class="pl-model-alert-box-header-title">Models found:</span>' +
            '<span class="pl-model-alert-box-header-close">\u00D7</span>' +
            '</div>' +
            '<ul class="pl-model-alert-box-models"></ul>' +
            '</div></div>');
        // let alert_box_models = $(".pl-model-alert-box-models");
        let that = this;
        this._$visual.on('click.pl-model-alert-box-background', function (event) {
          console.log($(event.target));
          if ($(event.target).hasClass("pl-model-alert-box-background") || $(event.target).hasClass("pl-model-alert-box-header-close")) {
            that._$visual.fadeOut(100);
          }
          if ($(event.target).hasClass("pl-model-alert-box-models-li")) {
            that.context._loadModel($(event.target).text());
            that._$visual.fadeOut(100);
          }
        });

      }

      show() {
        this.$visual.fadeIn(100);
      }

      message(name_list) {
        let alertBoxList = $(".pl-model-alert-box-models");
        if (alertBox.$visual.is(":hidden"))
          alertBoxList.empty();
        for (let name_l of name_list.sort())
          alertBoxList.append("<li class='pl-model-alert-box-models-li'>" + name_l + "</li>");
        let alertBoxHeaderTitle = $(".pl-model-alert-box-header-title");
        if (alertBoxList.children().length === 1) {
          alertBoxHeaderTitle.text("Model found:")
        } else {
          alertBoxHeaderTitle.text("Models found:")
        }
        this._$visual.css("z-index", zIndex.current()+1);
        this.show();
      }

      get $visual() {
        return this._$visual;
      }
    }


    class Context {
      /**
       * Creates a new context. If no parameters are given, the context is empty.
       * However, you can also specify the server, or the server and the modelName,
       * or the server, the model name and existing shelves for these.
       *
       * Note that the context is not immediately visual when instantiated. Call this.makeGUI for that.
       *
       * Contexts emit signals as follows:
       *
       *   * "ContextDeletedEvent" if it is deconstructed / deleted.
       *   * "ContextQueryFinishSuccessEvent": iff the context successfully finished its update cycle.
       *
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

        // empirical model
        // TODO: make model configurable
        this.emp_model = undefined;

        // shelves configuration
        if (modelName !== undefined && server !== undefined && shelves !== undefined)
          this.shelves = shelves;
        else
          this.shelves = sh.construct();

        // facet states and config
        this.facets = utils.getFacetsFlags(Settings.views);
        this._discardFetchedFacets();

        // other per spec config
        this.config = {
          data: {
            marginalResolution: 20,
            densityResolution: 35,
            kdeBandwidth: 1,
            empBinWidth: 1,
          },
          model: {
            marginalResolution: 100,
            densityResolution: 50,
            kdeBandwidth: 1,
            empBinWidth: 1,
          }
        }

        // the stages of the pipeline in terms of queries
        this.query = {};  // vismel query
        this.baseQueryTable = {};
        this.baseModelTable = {};
        this.viewTable = {};

        this._changes = { // keeps track what of the context changed
          'all': false,
          'shelves.changed': false, // triggers complete requiring, i.e. is currently identical to 'all'
          'facets.changed': false, // triggers fetching of required facets
          'config.changed': false, // triggers a redraw only
        };
        this._commitFlag = false;
        this._resetChanges();

        this._boundNormalizedUpdate = _.debounce(this._update.bind(this), 150);
        this.unredoer = new UnRedo(20);

        Emitter(this);
        ActivityLogger.log({'context': this.getNameAndUUID()}, 'context.create');
      }

      /**
       * @private
       */
      _resetChanges () {
        for (let key of Object.keys(this._changes))
          this._changes[key] = false;
        this._commitFlag = false;
      }

      _discardFetchedFacets (what='all') {
        let facets = this.facets;
        if (what === 'all')
          what = Object.keys(facets)                
        
        for (let facet of _facetNames) {
          facets[facet].fetchState = 'not fetched'; // current fetching state of facet. One of ['not fetched', 'fetched']
          facets[facet].data = undefined; // the last fetched data collection
        }
      }

      /**
       * Update this context with respect to `what` at the next possible time.
       *
       * @param what {String} Any of ['all', 'shelves.change', 'facet.change', 'config.change']
       * @param commit {boolean}
       *
       */
      update (what='all', commit = true) {
        let changes = this._changes,
          keys = Object.keys(changes);
        if (!keys.includes(what))
          throw RangeError("invalid 'what': " + what.toString());
        changes[what] = true;
        if (what === 'all')
          for (let key of keys)
            changes[key] = true;
        this._commitFlag = this._commitFlag || commit;
        this._boundNormalizedUpdate();
      }

      _updateModels () {
        let that = this;
        return that.model.update()
            .then(() => {
                that.emp_model = new Remote.Model(that.model.empirical_model_name, that.server);  
                // enable auto-creation for empirical models
                let optsAutoCreate = {
                  AUTO_CREATE_MODEL: {
                    // MODEL_TYPE: "empirical", // "kde" or empirical"
                    FOR_MODEL: that.model.name,
                  }
                };                
                // set and update empirical model                
                return that.emp_model.update(optsAutoCreate)
            });
      }

      /**
       * Sets a visual indicator to show how the context is busy, if it is.
       * @param status Status to indicate. Pass `false` to indicate that the context is not busy, or a string to indicate with what it is busy.
       * @private
       */
      _setBusyStatus (status = false) {
        if (!status) {
          this._busyIndicator.stop().fadeOut(150);
        } else {
          $('.pl-label', this._busyIndicator).text(status);
          this._busyIndicator.stop().fadeIn(150);
        }
      }

      /**
       * Update this context with respect to all due changes. Due changes are stored in this._changes. An update is committed, if any of the calls to `update` has a truthy commit flag.
       *
       * Note that this function accesses the file scope, as it uses the infoBox variable.
       * @private
       */
      _update () {
        let c = this,
          changes = this._changes;

        // derive actions from changes
        let actions = {};
        actions['new.query'] = changes['shelves.changed'];
        actions['update.facets'] = (actions['new.query'] || changes['facets.changed']);
        actions['redraw'] = (actions['update.facets'] || changes['config.changed']);
        actions['finalize'] = true;
        c._resetChanges();

        // stages are promises to the completion of actions
        let stages = {};

        if (actions['new.query']) {
          c._setBusyStatus('getting base query');
          try {
            c.basemodel = c.model.localCopy();
            c.emp_basemodel = c.emp_model.localCopy();

            // get user query
            c.query = VisMEL.VisMEL.FromShelves(c.shelves, c.basemodel);
            c.query.rebase(c.basemodel);  // important! rebase on the model's copy to prevent modification of model

            // get query on empirical model
            // instead of the next line: c.emp_query = c.query.shallowCopy(); ?
            c.emp_query = VisMEL.VisMEL.FromShelves(c.shelves, c.emp_basemodel);
            c.emp_query.rebase(c.basemodel);  // important! rebase on the model's copy to prevent modification of model

            // log this activity
            ActivityLogger.log({
              'VISMEL': c.query,
              'facets': c._getFacetActiveState(),
              'context': c.getNameAndUUID()
            }, 'vismel_query');

            // TODO: apply global filters and remove them from query. i.e. change basemodel, and basequery
            c.basequery = c.query;
            c.emp_basequery = c.emp_query;

            c.baseQueryTable = new QueryTable(c.basequery);
            c.baseModelTable = new ModelTable(c.baseQueryTable);
            c.predictionDataLocal_baseModelTable = new ModelTable(c.baseQueryTable);  // may reuse c.baseQueryTable!

            c.emp_baseQueryTable = new QueryTable(c.emp_basequery);
            c.emp_baseModelTable = new ModelTable(c.emp_baseQueryTable);
          }
          catch (err) {
            console.error(err);
            connection_errorhandling(err);
          }

          // reset field cache and fetched
          c._fieldUsageCacheMap = new Map();
          c._discardFetchedFacets();

          // get promise to base models
          stages['new_query'] = Promise.all([
            c.baseModelTable.model(),
            c.emp_baseModelTable.model('dataMarginals'),
            c.predictionDataLocal_baseModelTable.model('predictionDataLocal')]);
        } else {
          stages['new_query'] = Promise.resolve(); // because it is already there
        }

        if (actions['update.facets']) {
          // used to replace value-identical FieldUsages and BaseMaps of vismel queries with reference-identical ones
          // this is crucial to link corresponding axis and results in the visualization
          // (TODO: in fact, we could even use this to link them across multiple visualizations, maybe!?)
          let fieldUsageCacheMap = c._fieldUsageCacheMap;
          stages['update.facets'] = stages['new_query']
            .then(() => c._setBusyStatus('fetching facets'))
            .then(() => infoBox.hide())
            .then(() => {
              let confData = c.config.data,
                confModel = c.config.model;
              return Promise.all([
                // query all facets in parallel
                c.updateFacetCollection('aggregations', RT.aggrCollection, fieldUsageCacheMap),
                c.updateFacetCollection('data aggregations', RT.aggrCollection, fieldUsageCacheMap,
                    c.emp_baseQueryTable, c.emp_baseModelTable,{'model': 'empirical'}),
                c.updateFacetCollection('data', RT.samplesCollection, fieldUsageCacheMap, undefined, undefined,{
                  data_category: 'training data',
                  data_point_limit: Settings.tweaks.data_point_limit
                }),
                c.updateFacetCollection('testData', RT.samplesCollection, fieldUsageCacheMap, undefined, undefined,{
                  data_category: 'test data',
                  data_point_limit: Settings.tweaks.data_point_limit
                }),
                c.updateFacetCollection('model samples', RT.samplesCollection, fieldUsageCacheMap, undefined, undefined,{
                  data_category: 'model samples',
                  number_of_samples: Settings.tweaks['number of samples'],
                  data_point_limit: Settings.tweaks.data_point_limit
                }),
                // TODO: disable if one axis is empty and there is a quant dimension on the last field usage)
                // i.e. emulate other meaning of marginal ?
                c.updateFacetCollection('marginals', RT.uniDensityCollection, fieldUsageCacheMap, undefined, undefined, 
                    {'resolution': confModel.marginalResolution,                  
                    'empBinWidth': confModel.empBinWidth,
                    'kdeBandwidth': confModel.kdeBandwidth}), 
                c.updateFacetCollection('dataMarginals', RT.uniDensityCollection, fieldUsageCacheMap, c.emp_baseQueryTable, c.emp_baseModelTable, 
                    {'model': 'empirical', 
                     'resolution': confData.marginalResolution,
                     'empBinWidth': confData.empBinWidth,
                     'kdeBandwidth': confData.kdeBandwidth}),
                c.updateFacetCollection('contour', RT.biDensityCollection, fieldUsageCacheMap, undefined, undefined, 
                    {'resolution': confModel.densityResolution,
                    'empBinWidth': confModel.empBinWidth,
                    'kdeBandwidth': confModel.kdeBandwidth}), 
                c.updateFacetCollection('data density', RT.biDensityCollection, fieldUsageCacheMap,
                    c.emp_baseQueryTable, c.emp_baseModelTable, 
                    {'model': 'empirical',
                     'resolution': confData.densityResolution,
                     'empBinWidth': confData.empBinWidth,
                     'kdeBandwidth': confData.kdeBandwidth}), 
                c.updateFacetCollection('predictionDataLocal', RT.predictionDataLocalCollection, fieldUsageCacheMap,
                    undefined, c.predictionDataLocal_baseModelTable, Settings.tweaks['data local prediction']),
              ]);
            })
        } else {
          stages['update.facets'] = Promise.resolve();
        }

        if (actions['redraw']) {
          stages['redraw'] = stages['update.facets']
            .then(() => c._setBusyStatus('redrawing'))
            .then(() => {
              c.viewTable = new ViewTable( c.$visuals.visPane.get(0), c.$visuals.legendPane.get(0), c.baseQueryTable, c.facets);
              c.viewTable.on('PanZoom', (ev) => ActivityLogger.log({'context': c.getNameAndUUID(), 'changedAxis':ev}, 'PanZoom'));
            });
        } else {
          stages['redraw'] = Promise.resolve();
        }

        if (actions['finalize']) {
          stages['redraw']
            //.then(() => c._setBusyStatus('finalizing'))
            .then(() => {
            // for development/debug
          })
          .then(() => {
            if (c._commitFlag) {
              // TODO: commit only if something changed!
              c.unredoer.commit(c.copyShelves());
            }
          })
          .then(() => {
            console.log(c);
          })
          .then(() => {
            c._setBusyStatus();
            c.emit("ContextQueryFinishSuccessEvent", c);
          })
          .catch((err) => {
            console.error(err);
            connection_errorhandling(err)
            if (err instanceof Error) {
              infoBox.message(err.toString());
            }
          });
        } else {
          throw "cannot skip final stage of query processing";
        }

      }

      updateFacetCollection (facetName, collectionFactory, fieldUsageCacheMap, baseQueryTable=undefined,
                             baseModelTable=undefined, opts=undefined) {
        if (opts === undefined)
          opts = {};
        if (baseQueryTable === undefined)
          baseQueryTable = this.baseQueryTable;
        if (baseModelTable === undefined)
          baseModelTable = this.baseModelTable;

        let facet = this.facets[facetName];
        if (facet.active && facet.fetchState === 'not fetched')
          return collectionFactory(baseQueryTable, baseModelTable, fieldUsageCacheMap, facetName, facet.active, opts)
            .then(res => {
              facet.fetchedData = res;
              facet.data = res;
              facet.fetchState = 'fetched';
              logger.debug(`fetched facet: ${facetName}`);
              return Promise.resolve()
            });
        else if (facet.active && facet.fetchState === 'fetched') {
          facet.data = facet.fetchedData;
          return Promise.resolve();
        }
        else {
          // result table of matching size is required
          facet.data = RT.getEmptyCollection(baseQueryTable.size, true);
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
        //$('#pl-facet-container').append($visuals.facets);
        $('#pl-facet-container').append($visuals.facets2);
        $('#pl-specConfig-container').append($visuals.config);
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
       * Loads a new configuration of shelves in this context. Note that the shelves must match the model. The shelves
       * replace the currently set shelves, and are also set as made visual and interactive.
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

        this.update('all', false);
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
       * Returns the root DOM element of the facets GUI.
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

        copiedContext.facets = JSON.parse(JSON.stringify(this.facets));
        // TODO: facet data is copied but functions etc are missing. Hence i actually cannot reuse it ...
        //  I'd need a copy constructor for the facet collections object.
        // TODO: also need copy value of this._changes and this._commitFlag

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

      visualizationPosition (position=undefined) {
        let $vis = this.$visuals.visualization;
        if (position === undefined)
            return $vis.position();
        else 
            $vis.css(position);            
      }

      visualizationSize(size=undefined) {
        let $vis = this.$visuals.visualization;
        if (size === undefined)
            return {
              width: $vis.css('width'),
              height: $vis.css('height'),
            };
        else 
            $vis.css(size);
      }

      toJSON () {
        return {
          position: this.visualizationPosition(),
          size: this.visualizationSize(),
          facets: utils.getFacetsFlags(this.facets),
          vismel: this.query.toJSON()
        };
      }

      /**
       * Returns a promise to a Context made from a suitable JSON object.
       * @param jsonObj
       * @constructor
       */
      static
      FromJSON (jsonObj) {
        return VisMEL.VisMEL.FromJSON(jsonObj.vismel).then( vismel => {
          let model = vismel.getModel(),
              shelves = vismel.toShelves(),
              context = new Context(model.url, model.name, shelves);

          context.model = model;
          context.query = vismel;
          // TODO: see restriction above in Context.copy()
          context.facets = JSON.parse(JSON.stringify(jsonObj.facets));
          context.makeGUI();
          context.visualizationPosition(jsonObj.position);
          context.visualizationSize(jsonObj.size);
          return context;
        });
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
            context.$visuals.visualization.css("z-index",zIndex.inc());
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

        $vis.__is_dragging = false;
        $vis.draggable(
          { stop:
              (event, ui) => {
                  ActivityLogger.log({'context': context.getNameAndUUID()}, 'move');
              },
            handle: '.pl-visualization__pane',
            start: (ev, ui) => {
                $vis.__is_dragging = true;
            },
    
            drag: (ev, ui) => {
              // TODO: this is a rather dirty hack to prevent that the whole visualization widget is dragged when the user zooms using the plotly provided interaction.
              // this is a reported change of behaviour, according to here: https://community.plot.ly/t/click-and-drag-inside-jquery-sortable-div-change-in-1-34-0/8396
              if (ev.toElement && ev.toElement.className === 'dragcover') {
                  return false;
              }
              // this probably works for all browsers. It relies on plotly to have a foreground drag layer that receives the event and that has a class name that includes 'drag'
              // only apply on the very first drag, because we only want to cancel the drag if it originally started on the plotly canvas, but not if it moves onto it 
              else if (ev.originalEvent.target.getAttribute('class').includes('drag') && $vis.__is_dragging) {
                  return false;
              } 
              $vis.__is_dragging = false;
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
        shelves.meas.beVisual({label: 'Quantitative'}).beInteractable().beRecommendable(shelves);
        shelves.meas.$visual.addClass('pl-shelf-quantitative');
        shelves.dim.beVisual({label: 'Categorical'}).beInteractable().beRecommendable(shelves);
        shelves.dim.$visual.addClass('pl-shelf-categorical');
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
          shelves.meas.$visual, $('<hr>'), shelves.dim.$visual, $('<hr>'), shelves.remove.$visual, $('<hr>'));

        visual.mappings = $('<div class="pl-mappings"></div>').append(
          shelves.filter.$visual, $('<hr>'), /*  PL: SIGMOD: comment next 2(!) items */ shelves.detail.$visual, $('<hr>'),  shelves.color.$visual,
          $('<hr>'), shelves.shape.$visual, $('<hr>'), shelves.size.$visual, $('<hr>'));

        visual.layout = $('<div class="pl-layout"></div>').append( shelves.column.$visual, $('<hr>'), shelves.row.$visual, $('<hr>'));

        // Enables user querying for shelves
        // shelves emit ChangedEvent. Now we bind to it.
        for (const key of Object.keys(shelves)) {
          shelves[key].on(Emitter.ChangedEvent,
            () => context.update('shelves.changed'));
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
       * Creates and returns GUI for the config of a context.
       * @param {Context} context 
       * @private
       */
      static _makeConfigWidget (context) {
        let title = $('<div class="pl-h2 shelf__title">Config</div>'),
          config = context.config;

        let makeRowLabel = (labelName) => $(`<div class="pl-label pl-specConfig__label">${labelName}</div>`),
          makeSectionHeader = (labelName) => $(`<div class="pl-label pl-specConfig__sectionHeader">${labelName}</div>`),
          makeColumnLabel = (labelName) => $(`<div class="pl-label pl-specConfig__label pl-specConfig__columnLabel">${labelName}</div>`),
          makeRowForFirstColumn = (...elems) => $(`<div class="pl-specConfig__rowLabel pl-label"></div>`).append(...elems);
        /**
         * Create a cell of the config grid for a numerical config value.
         * @param {*} type String. One of 'model' or 'data'. This is the top level key for the Context config dict.
         * @param {*} what String. This is the second level key for the Context config dict.
         * @param {*} facetNames A list of facet names of facets that have to be recomputed when the config value changed.
         */
        function makeCell (type, what, facetNames) { 
            return $(`<input class="pl-specConfig__input" type="number" min="1" value="${config[type][what]}">`)
            .change( (e) => {
              config[type][what] = +e.target.value;
              // invalidate facet results / cache
              context._discardFetchedFacets(facetNames);
              // TODO: ActivityLogger.log({'changedFacet': _facetNameMap[what], 'value': e.target.checked, 'facets': context._getFacetActiveState(), 'context': context.getNameAndUUID()}, "facet.change");                
            })
            .on('keyup', (e) => {
              if (e.key === "Enter") {
                  context.update('facets.changed');
              }
            });
          }

        let items4firstColumn = [
          makeRowForFirstColumn(makeSectionHeader("Resolution"), $('<div></div>')),
          makeRowForFirstColumn(VisUtils.icon(Context._name2iconMap['marginals']), makeRowLabel('marginals')),
          makeRowForFirstColumn(VisUtils.icon(Context._name2iconMap['contour']), makeRowLabel('density')),
          makeRowForFirstColumn(makeSectionHeader("Precision"), $('<div></div>')),
          makeRowForFirstColumn($('<div></div>'), makeRowLabel('KDE Var')),
          makeRowForFirstColumn($('<div></div>'), makeRowLabel('Bin Width')),
        ];

        let items = [
          items4firstColumn[0], makeColumnLabel('model'),  makeColumnLabel('data'),
          items4firstColumn[1], makeCell('model', 'marginalResolution', ['marginals']), makeCell('data', 'marginalResolution', ['dataMarginals']),
          items4firstColumn[2], makeCell('model', 'densityResolution', ['contour']), makeCell('data', 'densityResolution', ['data density']),
          items4firstColumn[3], $('<div></div>'), $('<div></div>'),
          items4firstColumn[4], makeCell('model', 'kdeBandwidth', ['marginals', 'contour']), makeCell('data', 'kdeBandwidth', ['dataMarginals', 'data density']),
          items4firstColumn[5], makeCell('model', 'empBinWidth', ['marginals', 'contour']), makeCell('data', 'empBinWidth', ['dataMarginals', 'data density']),
        ];

        let shelfContainer = $('<div class="pl-specConfigWidget__container"></div>')
          .append(...items);
        return $('<div class="pl-specConfig shelf vertical"></div>')
          .append($('<hr>'), title, shelfContainer);
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
        let checkBoxes = //['contour', 'marginals', 'aggregations', 'data', 'testData'] //, 'predictionOffset']
          Object.keys(context.facets)
          .filter( what => context.facets[what].possible)
          .map(
            (what, idx) => {
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
                  context.update('facets.changed');
                });
              let $icon = VisUtils.icon(Context._name2iconMap[what]);
              let $label = $(`<label class="pl-label pl-facet__label" for="${_facetNameMap[what]}">${_facetNameMap[what]}</label>`);
              return $('<div class="pl-facet__onOff"></div>').append($icon, $label, $checkBox);
            }
          );
        return $('<div class="pl-facet shelf vertical"></div>').append(
          //$('<hr>'),
          title,
          ...checkBoxes
        );
      }

      /**
       * Creates and returns GUI to visible facets .
       *
       * An context update is triggered if the state of the config is changed.
       *
       * @param context
       * @private
       */
      static _makeFacetWidget2 (context) {
        let title = $('<div class="pl-h2 shelf__title">Facets</div>');
        // create checkboxes
        let makeCheckbox = (what) => {
          let $checkBox = $('<input class="pl-facet__checkbox" type="checkbox">')
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
                context.update('facets.changed');
              });
          return $checkBox;
        };

        let makeRowLabel = (labelName) => $(`<div class="pl-label pl-facet__label">${labelName}</div>`),
          makeColumnLabel = (labelName) => $(`<div class="pl-label pl-facet__label pl-facet__columnLabel">${labelName}</div>`);

        let items4firstColumn = [
          $(`<div class="pl-facet__rowLabel pl-label"><div></div><div></div></div>`),
          $(`<div class="pl-facet__rowLabel pl-label"></div>`).append(VisUtils.icon(Context._name2iconMap['aggregations']), makeRowLabel('aggregation')),
          $(`<div class="pl-facet__rowLabel pl-label"></div>`).append(VisUtils.icon(Context._name2iconMap['data']), makeRowLabel('data points')),
          $(`<div class="pl-facet__rowLabel pl-label"></div>`).append(VisUtils.icon(Context._name2iconMap['marginals']), makeRowLabel('marginals')),
          $(`<div class="pl-facet__rowLabel pl-label"></div>`).append(VisUtils.icon(Context._name2iconMap['contour']), makeRowLabel('density')),
        ];

        let items = [
          items4firstColumn[0], makeColumnLabel('model'),  makeColumnLabel('data'),
          items4firstColumn[1], makeCheckbox('aggregations'), makeCheckbox('data aggregations'),
          items4firstColumn[2], makeCheckbox('model samples'), makeCheckbox('data'),
          items4firstColumn[3], makeCheckbox('marginals'), makeCheckbox('dataMarginals'),
          items4firstColumn[4], makeCheckbox('contour'), makeCheckbox('data density'),
        ];

        let shelfContainer = $('<div class="pl-facetWidget__container"></div>').append(...items);
        return $('<div class="pl-facet shelf vertical"></div>').append(title, shelfContainer);
      }

      /**
       * Create and return GUI for shelves and models.
       *
       * Note: this is GUI stuff that is instantiated for each context. "Singleton" GUI elements
       * are not managed like this.
       */
      static _makeVisuals(context) {
        let visuals = Context._makeShelvesGUI(context);
        //visuals.facets = Context._makeFacetWidget(context);
        visuals.facets2 = Context._makeFacetWidget2(context);
        visuals.config = Context._makeConfigWidget(context);
        visuals.visualization = Context._makeVisualization(context);
        visuals.visPane = $('div.pl-visualization__pane', visuals.visualization);
        visuals.legendPane = $('div.pl-legend', visuals.visualization);
        //visuals.ppc = new PPC.PPCWidget(context, infoBox);

        context._busyIndicator = $('<div class="pl-busy-indicator"></div>')
          .append('<div class="pl-label"></div>')
          .append(VisUtils.icon('update'))
          .appendTo(visuals.visualization);

        return visuals;
      }

      /* Creates, hides and attaches GUI elements for this context to the DOM
      **/
      makeGUI() {
        this.$visuals = Context._makeVisuals(this);
        this.displayVisuals(false);
        this.attachVisuals();
        return this;
      }
    }

    Context._name2iconMap = {
        'aggregations': 'prediction',
        'data aggregations': 'prediction',
        'marginals': 'uniDensity',
        'contour': 'contour',
        'data density': 'contour',
        'data': 'dataPoints',
        'testData': 'dataPoints',
        'model samples': 'dataPoints',
        'predictionDataLocal': 'prediction',
        'dataMarginals': 'uniDensity',  // TODO: make histogram icon
      };


    /**
     * A model selector, i.e. an input field whose value is used as a model name.
     * On input confirmation a new context is created, the according model is fetched and activated.
     */
    class ModelSelector {

      constructor (context) {
        this._context = context;
        this.milliseconds = 1000  * 2;
        setInterval(this.refetchModels.bind(this), this.milliseconds);

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
       * Clear input text field
       * @private
       */
      _clearInput () {
        $('.pl-input', this.$visual).val("")
      }

      /**
       * Load model with name modelname.
       * @param modelName {String} Name of the model to load.
       * @private
       */
      _loadModel (modelName) {
        // create new context and visualization with that model if it exists
        let context = new Context(RunConf.DEFAULT_SERVER_ADDRESS + Settings.meta.modelbase_subdomain, modelName).makeGUI();
        contextQueue.add(context);

        // fetch model
        let that = this;
        context._updateModels()
          //.then(() => that._clearInput())
          .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas))
          .then(() => activate(context, ['visualization', 'visPane', 'legendPane']))
          .then(() => infoBox.message("Drag'n'drop attributes onto the specification to create a visualization!", "info", 5000))
          .catch((err) => {
            console.error(err);
            if (err instanceof XMLHttpRequest){
                connection_errorhandling(err)
            } else {
                infoBox.message("Internal error: " + err.toString());
            }
            // infoBox.message("Could not load remote model '" + modelName + "' from Server '" + context.server + "' !");
            // TODO: remove vis and everything else ...
          })
          .catch((err) => {
            console.error(err);
          })
      }

      _filter_names(value){
        return !value.startsWith("__") && !value.startsWith("emp");
      }

      _isSameList(datalist, model_list){
        let filtered_models = model_list.filter(this._filter_names);
        if(datalist.length !== filtered_models.length)
          return false;
        for(let i = datalist.length; i--;){
          if (datalist[i].value !== filtered_models[i])
            return false;
        }
        return true;
      }

      _setModels(models, alert=true) {
        let $datalist = this._$modelsDatalist;
        if (!this._isSameList($datalist[0].options, models)) {
          for (let i = $datalist[0].options.length - 1; i >= 0; --i) {
            if (models.includes($datalist[0].options[i].value)) {
              let index = models.indexOf($datalist[0].options[i].value);
              if (index > -1) {
                models.splice(index, 1);
              }
            } else {
              $datalist[0].options[i].remove()
            }
          }
          // filter any names that begin with "__" since these are only 'internal' models
          for (let name of models.filter(this._filter_names)) {
            $datalist.append($("<option>").attr('value', name).text(name).attr('id', name));
          }
          if (alert === true && models.filter(this._filter_names).length !== 0)
            alertBox.message(models.filter(this._filter_names));
        }
      }

      /**
       * Refetch the available models on the server.
       */
      refetchModels(alert=true) {
        this._context.modelbase.listModels().then( res => this._setModels(res.models, alert) );
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
       * @param alert defines if models are displayed immediately or not
       */
      setContext (context, alert=false) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");
        this._context = context;
        this.refetchModels(alert);
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

        function download_facet_data(facetName) {
          let facet = that._context.facets[facetName];
          if (!facet.active)
            return; // abort
          let data = facet.data[0][0];  // default to data of facet with index [0,0]
          let header = data.header;
          utils.download(facetName + ".csv", [header].concat(data).join("\n"), 'text/csv');
        }

        let that = this;
        // Model Info
        that._$modelInfo = $('<div class="pl-text pl-details__body">');

        // Query Info
        let $vismel_load = $('<div class="pl-details__body pl-button">load query</div>')
            .click( () => {
              return infoBox.message("loading of contexts not yet implemented");
              // let querystr = "";
              // Context.FromJSON( JSON.parse(querystr) ).then( context => {
              //   contextQueue.add(context);
              //   activate(context, ['visualization', 'visPane', 'legendPane']);
              //   return context.update()
              // })
            });
        let $vismel_save = $('<div class="pl-details__body pl-button">save query </div>')
            .click(() => {
                let json = that._context.query.toJSON();
                utils.download("vismel.json", jsonutils.stringify(json), 'text/json');
            });
        let $test_conversion = $('<div class="pl-details__body pl-button">test conversion</div>')
            .click( () => testConversion(that._context));

        that._$queryInfo = $('<div class="pl-text pl-details__body">')
            .append($vismel_load)
            .append($vismel_save)
            .append($test_conversion);

        // Result Info
        that._$resultInfo = $('<div class="pl-text pl-details__body">');
        for (let facetName of _facetNames) {
          let $facet_download = $(`<div class="pl-details__body pl-button">extract ${_facetNameMap[facetName]} facet</div>`)
              .click(() => download_facet_data(facetName));
          that._$resultInfo.append($facet_download);
        }

        // Context info
        let $context_save = $('<div class="pl-details__body pl-button">save active context</div>')
            .click(() => {
              let json = that._context.toJSON(),
                  filename = that._context.model.name + ".json";
              utils.download(filename, jsonutils.stringify(json), 'text/json');
            });
        let $context_load = $('<div class="pl-details__body pl-button">load context</div>')
            .click(() => {
              infoBox.message("loading of contexts not yet implemented");
            });
        let $all_context_save = $('<div class="pl-details__body pl-button">save all contexts</div>')
            .click(() => {              
              let json = {
                class: 'ContextCollection',
                contexts: [...contextQueue].map(c => c.toJSON()),
              };
              utils.download("all_contexts.json", jsonutils.stringify(json), 'text/json');
            });

        that._$contextInfo = $('<div class="pl-text pl-details__body">')
            .append($context_load)
            .append($context_save)
            .append($all_context_save);

        that.$visual = $('<div class>')
          .append('<div class="pl-h2 pl-details__heading">Model</div>')
          .append(this._$modelInfo)
          .append('<div class="pl-h2 pl-details__heading">Query</div>')
          .append(this._$queryInfo)
          .append('<div class="pl-h2 pl-details__heading">Result</div>')
          .append(this._$resultInfo)
          .append('<div class="pl-h2 pl-details__heading">Context</div>')
          .append(this._$contextInfo);

        that._context = undefined;
        if(context !== undefined) {
          that.setContext(context);
          that.update();
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
        // i want a button each that downloads the data facet and density/contour facet results
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
            .click(() => this._context.update('all', true));
          elems.push($query);
        }

        if (config.clone.active) {
          let $clone = Toolbar._makeToolbarButton("clone", "Clone")
            .click( () => {
              let c = this._context;
              ActivityLogger.log({'context': c.getNameAndUUID()}, 'clone');
              let contextCopy = c.copy();
              contextQueue.add(contextCopy);

              // fetch model
              contextCopy._updateModels()
                .then(() => activate(contextCopy, ['visualization', 'visPane', 'legendPane']))
                .then(() => contextCopy.update('all', true))
                .catch((err) => {
                    console.error(err);
                    connection_errorhandling(err);
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
       * @param alert If new models are displayed immediately or not
       */
      setContext (context, alert=false) {
        if (!(context instanceof Context))
          throw TypeError("context must be an instance of Context");

        this._context = context;
        this._modelSelector.setContext(context, alert);
      }
    }

    /**
     * A wrapper around a GraphWidget that manages GraphWidgets for contexts.
     *
     * It always shows the GraphWidget for the active Context, creates them transparently if a not-seen-before context
     * is set and remember previously set contexts. It automatically removes GraphWidgets for destroyed contexts.
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
            //return context.model.ppGraph_get().then(
              graph => {
                // create a new div to draw on
                let $vis = $('<div class=pl-graph-pane></div>').hide();
                this.$visual.append($vis);

                // make new graph widget
                widget = new PPGraphWidget($vis[0], graph, context.model.fields, Settings.widgets.ppWidget.layout);
                //widget = new GraphWidget($vis[0], graph);
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

      constructor() {
        this._first = undefined;
        this._last = undefined;
        this.length = 0;
        Emitter(this);
      }

      static
      _makeElem(context=undefined, prev=undefined, next=undefined) {
        return {prev, next, context}
      }

      _addSingleContextFromJSON(jsonObj) {
        let that = this;
        return Context.FromJSON(jsonObj).then( context => {
          that.add(context);
          activate(context, ['visualization', 'visPane', 'legendPane']);
          return context.update()
        });
      }

      addContextFromJSON(jsonObj) {
        if (_.isString(jsonObj))
          jsonObj = JSON.parse(jsonObj);

        jsonObj = (jsonObj.class === 'ContextCollection') ?  jsonObj.contexts : [jsonObj];

        for (let jsonContext of jsonObj)
          this._addSingleContextFromJSON(jsonContext);
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

      // _reset_z_index(){
      //   zIndexGenerator = this.length;
      //   for(let i of this){
      //     i.$visuals.visualization.css("z-index", zIndexGenerator--);
      //   }
      //   zIndexGenerator = this.length + 1;
      // }

      /**
       * Adds the context as a new and as the first element to the context queue.
       * @param context
       */
      add(context) {
        let elem = ContextQueue._makeElem(context);
        this._prepend(elem);
        this.length++;

        // an element listens to a context being deleted. it then deletes itself and makes the first element of the queue the active context
        // an element listens to a context being deleted. it then deletes itself and makes the first element of the queue the active context
        context.on("ContextDeletedEvent", () => {
          this._remove(elem);
          this.length--;
          this.activateFirst();
          if(this.empty())
            this.emit("ContextQueueEmpty");
          // this._reset_z_index()
        });

        // an element listens to a context being activated. it then is moved to the beginning of the queue
        context.on("ContextActivatedEvent", () => {
          this._moveToFront(elem);
        })
      }

      /**
       * Returns the currently first context of the queue.
       */
      first() {
        return this.empty() ? undefined : this._first.context;
      }

      // *makeIterator() {
      *[Symbol.iterator]() {
        let current = this._first;
        while (current !== undefined) {
          yield current.context;
          current = current.next;
        }
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
        _currentContext.$visuals.visualization.css("z-index",zIndex.inc());

        // set context in singelton widgets
        toolbar.setContext(context);
        swapper.setContext(context);
        if (detailsView)
            detailsView.setContext(context);
        graphWidgetManager.setContext(context);
        ppcWidget.setContext(context);

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

    // create info box
    let infoBox = new InfoBox("info-box");
    infoBox.$visual.insertAfter($('main'));

    // create toolbar
    let toolbar = new Toolbar();
    toolbar.$visual.appendTo($('#pl-toolbar__container'));

    let alertBox = new AlertBox("alert-box", toolbar._modelSelector);
    alertBox.$visual.insertAfter($('main'));

    // create x-y swap button
    let swapper = new ShelfSwapper();
    swapper.$visual.appendTo($('#pl-layout-container'));

    // details view
    let detailsView = undefined;
    if (Settings.widget.details.enabled) {
      detailsView = new DetailsView();
      detailsView.$visual.appendTo($('#pl-details-container'));
    } else {
      $('.pl-details').hide();
    }

    // posterior predictive check widget
    let ppcWidget = new PPC.PPCWidget(undefined, infoBox);
    if (Settings.widget.posteriorPredictiveChecks.enabled) {
      ppcWidget.$visual.appendTo(document.getElementById('pl-ppc-container'));
    }
    // if (!Settings.widget.posteriorPredictiveChecks.enable)
    //   $('.pl-ppc').hide();

    // create survey widget
    if (Settings.widget.userStudy.enabled) {
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
    } else {
      $('#pl-survey').hide();
    }

    if (!Settings.widget.userStudy.enabled && !Settings.widget.details.enabled)
      $('.pl-layout-right').hide();

    if (!Settings.widget.posteriorPredictiveChecks.enabled)
      $('#pl-ppc-column').hide();

    if (Settings.widget.ppGraph.enable) {
      throw "Not implemented. See issue #95";
    }

    // dependency graph widget
    let graphWidgetManager = new GraphWidgetManager(undefined, document.getElementById('pl-graph-container'));
    if (!Settings.widget.graph.enable) {
      $('.pl-layout-lower-left').hide();
      $('.pl-layout-upper-left').css('height', '100%');
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
        contextQueue.first().update('config.changed', false);
    });

    // make dash board pannable
    makePannable('#pl-dashboard__container', '.pl-visualization');


    function testConversion(context) {

      if (contextQueue.empty())
        return;

      // get current vismel
      let vismel = context.query;
      console.log(`Current vismel query:\n ${vismel.toString()}`);

      // turn into JSON
      let vismelJson = vismel.toJSON(),
      vismelStr = jsonutils.stringify(vismelJson);
      console.log(`Current vismel query as JSON:\n ${vismelStr}`);

      if (vismel.toString() === vismelStr)
        console.log("json and string are identical");

      // turn into Vismel
      let vismel_re_promise = VisMEL.VisMEL.FromJSON(JSON.parse(vismelStr));

      vismel_re_promise.then( vismel_re => {
        // turn into JSON
        let vismel_re_str = jsonutils.stringify(vismel_re);
        console.log(`Re parsed vismel query as JSON:\n ${vismel_re_str}`);

        if (vismel_re_str === vismelStr)
          console.log("string or original and re parsed vismel are identical");
      });
    }

    return {
      /**
       * Starts the application.
       */
      start: function () {
        // create initial context with model
        let context = new Context(RunConf.DEFAULT_SERVER_ADDRESS + Settings.meta.modelbase_subdomain, RunConf.DEFAULT_MODEL).makeGUI();

        // when default model is set
        if(RunConf.DEFAULT_MODEL !== ""){
          // fetch model
          contextQueue.add(context);
          context._updateModels()
            .then(() => sh.populate(context.model, context.shelves.dim, context.shelves.meas)) // on model change
            .then(() => activate(context, ['visualization', 'visPane', 'legendPane']))  // activate that context
            .then(() => initialQuerySetup(context.shelves))
            .then(() => InitialContexts.forEach( json => contextQueue.addContextFromJSON(json)))
            .then(() => {
              //onStartUp();
            })
            .catch((err) => {
              console.error(err);
              connection_errorhandling(err)
            });
        } else {
          toolbar.setContext(context, true);
        }
        }
    };

    function connection_errorhandling(err) {
        if (err instanceof XMLHttpRequest) {
            if (err.status === 0) {
                infoBox.message("Could not connect to Backend-Server!");
            } else {
                infoBox.message(err.response);
            }
        }
    }

  });

