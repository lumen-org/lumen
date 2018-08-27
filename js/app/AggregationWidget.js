/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define(['lib/emitter', './PQL', './VisUtils'], function (Emitter, PQL, VisUtils) {

  'use strict';


  /**
   * A AggregationWidget is an editable UI to a `AggregationUsage`.
   *
   * Draw Management:
   *    Initially we create all containers that we always need. This is done by the make.* methods. Then, whenever anything is changed by the user, we render the whole widget again.
   *
   * State Management:
   *    The state of the widget and the state of
   *
   * Signals:
   *    The following signals are emitted:
   *    * pl.Aggregation.Commit
   *    * pl.Aggregation.Reset
   *    * pl.Aggregation.Change
   *    * pl.Aggregation.Close
   *    * pl.Aggregation.Remove
   */
  class AggregationWidget {

    /**
     * @param aggregation {PQL.Aggregation} The AggregationUsage to manage.
     * @param container The DOM node to contain the widget. The widget owns the container.
     */
    constructor (aggregation, container) {
      Emitter(this);

      //this.field = aggregation.field;  // the field of the FilterUsage
      this.aggregation = aggregation;  // the managed FilterUsage
      this._modifiedAggregation = aggregation.copy();
      this.dType = this.aggregation.yieldDataType;  // {String} Either "string" for categorical or "numerical" for quantitative data
      this.$container = $(container)  // the DOM element that holds the widget
        .addClass('sw_container')
        .append(VisUtils.head(aggregation, ()=>this.remove()))
        .append('<div class="pl-text">aggregate to</div>')
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
      // note that the dtype of the aggregation may not change!
      let $methodList = $('<datalist id="aggregation-methods"></datalist>'),
        methodOpts = [];
      methodOpts.push(PQL.AggrMethod.argmax);
      if (this.dType === 'numerical') {
        methodOpts.push(PQL.AggrMethod.argavg);
      }
      $methodList.append(methodOpts.map( val => $("<option>").attr('value',val).text(val)));

      // create model select input
      this._methodSelector = $('.fu_method-selector', this.$container)
        .append('<div class="pl-label fu_method-selector__label">method:</div>')
        .append('<input class="pl-fu__direct-input pl-input" type="text" list="aggregation-methods"/>')
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
            this._modifiedAggregation.method = val;
            setValid(true);
          } else {
            setValid(false);
          }
      });

      // update/render the selector, i.e. pull from widget state
      this._methodSelector.render = () => {
        $directTextInput.val(this._modifiedAggregation.method);
      };
    }

    _makeMethodConfigurator () {
      this._methodConfigurator = $('.fu_method-config', this.$container);

      // update/render the selector, i.e. pull from widget state
      this._methodConfigurator.render = () => {
        // currently, there is nothing to configure ...
        this._methodConfigurator.hide();
      }
    }

    /**
     * Redraws the widget.
     */
    render() {
      this._methodSelector.render();
      this._methodConfigurator.render();
      this.emit('pl.Aggregation.Changed');
    }

    /**
     * Commit the current state of the widget to the managed Aggregation.
     */
    commit() {
      this.aggregation.method = this._modifiedAggregation.method;
      this.aggregation.args = this._modifiedAggregation.args.slice();
      this.render();

      // TODO: add this?
      // let change = {
      //   'type': 'fu.args.changed',
      //   'class': f.constructor.name,
      //   'name': f.name,
      //   'value.old': f.args,
      //   'value.new': args,
      // };

      // TODO: aggregation itself should emit this signal. also see visuals.js - there is more such emitted signals
      this.aggregation.emit(Emitter.InternalChangedEvent /*, change*/);
      this.emit('pl.Aggregation.Commit'/*, change*/);

    }

    /**
     * Reset the current changes to Filter and reload the last commited state to the widget.
     */
    reset () {
      this._modifiedAggregation = this.aggregation.copy();
      this.render();
      this.emit('pl.Aggregation.Reset');
    }

    /**
     * Call this to request to close the widget. It just emits a pl.Filter.Close signal which should be listened to by the widget owning parent, and the closing should happend there.
     */
    close () {
      this.emit('pl.Aggregation.Close');
    }

    /**
     * Call this to request to delete/remove the managed Aggregation.. It emits a pl.Aggregation.Close and pl.Aggregation.Delete signal which should be listened to by the widget owning parent, and the actual removal of the managed filter must happend there.
     */
    remove () {
      this.emit('pl.Aggregation.Close');
      this.emit('pl.Aggregation.Remove');
    }

  }

  return AggregationWidget
});