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

  let formatter = d3.format(".2f");


  /**
   * A FilterWidget is a interactive, editable UI to a Filter FieldUsage.
   *
   * It provides buttons to commit, cancel and deletion
   *
   * Internal:
   *   * I decided to decouple the state of the widget from the state of the filter, i.e. the state is duplicated in the widget. The reason is that this way I can control when to push updates to the filter, and when not.
   *   Project-specifically, I want to avoid too many events that indicate a Filter change, because that in turn would trigger many PQL queries...
   *
   * Design Decisions:
   *   * categorical histogram is drawn vertically, such that names have enough space.
   *   * quantitative density plots are drawn horizontally because it is more familiar
   *   * don't use react, because it is not very 'html-lastig'. Looking back this was a bad decision :-P
   *
   * TODO / Idea:
   *   * violin plots for data vs model?
   *   
   * TODO: use axis.automargin !???
   */
  class FilterWidget {

    /**
     *
     * @param filter {PQL.Filter} The Filter FieldUsage to create a FilterWidget for.
     * @param densityPromise A function that returns a Promise to a sampling over the marginal density of the field.
     * @param container the DOM element where the plot is drawn.
     */
    constructor(filter, densityPromise, container) {
      this.field = filter.field;  // the field of the FilterUsage
      this.filter = filter;  // the managed FilterUsage
      this.dType = this.field.dataType;  // {String} Either "string" for categorical or "numerical" for quantitative data
      this._densityPromise = densityPromise;
      this.container = container;  // the DOM element that holds the widget
      this.plot = undefined;  // the div that holds the marginal density plot

      this.domain = undefined; // the domain to filter on, i.e. non-committed state of this widget
      this.fullDomain = this.field.extent.values;  // the maximal domain

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
      let containerD3 = d3.select(container)
        .classed('fw_container', true);
      this._appendHeader(containerD3);
      this._appendExplicitValueForm(containerD3);
      if (this.dType === 'string')
        this._appendCategoricalButtons(containerD3);
      this._appendPlot(containerD3);

      // make initial plot. will be updated on request later
      Plotly.newPlot(this.plot, [trace], layout, plotConfig);

      // attach interactivity and render initial plot
      this.selectAll(); // work around for consistency: select all
      if (this.dType === 'string') {
        this._makeInteractiveCategorical();
        // this.render(true, this.makeTraceUpdate4Selection());
        // TODO: do not know how to make use of the intitial selection, because I need integer indices but only have the categorical labels...
      }
      else if (this.dType === 'numerical') {
        this._makeInteractiveQuantitative();
      }



      this.fetchDistribution(); // will also render it!
    }

    initCategorical(layout, trace) {
      this.labels = new Set(this.filter.args.values);
      this.direction = 'vertical';
      layout = Object.assign(layout, {
        xaxis: {
          fixedrange: true,
          showticklabels: false,
        },
        yaxis: {
          fixedrange: true,
          automargin: true,
        }
      });
      //layout.margin.l = 80;
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
      else if (this.dType === 'numerical') {
        return {};
      } else {
        throw "not implemented";
      }
    }

    makeLayoutUpdate4Selection () {
      if (this.dType === 'string')
        return {};
      else if (this.dType === 'numerical') {
        return {"xaxis.range": this.domain};
      } else {
        throw "not implemented";
      }
    }

    _appendHeader (ele) {
      let header = ele.append('div')
        .classed('fw_header fw_row', true);
      this._appendTitle(header);
      this._appendTaskButtons(header);
    }

    _appendTitle (ele) {
      ele.append('div')
        .attr('class', 'fw_title')
        .text(this.field.name);
    }

    _appendCategoricalButtons (ele) {
      let toolbar = ele.append('div')
        .attr('class', 'fw_toolbar');

      let allButton = toolbar.append('div')
        .attr('class', 'fw_toolbar__button')
        .text('all')
        .on('click', () => this.selectAll());
      let noneButton = toolbar.append('div')
        .attr('class', 'fw_toolbar__button')
        .text('none')
        .on('click', () => this.selectNone());
      let invertButton = toolbar.append('div')
        .attr('class', 'fw_toolbar__button')
        .text('inv')
        .on('click', () => this.selectInverted());
    }

    /**
     * Appends buttons for
     *  * confirm: apply filter to managed Filter-Usage
     *  * abort: abort and revert FilterWidget to current value of FilterUsage
     *  * remove: destroy FilterWidget
     * @param ele
     * @private
     */
    _appendTaskButtons (ele) {
      let taskbar = ele.append('div')
        .attr('class', 'fw_taskbar');

      taskbar.append('div')
        .attr('class', 'fw_taskbar__button')
        .text('C')
        .on('click', () => this.commit());

      taskbar.append('div')
        .attr('class', 'fw_taskbar__button')
        .text('A')
        .on('click', () => {console.log("todo: reset to previous state")});

      taskbar.append('div')
        .attr('class', 'fw_taskbar__button')
        .text('R')
        .on('click', () => this.emit("RemoveEvent"));
    }

    _appendExplicitValueForm (ele) {
      let form = ele.append('div')
        .classed('fw_valueForm fw_row', true);

      form.append('div')
        .classed('fw_valueForm__label', true)
        .text(this.dType === 'string'?'any of:':'in range:');

      // add handlers that
      //  (i) push text changes to this.domain
      //  (ii) convert given domain to text
      let pushHandler, pullHandler;
      if (this.dType === 'string') {

        let that = this;  // handler is called with different 'this'. see below
        pushHandler = function(ev) {
          let newDomainStr = this.value; // this refers to the triggering DOM element

          // 1. parse to list of strings
          let labelLst = newDomainStr.split(",").map(el => el.trim());

          let valid = true;
          let newDomain = new Set();
          for (let item of labelLst) {
            // 2. validate with actual domain, and ...
            if (!that.fullDomain.includes(item)) {
              valid = false;
              break;
            }
            // 3. assign to domain
            newDomain.add(that.fullDomain.indexOf(item));
          }

          if (labelLst.length === 0)
            valid = false;

         that._textInput.classed('fw_valueForm__directInput--invalid', !valid);

          if (valid) {
            that.domain = newDomain;
            that.labels = labelLst;
            that.render();
          }

        };

        pullHandler = () => {
          // domain consists of integers ...
          let value = [...this.domain.values()].map(i => this.fullDomain[i]).join(", ");
          if (value.length === 0)
            value = "<none selected>";

          this._textInput.property('value', value);
        };

      } else if (this.dType === 'numerical') {

        let that = this;  // handler is called with different 'this'. see below
        pushHandler = function(ev) {
          try {
            let newDomain = this.value.split("--");  // this refers to the triggering DOM element
            if (newDomain.length !== 2)
              throw("ParseError");
            newDomain = [+newDomain[0], +newDomain[1]]; // parse to number
            if (newDomain[0] > newDomain[1] || !_.isFinite(newDomain[0]) || !_.isFinite(newDomain[1]) )
              throw("ParseError");

            that.domain = newDomain;
            that._textInput.classed('fw_valueForm__directInput--invalid', false);
            that.render();
          } catch (err) {
            that._textInput.classed('fw_valueForm__directInput--invalid', true);
          }
        };

        pullHandler = () => {
          this._textInput.property('value', formatter(this.domain[0]) + " -- " + formatter(this.domain[1]));
        };
      } else {
        throw RangeError("Not implemented!")
      }

      this._textInput = form.append('input')
          .classed('fw_valueForm__directInput', true)
          .attr('type','text')
          .attr('name','textInput')
          .attr('spellcheck', false)
          .on('input', pushHandler);

      this._textInput.pullHandler = pullHandler;
    }

    _appendPlot (ele) {
      this.plot = ele.append('div')
        .classed('fw_plot fw_row', true)[0][0];
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
      })
    }

    initQuantitative(layout, trace) {
      this.direction = 'horizontal';
      layout = Object.assign(layout, {
        xaxis: {
          rangeslider: {
            visible: true,
            //thickness: 0.5, // TODO: this seems not to work for large values
          },
          // rangeselector: {
          //   visible: true,
          // },
          showgrid: false,
          zeroline: false,
          ticklen: 3,
          showticklabels: true,
          visible: true,
        },
        yaxis: {
          fixedrange: true,
          showgrid: true,
          showticklabels: false,
          rangemode: "tozero",
          zeroline: true,
          visible: true,
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
        this.render();
      });
    }

    _convertDataToTrace(data) {
      let [x, y] = _.unzip(data);
      return (this.direction === 'horizontal' ? {x: [x], y: [y]} : {x: [y], y: [x]});
    }

    selectAll () {
      if (this.dType === 'string') {
        this.domain = new Set(_.range(this.fullDomain.length)); // need the indices!
        this.labels = new Set(this.fullDomain.values());
      }
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
      this.labels = new Set();
      this.render();
    }

    selectInverted () {
      if (this.dType === 'string') {
        let invDomain = new Set(),
         invLabel = new Set(),
         allLabels = [...this.fullDomain.values()];
        for (let i of _.range(this.fullDomain.length)) {
          if (!this.domain.has(i)) {
            invDomain.add(i);
            invLabel.add(allLabels[i]);
          }
        }
        this.domain = invDomain;
        this.labels = invLabel;
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
    render(recalc = true) {
      // render plot
      Plotly.update(
            this.plot,  // plot DOM element
            Object.assign({}, this._dataTrace, this.makeTraceUpdate4Selection()),  // data update
            Object.assign({}, this._dataTrace, this.makeLayoutUpdate4Selection())  // layout update
       );

      // update text field
      this._textInput.pullHandler();
    }

    /**
     * Commit the current state of the widget to the managed Filter.
     */
    commit() {
      let f = this.filter,
        args;

      if (this.dType === 'string') {
        args = new Domain.Discrete([...this.labels.values()]);
      } else {
        args = new Domain.Numeric(this.domain.slice());
      }

      let change = {
        'type': 'fu.args.changed',
        'class': f.constructor.name,
        'name': f.name,
        'value.old': f.args,
        'value.new': args,
      };
      f.args = args;
      // TODO: filter itself should emit this signal. also see visuals.js - there is more such emitted signals
      f.emit(Emitter.InternalChangedEvent, change);
    }
  }

  return FilterWidget;
});