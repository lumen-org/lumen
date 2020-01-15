/* copyright © 2020 Philipp Lucas (philipp.lucas@dlr.de) */

define(['lib/emitter', '../shelves'], function (Emitter, sh) {

  /**
   * A widget that lets you create Posterior Predictive Check visualizations.
   */
  class PosteriorPredictiveCheckWidget {

    constructor(context, infobox) {
      let that = this;
      that._context = undefined;
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

      // currently it's static, but may be dynamic in future:
      that._$testQuantityList = $('<datalist id="ppc-test-quantities"></datalist>');
      for (let q of test_quantities)
        that._$testQuantityList.append($("<option>").attr('value', q).text(q));

      that._$selectTestQuantity = $('<div class="pl-ppc__section"></div>').append(
          ('<div class="pl-h2 pl-ppc__h2">test quantity</div>'),
          ('<input class="pl-input pl-ppc__input" type="text" list="ppc-test-quantities" value="median">'),
          that._$testQuantityList
      );

      that.ppcShelf = new sh.Shelf(sh.ShelfTypeT.single);
      that.ppcShelf.beVisual({label: 'drop here for PPC'}).beInteractable();

      that.ppcShelf.on(Emitter.ChangedEvent, event => {
        //infoBox.message("PPCs not implemented yet.");
        let fields = that.ppcShelf.content(),
            promise = that._context.model.ppc(fields, {k: 10, n: 3, TEST_QUANTITY: 'median'});

        promise.then(
            res => {
              that._infobox.message("received PPC results!");
              console.log(res.toString());
            }
        );
      });

      that.$visual = $('<div class="pl-ppc"></div>')
          //             .append('<div class="pl-h2"># of repetitions</div>')
          .append(this._$selectK)
          .append(this._$selectN)
          .append(this._$selectTestQuantity)
          .append(this.ppcShelf.$visual);
    }

    /**
     * Sets the context that it controls.
     * @param context A context.
     */
    setContext(context) {
      // if (!(context instanceof Context))
      //   throw TypeError("context must be an instance of Context");
      this._context = context;
    }

  }

  return PosteriorPredictiveCheckWidget
});
