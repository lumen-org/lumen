/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define(['lib/emitter', './VisUtils'], function (Emitter, VisUtils) {

  'use strict';


  /**
   * A SplitWidget is an editable UI to a `SplitUsage`.
   *
   * State Management:
   *    The state of the widget and the state of
   *
   * Signals:
   *    The following signals are emitted:
   *    * pl.Split.Commit
   *    * pl.Split.Reset
   *    * pl.Split.Change
   *    * pl.Split.Close
   *    * pl.Split.Remove
   */
  class SplitWidget {

    /**
     * @param split {PQL.Split} The SplitUsage to manage.
     * @param container The DOM node to contain the widget. The widget owns the container.
     */
    constructor (split, container) {
      Emitter(this);

      //this.field = split.field;  // the field of the FilterUsage
      this.split = split;  // the managed FilterUsage
      this.dType = this.split.yieldDataType;  // {String} Either "string" for categorical or "numerical" for quantitative data
      this.container = container;  // the DOM element that holds the widget

      let $container = $(container)
        .addClass('sw_container')
        .append(VisUtils.head(split, ()=>this.remove()))
        .append('<div class="pl-text">split into</div>')
        .append('<div class="sw_method-config"></div>')
        .append('<div class="sw_method-selector"></div>')
        .append(VisUtils.controlButtons(
          () => this.commit(), () => this.reset(), () => this.close())
        );

      this._makeMethodSelector();
      this._makeSplitCountSlider();
      this.render();
    }


    /**
     * Creates a method selector
     * @private
     */
    _makeMethodSelector () {

      // build data list of valid options
      let $methodList = $('<datalist id="split-methods"></datalist>'),
        methodOpts = [];
      if (this.dType === 'string') {
        methodOpts.push('elements');
      } else if (this.dType === 'numerical') {
        methodOpts.push('equiinterval');
      } else
        throw "unsupported yield type of split: " + this.dType;
      $methodList.append(methodOpts.map( val => $("<option>").attr('value',val).text(val)));

      this._methodSelector = $('.sw_method-selector', this.container)
        .append('<div class="pl-label sw_method-selector__label">method:</div>')
        .append('<input class="pl-fu__direct-input pl-input" type="text" list="split-methods"/>')
        .append($methodList);

      // update/render the selector, i.e. pull from widget state
      this._methodSelector.render = () => {

      };

    }


    _makeSplitCountSlider () {

      let $splitSlider = $('<div class="sw_split-slider"></div>')
        .appendTo($('.sw_method-config'), this.container);

      let $handle = $('<div class="ui-slider-handle sw_split-slider__handle pl-label"></div>')
        .appendTo($splitSlider);

      $splitSlider.slider({
        range: "min",
        value: this.split.args[0],
        min: 1,
        step: 1,
        max: 50,
        create: () => $handle.text($splitSlider.slider("value")),
        slide: (event, ui) => {
          $handle.text(ui.value);
          //this.render();
          //this.emit('pl.Split.Changed')
        },
      });

    }

    /**
     * Redraws the widget.
     */
    render() {

      // redraw method config

      // redraw method selector


      // old:

      // render plot
      // TODO.
      // Plotly.update(
      //   this.plot,  // plot DOM element
      //   Object.assign({}, this._dataTrace, this.makeTraceUpdate4Selection()),  // data update
      //   Object.assign({}, this._dataTrace, this.makeLayoutUpdate4Selection())  // layout update
      // );

      // update text field
      // this._textInput.pullHandler();

      this.emit('pl.Split.Changed');
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
      this.emit('pl.Split.Commit', change);
    }

    /**
     * Reset the current changes to Filter and reload the last commited state to the widget.
     */
    reset () {
      console.log("not implemented!");
      // get state from this.split
      // ...
      // finally render
      this.render();
      this.emit('pl.Split.Reset');
    }

    /**
     * Call this to request to close the widget. It just emits a pl.Filter.Close signal which should be listened to by the widget owning parent, and the closing should happend there.
     */
    close () {
      this.emit('pl.Split.Close');
    }

    /**
     * Call this to request to delete/remove the managed Split.. It emits a pl.Split.Close and pl.Split.Delete signal which should be listened to by the widget owning parent, and the actual removal of the managed filter must happend there.
     */
    remove () {
      this.emit('pl.Split.Close');
      this.emit('pl.Split.Remove');
    }

  }

  return SplitWidget
});