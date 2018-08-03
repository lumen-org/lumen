/*

API :

in:
   field
      name
      extent
      domain
      dtype

   model?
   density over field?
   maybe just a function that provides a promise to histogram data? !

   div that is used to draw it on

out:
   selected domain via: selection()


state:
  selected domain
    for categorical dims: selected bars
    for quantitative dims: selected range, max zoom range


methods:
   render(): (re)draw with current state (i.e. update dist data)

events
   triggers Emitter.InternalChangedEvent on the Field if it changes a Fields domain?
      I think this one. it separates the concerns better?
   triggers its own changed event that I can then connect to the Fields changed event?

implements:
   PQL.Filter.prototype.makeVisual:



no react. It is not very "html-lastig"
*/

define([/*plotly !!*/], function () {
  "use strict";

  let plotConfig = {
    displayModeBar: false,
    showTips: false,
    displaylogo: false,
    //   showAxisDragHandles: false,
    //   showAxisRangeEntryBoxes: false,
    scrollZoom: true,
  };


  /**
   * A FilterWidget is a interactive, editable UI to a Filter FieldUsage.
   */
  class FilterWidget {

    /**
     *
     * @param field {PQL.Field} The field to create a FilterWidget for.
     * @param densityPromise A function that returns a Promise to an update of density value for the field.
     * @param container the DOM element where the plot is drawn
     */
    constructor(field, densityPromise, container) {
      this.field = field;
      this._densityPromise = densityPromise;
      this.plot = container;

      this._selectedDomain = field.; // The currently selected domain
      this._fullDomain = field.

      this.dType = this.field.dataType;  // {String} Either "string" for categorical or "numerical" for quantitative data

      // by default categorical histogram is drawn vertically, such that names have enough space,
      // and quantitative density plots are drawn horizontally because it is more familiar
      // TODO: do violin plots for data vs model?
      //this.direction = (this.field.dataType === 'string' ? 'horizontal' : 'vertical');

      //this._dataTrace = undefined;  // Plotly trace object for the histogram/density plot
      let trace = {}, // the trace object that is used plot the initial plot. Later it is only updated, not entirely redrawn.
        layout = { // the layout object that is used plot the initial plot. Later it is only updated, not entirely redrawn.
          margin: {
            l: 10,
            t: 10,
            r: 10,
            b: 10,
            pad: 0
          },
          hovermode: 'closest',
          // dragmode: 'select',
        };

      // init depending on data type
      if (this.dType === 'string')
        [layout, trace] = FilterWidget.initCategorical(layout, trace);
      else if (this.dType === 'numerical')
        [layout, trace] = FilterWidget.initQuantitative(layout, trace);
      else
        throw "invalid data type or data type not implemented!";

      // make initial plot. will be updated on request later
      Plotly.newPlot(container, [trace], layout, plotConfig);

      // attach interactivity
      if (this.dType === 'string')
        this._makeInteractiveCategorical();
      else if (this.dType === 'numerical')
        this._makeInteractiveQuantitative();

      // trigger initial getting of data
      this.render();
    }

    static initCategorical(layout, trace) {
      this.direction = 'vertical';
      layout = Object.assign(layout, {
        xaxis: {
          fixedrange: true,
          showticklabels: false,
        },
        yaxis: {
          fixedrange: true,
        }
      });
      layout.margin.l = 80;
      trace = Object.assign(trace, {
        type: 'bar',
        mode: 'markers',
        orientation: 'h',
      });
      return [layout, trace];
    }

    _makeInteractiveCategorical() {
      let selected = new Set();
      this.plot.on('plotly_click', data => {
        // update selection
        let val = data.points[0].pointNumber;
        if (selected.has(val))
          selected.delete(val);
        else
          selected.add(val);

        // sync to view
        Plotly.restyle(this.plot, {selectedpoints: [[...selected.values()]]});

        //
      })
    }

    static initQuantitative(layout, trace) {
      this.direction = 'horizontal';
      layout = Object.assign(layout, {
        xaxis: {
          rangeslider: {},
          showgrid: false,
          zeroline: false,
          ticklen: 3,
          showticklabels: false,
        },
        yaxis: {
          fixedrange: true,
          showgrid: true,
          showticklabels: false,
          rangemode: "tozero",
          zeroline: true,
        }
      });
      layout.margin.b = 10;
      layout = Object.assign(layout, {
        type: 'scatter',
      });
      return [layout, trace];
    }

    _makeInteractiveQuantitative() {
      this.plot.on('plotly_selected', (eventData) => {
        console.log(eventData);
      });
    }

    _convertDataToTrace(data) {
      let [x, y] = _.unzip(data);
      return (this.direction === 'horizontal' ? {x: [x], y: [y]} : {x: [y], y: [x]});
    }

    /**
     * Fetches new distribution data and updates the widget with the new distribution data.
     * Can also be used to redraw the widget if for example the containing div's size changed.
     * @param recalc {boolean} Defaults to true. Iff true recalculate the density values for the plot. False for not.
     */
    render(recalc = true) {
      // recalc data if necessary or requested
      let promise;
      if (recalc || this.density === undefined) {
        promise = this._densityPromise().then(data => this._convertDataToTrace(data));
      } else {
        promise = Promise.resolve(this.densityData);
      }

      // update plot when data is fetched
      promise.then(
        dataTrace => {
          //this._dataTrace = dataTrace;
          Plotly.restyle(this.plot, dataTrace);
        }
      );
    }
  }

  return FilterWidget;
});