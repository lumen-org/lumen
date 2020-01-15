/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define(['lib/emitter', '../VisUtils'], function (Emitter, VisUtils) {

  'use strict';


  /**
   * A SplitWidget is an editable UI to a `SplitUsage`.
   *
   * Draw Management:
   *    Initially we create all containers that we always need. This is done by the make.* methods. Then, whenever anything is changed by the user, we render the whole widget again.
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
      let headOpts = {
        withRemoveButton: true,
        removeHandler: ()=>this.remove()
      };
      this.split = split;  // the managed FilterUsage
      this._modifiedSplit = split.copy();
      this.dType = this.split.yieldDataType;  // {String} Either "string" for categorical or "numerical" for quantitative data
      this.$container = $(container)  // the DOM element that holds the widget
        .addClass('sw_container')
        .append(VisUtils.head(split, headOpts))
        .append('<div class="pl-text">split into</div>')
        .append('<div class="fu_method-config"></div>')
        .append('<div class="fu_method-selector"></div>')
        .append(VisUtils.controlButtons(
          () => this.commit(), () => this.reset(), () => this.close())
        );

      this._makeMethodSelector();
      this._makeMethodConfigurator();
      this.render();
    }


    /**
     * Creates a method selector
     * @private
     */
    _makeMethodSelector () {

      // build data list of valid options
      // note that the dtype of the split may not change!
      let $methodList = $('<datalist id="split-methods"></datalist>'),
        methodOpts = [];
      if (this.dType === 'string') {
        methodOpts.push('elements');
      } else if (this.dType === 'numerical') {
        methodOpts.push('equiinterval');
      } else
        throw "unsupported yield type of split: " + this.dType;
      $methodList.append(methodOpts.map( val => $("<option>").attr('value',val).text(val)));

      // create model select input
      this._methodSelector = $('.fu_method-selector', this.$container)
        .append('<div class="pl-label fu_method-selector__label">method:</div>')
        .append('<input class="pl-fu__direct-input pl-input" type="text" list="split-methods"/>')
        .append($methodList);

      let $directTextInput = $('.pl-fu__direct-input', this._methodSelector);

      function setValid(flag) {
        $directTextInput.toggleClass('pl-fu__direct-input--invalid', !flag);
      }

      // when user made a valid input, adopt widget accordingly
      $directTextInput.on('input',
        (ev) => {
          let val = $directTextInput.val();
          if (methodOpts.includes(val)) {
            this._modifiedSplit.method = val;
            setValid(true);
          } else {
            setValid(false);
          }
        });

      // update/render the selector, i.e. pull from widget state
      this._methodSelector.render = () => {
        $directTextInput.val(this._modifiedSplit.method);
      };
    }

    _makeMethodConfigurator () {
      this._methodConfigurator = $('.fu_method-config', this.$container);

      // update/render the selector, i.e. pull from widget state
      this._methodConfigurator.render = () => {
        this._methodConfigurator.html('');
        if (this.dType === 'numerical') {
          this._methodConfigurator.show();
          this._makeSplitCountSlider();
        } else {
          this._methodConfigurator.hide();
        }
      }
    }

    _makeSplitCountSlider () {

      let $splitSlider = $('<div class="sw_split-slider"></div>')
        .appendTo(this._methodConfigurator);

      let $handle = $('<div class="ui-slider-handle sw_split-slider__handle pl-label"></div>')
        .appendTo($splitSlider);

      $splitSlider.slider({
        range: "min",
        value: this._modifiedSplit.args[0],
        min: 1,
        step: 1,
        max: 50,
        create: () => $handle.text($splitSlider.slider("value")),
        slide: (event, ui) => {
          $handle.text(ui.value);
          this._modifiedSplit.args = [ui.value];
        },
      });

      return $splitSlider;
    }

    /**
     * Redraws the widget.
     */
    render() {
      this._methodSelector.render();
      this._methodConfigurator.render();
      this.emit('pl.Split.Changed');
    }

    /**
     * Commit the current state of the widget to the managed Split.
     */
    commit() {
      this.split.method = this._modifiedSplit.method;
      this.split.args = this._modifiedSplit.args.slice();
      this.render();

      // TODO: add this?
      // let change = {
      //   'type': 'fu.args.changed',
      //   'class': f.constructor.name,
      //   'name': f.name,
      //   'value.old': f.args,
      //   'value.new': args,
      // };

      // TODO: split itself should emit this signal. also see visuals.js - there is more such emitted signals
      this.split.emit(Emitter.InternalChangedEvent /*, change*/);
      this.emit('pl.Split.Commit'/*, change*/);

    }

    /**
     * Reset the current changes to Filter and reload the last commited state to the widget.
     */
    reset () {
      this._modifiedSplit = this.split.copy();
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