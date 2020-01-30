/* copyright © 2020 Philipp Lucas (philipp.lucas@dlr.de) */

define(['lib/emitter', '../shelves', '../VisUtils', '../ViewSettings'], function (Emitter, sh, VisUtils, config) {


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
      let that = this;
      that._context = undefined;
      that._model = undefined;
      that._infobox = infobox;
      if (context !== undefined)
        that.setContext(context);

      const test_quantities = ['min', 'max', 'average', 'median'];

      // make visual context
      that._$selectK = $('<div class="pl-ppc__section"></div>')
          .append(
              '<div class="pl-h2 pl-ppc__h2"># of repetitions</div>',
              '<input class="pl-ppc__input" type="number" id="pl-ppc_samples-input" value="50">'
          );

      that._$selectN = $('<div class="pl-ppc__section"></div>')
          .append(
              '<div class="pl-h2 pl-ppc__h2" ># of samples</div>',
              '<input class="pl-ppc__input" type="number" id="pl-ppc_repetitions-input" value="50">'
          );

      // currently the possible test quantities are static but they may be dynamic in future:
      that._$testQuantityList = $('<datalist id="ppc-test-quantities"></datalist>');
      for (let q of test_quantities)
        that._$testQuantityList.append($("<option>").attr('value', q).text(q));

      that._$selectTestQuantity = $('<div class="pl-ppc__section"></div>').append(
          ('<div class="pl-h2 pl-ppc__h2">test quantity</div>'),
          ('<input class="pl-input pl-ppc__input" type="text" list="ppc-test-quantities" value="median">'),
          that._$testQuantityList
      );

      // shelf where fields of a model may be dropped
      that.ppcShelf = new sh.Shelf(sh.ShelfTypeT.single);
      that.ppcShelf.beVisual({label: 'drop here for PPC'}).beInteractable();

      // buttons bar
      let $clearButton = VisUtils.button('Clear', 'clear')
          .addClass('pl-ppc__button')
          .click( () => {})
      let $queryButton = VisUtils.button('Query', 'geo-position2')
          .addClass('pl-ppc__button')
          .click( () => {});
      this._$buttons = $('<div class="pl-ppc__button-bar"></div>').append($clearButton, $queryButton);

      // run ppc query whenever the shelf's content changes
      that.ppcShelf.on(Emitter.ChangedEvent, event => {
        let fields = that.ppcShelf.content();
        if (fields.length === 0)
          return;

        if (fields.length === 1) {
          that._model = fields[0].model;
          console.log(`set new model: ${that._model.name}`);
        }

        // verify that all fields are of the same context
        if (!_.all(fields, f => f.model.name == that._model.name)) {
          that._infobox.message("Cannot mix different models in one PPC visualization.");
          return;
        }

        // query ppc results
        let promise = that._model.ppc(fields, {k: 20, n: 50, TEST_QUANTITY: 'median'});

        // create visualization
        let vis = new PPCVisualization();
        // TODO: set busy state?

        promise.then(
            res => {
              that._infobox.message("received PPC results!");
              console.log(res.toString());
              vis.render(res);
            }
        ).catch( err => {
              infobox.message(`PPC Query failed: ${err}", "warning`);
              vis.remove();
            });
      });

      that.$visual = $('<div class="pl-ppc"></div>')
          //             .append('<div class="pl-h2"># of repetitions</div>')
          .append(this.ppcShelf.$visual)
          .append(this._$selectK)
          .append(this._$selectN)
          .append(this._$selectTestQuantity)
          .append(this._$buttons);
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

  class PPCVisualization {

    constructor ($parent=undefined) {
      if ($parent === undefined)
        $parent = $('#pl-dashboard__container');
      this.$visual = this._makeVisual();
      this._makeDraggable();
      this._makeResizeable();
      this._makeActivetable();
      this._ppcResult = undefined;
      $parent.append(this.$visual);
    }

    render (ppcResult) {
      if (ppcResult === undefined)
        return;
      // save for later redraw
      this._ppcResult = ppcResult;
      // draw content
      const len = ppcResult.reference.length;
      // shapes in plotly: https://plot.ly/javascript/shapes/#vertical-and-horizontal-lines-positioned-relative-to-the-axes
      let referenceLines = ppcResult.reference.map( (ref, i) => ({
        type: 'line',
        xref: `x${i+1}`,
        yref: 'paper',
        x0: ref,
        y0: 0,
        x1: ref,
        y1: 1,
        line: {
          color: 'rgb(255,0,0)',
        }
      }));

      let histogramTraces = ppcResult.test.map( (test, i) => ({
        x: test,
        xaxis: `x${i+1}`,
        yaxis: `y${i+1}`,
        name: ppcResult.header[i],
        type: 'histogram'
      }));

      let traces = [...histogramTraces],
          layout = {
            shapes: [...referenceLines],
            grid: {
              rows: 1,
              columns: len,
              pattern: 'independent',
            }
          };

      // DEBUG
      // console.log(traces);
      // console.log(layout);

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
        if (this !== _activePPCVis)
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
