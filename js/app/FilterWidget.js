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

define([/*plotly*/], function ( ) {
  "use strict";

  class FilterWidget {
    constructor (field, densityPromise, container) {

      // assert categorical dim
      // if (field.dtype !== 'string') {
      if (field.dataType !== 'numerical') {
        throw "Not yet implemented!";
      }

      this._densityPromise = densityPromise;

      // by default categorical histogram is drawn vertically, such that names have enough space,
      // and quantitative density plots are drawn horizontally because it is more familiar
      // TODO: do violin plots for data vs model?
      this.field = field;
      this.direction = 'horizontal';
      this.container = container;
      this._layout = {
        xaxis: {
          rangeslider: {},
        },
        yaxis: {
          fixedrange: true,
        }
      };      
      this._dataTrace = undefined;
      
      // make initial plot. will be updated on request later
      Plotly.newPlot(container[0], [{'type':'scatter'}], this._layout);

      // trigger initial getting of data
      this.render();
    }


    _convertDataToTrace(data) {
      if (this.field.dataType === 'numerical')
        if (this.direction === 'horizontal') {
          let [x,y] = _.unzip(data);
          return {x:[x],y:[y]}
        }
      throw("not implemented!");
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