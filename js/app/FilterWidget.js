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

define(['./Domain', 'lib/emitter' /*plotly !!*/], function (Domain, Emitter) {
  "use strict";

  let plotConfig = {
    displayModeBar: false,
    showTips: false,
    displaylogo: false,
    //   showAxisDragHandles: false,
    //   showAxisRangeEntryBoxes: false,
    scrollZoom: true,
  };

  let d3 = Plotly.d3;




  /**
   * A FilterWidget is a interactive, editable UI to a Filter FieldUsage.
   *
   * Internal:
   *   * I decided to decouple the state of the widget from the state of the filter, i.e. the state is duplicated in the widget. The reason is that this way I can control when to push updates to the filter, and when not.
   *   Project-specifically, I want to avoid too many events that indicate a Filter change, because that in turn would trigger many PQL queries...
   */
  class FilterWidget {

    /**
     *
     * @param filter {PQL.Filter} The Filter FieldUsage to create a FilterWidget for.
     * @param densityPromise A function that returns a Promise to an update of density value for the field.
     * @param container the DOM element where the plot is drawn
     */
    constructor(filter, densityPromise, container) {
      this.field = filter.field;
      this.filter = filter;
      this.dType = this.field.dataType;  // {String} Either "string" for categorical or "numerical" for quantitative data
      this._densityPromise = densityPromise;
      this.container = container;
      this.plot = undefined;

      this.domain = (this.dType === 'string' ? new Set(filter.args.values) : filter.args.values);  // internal representation of the state of the filter.
      this.fullDomain = this.field.extent.values;

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
        [layout, trace] = this.initCategorical(layout, trace);
      else if (this.dType === 'numerical')
        [layout, trace] = this.initQuantitative(layout, trace);
      else
        throw "invalid data type or data type not implemented!";

      // make gui elements
      this._appendTitle(container);
      this._appendCategoricalButtons(container);
      this._appendPlot(container);

      // make initial plot. will be updated on request later
      Plotly.newPlot(this.plot, [trace], layout, plotConfig);

      // attach interactivity and render initial plot
      if (this.dType === 'string') {
        this._makeInteractiveCategorical();
//         this.render(true, this.makeTraceUpdate4Selection());  TODO: do not know how to make use of the intitial selection, because I need integer indices but only have the categorical labels...              
      }
      else if (this.dType === 'numerical') {
        this._makeInteractiveQuantitative();
      }

      this.fetchDistribution(); // will also render it!
    }

    initCategorical(layout, trace) {
      this.labels = new Set();
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

    makeTraceUpdate4Selection () {
      if (this.dType === 'string')
        return {selectedpoints: [[...this.domain.values()]]};
      else
        return {}
    }

    _appendTitle (ele) {
      d3.select(ele)
        .append('div')
        .attr('class', 'fw__title')
        .text(this.field.name);
    }

    _appendCategoricalButtons (ele) {
      let toolbar = d3.select(ele)
        .append('div')
        .attr('class', 'fw__toolbar');

      let allButton = toolbar.append('div').attr('class', 'fw__toolbar--button').text('all').on('click', () => this.selectAll());
      let noneButton = toolbar.append('div').attr('class', 'fw__toolbar--button').text('none').on('click', () => this.selectNone());
      let invertButton = toolbar.append('div').attr('class', 'fw__toolbar--button').text('inv').on('click', () => this.selectInverted());
    }

    _appendPlot (ele) {
      this.plot = d3.select(ele)
        .append('div')
        .attr('class', 'fw__plot')[0][0];
    }

    _makeInteractiveCategorical() {
      this.plot.on('plotly_click', data => {
        // update selection
        let val = data.points[0].pointNumber,
          label = data.points[0].y;
        if (this.domain.has(val)) {
          this.domain.delete(val);
          this.labels.delete(label);
        } else {
          this.domain.add(val);
          this.labels.add(label);
        }

        // sync to view
        this.render();
        this.commit();
      })
    }

    initQuantitative(layout, trace) {
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
      this.plot.on('plotly_relayout', (relayoutDict) => {       
        if ("xaxis.range" in relayoutDict) {
          this.domain = relayoutDict["xaxis.range"];
        }
        if ("xaxis.range[0]" in relayoutDict) {
          this.domain[0] = relayoutDict["xaxis.range[0]"];
        }
        if ("xaxis.range[1]" in relayoutDict) {
          this.domain[1] = relayoutDict["xaxis.range[1]"];
        }
        if (relayoutDict["xaxis.autorange"]) {
          // reset to original values
          this.selectAll();
        }
        this.commit();
      });
    }

    _convertDataToTrace(data) {
      let [x, y] = _.unzip(data);
      return (this.direction === 'horizontal' ? {x: [x], y: [y]} : {x: [y], y: [x]});
    }

    selectAll () {
      if (this.dType === 'string')
        this.domain = new Set(_.range(this.fullDomain.length)); // need the indices!
      else if (this.dType === 'numerical')
        this.domain = this.fullDomain.slice();
      else
        throw "not implemented";
      this.render();
    }

    selectNone () {
      if (this.dType !== 'string')
        throw TypeError("must be string/categorical!");
      this.domain = new Set();
      this.render();
    }

    selectInverted () {
      if (this.dType === 'string') {
        let invDomain = new Set();
        for (let i of _.range(this.fullDomain.length)) {
          if (!this.domain.has(i))
            invDomain.add(i);
        }
        this.domain = invDomain;
      }
      else
        // does not make sense for quantitative
        throw "not implemented";
      this.render();
    }

    fetchDistribution() {
        return this._densityPromise()
            .then(data => this._convertDataToTrace(data))
            .then(dataTrace => {
                this._dataTrace = dataTrace;   
                this.render();
            });
    }



    /**
     * Fetches new distribution data and updates the widget with the new distribution data.
     * Can also be used to redraw the widget if for example the containing div's size changed.
     * @param recalc {boolean} Defaults to true. Iff true recalculate the density values for the plot. False for not.
     */
    render(recalc = true, traceUpdate=undefined) {
       Plotly.restyle(
            this.plot,
            Object.assign({}, this._dataTrace, this.makeTraceUpdate4Selection())
       );
    }

    /**
     * Commit the current state of the widget to the managed Filter.
     */
    commit() {
      let f = this.filter,
        args;

      if (this.dType === 'string') {
        args = [...this.labels.values()];
      } else {
        args = this.domain.slice();
      }

      // TODO: filter itself should emit this signal. also see visuals.js - there is more such emitted signals
      let change = {
        'type': 'fu.args.changed',
        'class': f.constructor.name,
        'name': f.name,
        'value.old': f.args,
        'value.new': args,
      };
      f.args = args;
      f.emit(Emitter.InternalChangedEvent, change);
    }
  }

  return FilterWidget;
});