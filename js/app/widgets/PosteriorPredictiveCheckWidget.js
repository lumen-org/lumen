/* copyright © 2020 Philipp Lucas (philipp.lucas@dlr.de) */

define(['lib/emitter', '../shelves', '../VisUtils', '../ViewSettings', '../ZIndexManager'], function (Emitter, sh, VisUtils, config, zIndex) {

  const test_quantities = ['min', 'max', 'average', 'median', 'variance', 'most_frequent', 'least_frequent'];

  let _activePPCVis = undefined;

  /**
   * A widget that lets you create Posterior Predictive Check (PPC) visualizations.
   */
  class PPCWidget {

    /**
     * Returns a new PPC widget. It UI is available at the `.$visual` attribute.
     * @param context {@Context} The context of this widget.
     * @param infobox The InfoBox to print information with.
     */
    constructor(context, infobox) {
      this._context = undefined;
      this._model = undefined;
      this._infobox = infobox;
      if (context !== undefined)
        this.setContext(context);

      // make visual context
      this._$selectK = $('<div class="pl-ppc__section"></div>')
          .append(
              '<div class="pl-h2 pl-ppc__h2"># of repetitions</div>',
              '<input class="pl-input pl-ppc__input" type="number" id="pl-ppc_samples-input" value="' + config.widgets.ppc.numberOfRepetitions + '">'
          );

      this._$selectN = $('<div class="pl-ppc__section"></div>')
          .append(
              '<div class="pl-h2 pl-ppc__h2" ># of samples</div>',
              '<input class="pl-input pl-ppc__input" type="number" id="pl-ppc_repetitions-input" value="' + config.widgets.ppc.numberOfSamples.toString()+ '">'
          );

      // currently the possible test quantities are static but they may be dynamic in future:
      this._$testQuantityList = $('<datalist id="ppc-test-quantities"></datalist>');
      for (let q of test_quantities)
        this._$testQuantityList.append($("<option>").attr('value', q).text(q));

      this._$selectTestQuantity = $('<div class="pl-ppc__section"></div>').append(
          ('<div class="pl-h2 pl-ppc__h2">test quantity</div>'),
          ('<input class="pl-input pl-ppc__input" type="text" list="ppc-test-quantities" value="median" id="pl-ppc_test-quantity-input">'),
          this._$testQuantityList
      );

      // shelf where fields of a model may be dropped
      this.ppcShelf = new sh.Shelf(sh.ShelfTypeT.single);
      this.ppcShelf.beVisual({label: 'drop here for PPC'}).beInteractable();

      // buttons bar
      let $clearButton = VisUtils.button('Clear', 'clear')
          .addClass('pl-ppc__button')
          .click( this.clear.bind(this));
      let $queryButton = VisUtils.button('Query', 'geo-position2')
          .addClass('pl-ppc__button')
          .click( this.query.bind(this));
      this._$buttons = $('<div class="pl-ppc__button-bar"></div>').append($clearButton, $queryButton);

      // run ppc query whenever the shelf's content changes
      //this.ppcShelf.on(Emitter.ChangedEvent, this.query.bind(this));

      this.$visual = $('<div class="pl-ppc"></div>')
          .append(this.ppcShelf.$visual)
          .append(this._$selectK)
          .append(this._$selectN)
          .append(this._$selectTestQuantity)
          .append(this._$buttons);
    }


    /**
     * Clear PPCs specifiction, i.e. remove all assigned fields and other custom config.
     */
    clear() {
      this.ppcShelf.clear();
    }

    getNumberOfRepetitions() {
      return parseInt($('#pl-ppc_samples-input').val());
      //return this._$selectN('.input').val(); // why does this not work?
    }

    getNumberOfSamples () {
      return parseInt($('#pl-ppc_repetitions-input').val());
    }

    getTestQuantity () {
      return $('#pl-ppc_test-quantity-input').val();
    }

    /**
     * Run PPC with currently set specification.
     */
    query () {
        let fields = this.ppcShelf.content();
        if (fields.length === 0)
          return;

        if (fields.length === 1) {
          this._model = fields[0].model;
          console.log(`set new model: ${this._model.name}`);
        }

        // verify this all fields are of the same context
        if (!_.all(fields, f => f.model.name == this._model.name)) {
          this._infobox.message("Cannot mix different models in one PPC visualization.");
          return;
        }

        // get parameter values
        let params = {
          k: this.getNumberOfSamples(),
          n: this.getNumberOfRepetitions(),
          TEST_QUANTITY: this.getTestQuantity()
        };

        // query ppc results
        let promise = this._model.ppc(fields, params);

        // create visualization
        let vis = new PPCVisualization(this);
        // TODO: set busy state?

        promise.then(
            res => {
              this._infobox.message("received PPC results!");
              console.log(res.toString());
              vis.render(res);
            }
        ).catch( err => {
          this._infobox.message(`PPC Query failed: ${err}", "warning`);
          vis.remove();
        });

    }

    /**
     * Sets the context that it controls.
     * @param context A context.
     */
    setContext(context) {
      // TODO: add this check again once #75 is solved
      // if (!(context instanceof Context))
      //   throw TypeError("context must be an instance of Context");
      this._context = context;
      this._model = context.model;
    }

  }

  /**
   * Visualization of a PPC.
   */
  class PPCVisualization {

    constructor (ppcWidget, $parent=undefined) {
      this._modelName = ppcWidget._model.name;
      this._testQuantity = ppcWidget.getTestQuantity();
      if ($parent === undefined)
        $parent = $('#pl-dashboard__container');
      this.$visual = this._makeVisual();
      this._makeDraggable();
      this._makeResizeable();
      this._makeActivetable();
      this._ppcResult = undefined;
      $parent.append(this.$visual);
    }

    static
    _makeReferenceLines (ppcResult) {
      const refConfig = config.map.ppc.referenceValue;
      // shapes in plotly: https://plot.ly/javascript/shapes/#vertical-and-horizontal-lines-positioned-relative-to-the-axes
      return ppcResult.reference.map( (ref, i) => ({
        type: 'line',
        xref: `x${i+1}`,
        yref: 'paper',
        x0: ref,
        y0: 0,
        x1: ref,
        y1: 1,
        line: {
          color: refConfig.lineColor,
          width: refConfig.lineWidth,
        }
      }));
    }

    static
    _makeHistogramTraces (ppcResult) {
      const histoConfig = config.map.ppc.modelHistogram;
      return ppcResult.test.map( (test, i) => ({
        x: test,
        xaxis: `x${i+1}`,
        yaxis: `y${i+1}`,
        name: ppcResult.header[i],
        type: 'histogram',
        showlegend: false,
        // opacity: ,
        marker: {
          color: histoConfig.color,
          opacity: histoConfig.fillOpacity,
          line: {
            color: histoConfig.color,
            opacity: histoConfig.lineOpacity,
            width: histoConfig.lineWidth,
          }
        },
      }));
    }

    static
    _addXAxes (layout, ppcResult) {
      const len = ppcResult.reference.length;
      if (len === 1)
        layout['xaxis1'] = {
          anchor: 'y1',
          domain: [0,1],
          title: ppcResult.header[0],
        };
      else {
        let xAxisWidth = 0.9/len,
            xAxisMargin = 0.1/(len-1),
            base = 0;
        for (let i=0; i<len; i++) {
          layout['xaxis'+(i+1)] = {
            anchor: 'y' + (i+1),
            domain: [base, base + xAxisWidth],
            title: ppcResult.header[i],
          };
          base += xAxisWidth + xAxisMargin;
        }
      }
      return layout;
    }

    static
    _addYAxes (layout, ppcResult) {
      const len = ppcResult.reference.length;
      for (let i=0; i<len; i++)
        layout['yaxis'+(i+1)] = {anchor: 'x' + (i+1)};
      return layout;
    }

    render (ppcResult) {
      if (ppcResult === undefined)
        return;

      ppcResult.len = ppcResult.reference.length;

      // save for later redraw
      this._ppcResult = ppcResult;

      // for 2d plotting of test quantities ...
      if (ppcResult.len === 2) {
        // make a 2d ppc plot
        let traces = [
          {
            x: ppcResult.test[0],
            y: ppcResult.test[1],
            type: 'histogram2d',
          }
        ];
        let layout = {
          title: {
            text: `PPC of ${this._modelName} for ${this._testQuantity}`,
          },
          xaxis: {
            title: ppcResult.header[0],
          },
          yaxis: {
            title: ppcResult.header[1],
          }
        };
        let visPane = $('div.pl-visualization__pane', this.$visual).get(0);
        Plotly.newPlot(visPane, traces, layout, config.plotly);
        return;
      }

      // draw content
      let traces = PPCVisualization._makeHistogramTraces(ppcResult),
          layout = {
            title: {
              text: `PPC of ${this._modelName} for ${this._testQuantity}`,
            },
            shapes: PPCVisualization._makeReferenceLines(ppcResult),
            // Grid is easier, however, it is impossible to set axis titles...
            // grid: {
            //   rows: 1,
            //   columns: len,
            //   pattern: 'independent',
            // }
          };
      PPCVisualization._addXAxes(layout, ppcResult);
      PPCVisualization._addYAxes(layout, ppcResult);

      let visPane = $('div.pl-visualization__pane', this.$visual).get(0);
      Plotly.newPlot(visPane, traces, layout, config.plotly);
    }

    redraw () {
      this.render(this._ppcResult);
    }

    remove () {
      console.log("removing PPC vis");
      this.$visual.remove();
    }

    _makeDraggable() {
      this.__is_dragging = false;
      this.$visual.draggable(
          {
            handle: '.pl-visualization__pane',

            start: (ev, ui) => {
              this.__is_dragging = true;
            },

            drag: (ev, ui) => {
              // TODO: this is a rather dirty hack to prevent that the whole visualization widget is dragged when the user zooms using the plotly provided interaction.
              // this is a reported change of behaviour, according to here: https://community.plot.ly/t/click-and-drag-inside-jquery-sortable-div-change-in-1-34-0/8396
              if (ev.toElement && ev.toElement.className === 'dragcover') {
                return false;
              }
              // this probably works for all browsers. It relies on plotly to have a foreground drag layer that receives the event and that has a class name that includes 'drag'
              // only apply on the very first drag, because we only want to cancel the drag if it originally started on the plotly canvas, but not if it moves onto it
              else if (ev.originalEvent.target.getAttribute('class').includes('drag') && this.__is_dragging) {
                return false;
              }
              this.__is_dragging = false;
            }
          }); // yeah, that was easy. just made it draggable!
    }

    _makeResizeable() {
      this.$visual.resizable({
            ghost: true,
            helper: "pl-resizing",
            stop: (ev, ui) => this.redraw()
          });
    }

    _makeActivetable() {
      this.$visual.mousedown( () => {
        this.$visual.css("z-index", zIndex.inc());
        if (this === _activePPCVis)
          return;
        if (_activePPCVis !== undefined) {
          _activePPCVis.$visual.toggleClass('pl-active', false);
        }
        _activePPCVis = this;
        _activePPCVis.$visual.toggleClass('pl-active', true);
      })
    }

    _makeVisual () {
      let $paneDiv = $('<div class="pl-visualization__pane"></div>'),
          $removeButton = VisUtils.removeButton().click( () => this.$visual.remove());
      let $vis = $('<div class="pl-visualization pl-active-able"></div>')
          .append($paneDiv, $removeButton/*, $legendDiv*/)
          .css( "position", "absolute" ); // we want absolute position, such they do not influence each others positions
      return $vis;
    }
  }

  return {
    PPCWidget,
  }
});
