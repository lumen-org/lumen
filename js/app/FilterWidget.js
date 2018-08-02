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
   selected domain

methods:
   render(): (re)draw with current state

events
   triggers Emitter.InternalChangedEvent on the Field if it changes a Fields domain?
      I think this one. it separates the concerns better?
   triggers its own changed event that I can then connect to the Fields changed event?

implements:
   PQL.Filter.prototype.makeVisual:



no react. It is not very "html-lastig"
*/

define([/*plotly !!*/], function ( ) {
  "use strict";

  class FilterWidget {
    constructor (field, densityPromise, container) {
      this.field = field;
      this.container = container;
      this._densityPromise = densityPromise;
      this._dataTrace = undefined;
      let initialTrace, layout;
      // by default categorical histogram is drawn vertically, such that names have enough space,
      // and quantitative density plots are drawn horizontally because it is more familiar
      // TODO: do violin plots for data vs model?
      //this.direction = (this.field.dataType === 'string' ? 'horizontal' : 'vertical');

      if (this.field.dataType === 'string') {
        this.direction = 'vertical';
        layout = {
          xaxis: {
            fixedrange: true,
            showticklabels: false,
          },
          yaxis: {
            fixedrange: true,
          }
        };
        initialTrace = {
          type: 'bar',
          orientation: 'h',
        };
      } else if (this.field.dataType === 'numerical') {
        this.direction = 'horizontal';
        layout = {
          xaxis: {
            //rangeslider: {},
            showgrid: false,
            zeroline: false,
            ticklen: 3,
            //showticklabels: false,
          },
          yaxis: {
            fixedrange: true,
            showgrid: true,
            showticklabels: false,
            rangemode: "tozero",
            zeroline: true,
          }
        };        
        initialTrace = {
          type: 'scatter',
        };
      } else {
        throw "invalid data type or data type not implemented!";
      }

      layout = Object.assign(layout, {
        margin: {
          l: 80,
          t: 10,
          r: 10,
          b: 10,
          pad: 3}
      });
      
      // make initial plot. will be updated on request later
      Plotly.newPlot(container[0], [initialTrace], layout);

      // trigger initial getting of data
      this.render();
    }

    _convertDataToTrace(data) {      
      let [x,y] = _.unzip(data);
      return (this.direction === 'horizontal' ? {x:[x],y:[y]} : {x:[y],y:[x]} );
    }

    render (recalc=true)  {
      // recalc data if necessary or requested
      let promise;
      if (recalc || this.density === undefined) {
        promise = this._densityPromise().then( data => this._convertDataToTrace(data) );
      } else {
        promise = Promise.resolve(this.densityData);
      }

      // update plot when data is fetched
      promise.then(
        dataTrace => {
          this._dataTrace = dataTrace;
           Plotly.restyle(this.container[0], dataTrace);
        }
      );
    }
  }

  return FilterWidget;
});