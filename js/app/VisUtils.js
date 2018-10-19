/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define(['lib/emitter', './PQL', './VisMEL'], function (Emitter, PQL, VisMEL) {

  'use strict';

  /**
   * Make DOM node `modalNode` pop-up in front if it is clicked on parentNode. This is, modelNode will be like a modal dialog always in front, until it is clicked anywhere outside of it or the close handler is called. The close handler is returned.
   *
   * Modal node is hidden automatically when makeModel is called.
   *
   * @param parentNode
   * @param modalNode
   * @return {Function} The close handler.
   */

  function makeModal (parentNode, modalNode) {

    let modelIsOpen = false; // prevent multiple modal overlays
    let modalBackground = undefined; // is created when the parent is clicked

    modalNode = $(modalNode)
      .addClass('pl-modal__foreground')
      .hide()
      .on('dragstart', ev => {ev.preventDefault(); ev.stopPropagation();}); // modal dialogs are not draggable
    parentNode = $(parentNode);

    let closeHandler = () => {     
      if (modelIsOpen) {
        modalNode.hide();
        modalBackground.remove();
        modelIsOpen = false;
      }
    };

    // register as modal dialog, i.e.:
    // * hide by default
    // * if parent is clicked: show dialog
    // * if then clicked anywhere but the dialog: hide dialog
    parentNode.on('click', e => {
      if (!modelIsOpen) {
        modelIsOpen = true;
        // append clickable background and register close handler
        modalBackground = $("<div class='pl-modal__background'></div>")
          .appendTo('body')
          .on("click", closeHandler)
          .show();
        modalNode.show();
        e.stopPropagation();
      }
    });

    return closeHandler;
  }

  function moreOnClick (onClickHandler) {
    return $('<div class="pl-button pl-fu__click4more">></div>')
      .on('click.pl-field', onClickHandler);
  }

  function defaultHeadOpts (record) {
    return {
      withRemoveButton: true,
      removeHandler: () => record.remove(),
      withConversionButton: true,
      record: record,
      withClick4more: false,
      click4moreHandler: () => {}, // handled anyway by click on fu
    };
  }

  /**
   * Return a string of an img element that contains the requested icon and has classes 'pl-icon' and 'pl-icon--${name}'.
   * @param iconName Icon name to load
   * @return {string}
   */
  function icon (iconName) {
    return `<img class="pl-icon pl-icon--${iconName}$" alt="${iconName}" src="./images/${iconName}.svg">`
  }

  /**
   * Return a new button as a jQuery selection.
   * @param label The label of the button.
   * @param iconName The name of the icon to use for the button. Must be available as <iconName>.svg under './images'.
   * @return {jQuery}
   */
  function button (label, iconName) {
    return $('<div class="pl-button"></div>')
      .append(icon(iconName))
      .append(`<span class="pl-label">${label}</span>`);
  }

  function removeButton () {
    return $('<img class="pl-button pl-remove-button pl-icon pl-icon__close pl-hidden" alt="close" src="./images/close.svg">');
  }

  function head (fu, opts={}) {
    let $head = $('<div class="pl-fu__head"></div>');

    // remove button
    if (opts.withRemoveButton)
      removeButton()
        .on('click.pl-remove-button', opts.removeHandler)
        .appendTo($head);

    // field name(s)
    let $fieldNames = $('<div class="pl-fu__field-names"></div>'),
      names = (fu.names ? fu.names : [fu.name]);
    for (let name of names) {
      $(`<div class="pl-field-name pl-fu__field-name">${name}</div>`).appendTo($fieldNames);
    }
    $head.append($fieldNames);

    // conversion button
    if (opts.withConversionButton)
      conversionButton(opts.record)
        .appendTo($head);

    // click4more
    if (opts.withClick4more)
      moreOnClick(opts.click4moreHandler)
        .appendTo($head);

   return $head;
  }

  /**
   * Create and returns a div of buttons with registered handlers.
   * You may pass undefined to any of the handlers in order to not create the corresponding button.
   * @param confirmHandler
   * @param resetHandler
   * @param closeHandler
   */
  function controlButtons (confirmHandler, resetHandler, closeHandler) {
    let $buttons = $('<div class="pl-fu__control-buttons"></div>');

    let handleWithStopPropagation = handler => {return ev => {handler(); ev.stopPropagation();}};

    if (closeHandler) {
      button('Close', 'back')
        .addClass('pl-fu__control-button')
        .on('click', handleWithStopPropagation(closeHandler))
        .appendTo($buttons);
    }

    if (confirmHandler) {
      button('Confirm', 'confirm')
        .addClass('pl-fu__control-button')
        .on('click', handleWithStopPropagation(confirmHandler))
        .appendTo($buttons);
    }

    if (resetHandler) {
      button('Reset', 'revert')
        .addClass('pl-fu__control-button')
        .on('click', handleWithStopPropagation(resetHandler))
        .appendTo($buttons);
    }

    return $buttons;
  }

  /**
   * Creates and returns a widget to convert the given record to another FieldUsage.
   *
   * If the button is pushed the record is converted as follows:
   * * a Split to an Aggregation
   * * an Aggregation to a Split
   * * a BaseMap to the same basemap but with its FieldUsage translated as above.
   * FieldUsages other then Aggregation and Split are not allows.
   *
   * @param record {Record} The record to create a conversion button for. Its content must either be a BaseMap or a FieldUsage.
   *
   */
  function conversionButton (record) {

    function translate (record, TargetType) {
      let content = record.content,
        isBaseMap = content instanceof VisMEL.BaseMap,
        fu = isBaseMap ? content.fu : content,
        // construct new FU
        newFU = TargetType.FromFieldUsage(fu),
        // construct new Mapping if necessary
        newContent = isBaseMap ? content.constructor.DefaultMap(newFU) : newFU;

      let change = {
        'type': 'fu.translate',
        'name': fu.yields,
        'class.from': TargetType.name,
        'class.to': fu.constructor.name,
      };
      fu.emit(Emitter.InternalChangedEvent, change);

      // and replace the old one
      record.replaceBy(newContent);
    }

    // on click: convert and invert target type of this widget
    let $widget = $('<div class="pl-conversion-widget pl-hidden"></div>'),
      $conversionButton = $('<img class="pl-button pl-conversion-widget__button pl-icon pl-icon__close">')
        .appendTo($widget);

    $widget.render = () => {
      // determine target type
      let content = record.content,
        isBaseMap = content instanceof VisMEL.BaseMap,
        fu = isBaseMap ? content.fu : content;
      let src, altText, handler, oldCssClass, newCssClass;
      if (PQL.isSplit(fu)) {
        src = './images/split.svg';
        altText = 'Sp';
        handler = () => translate(record, PQL.Aggregation);
        oldCssClass = 'pl-conversion-widget__button--split';
        newCssClass = 'pl-conversion-widget__button--aggregation';
      } else if (PQL.isAggregation(fu)) {
        src = './images/aggregate.svg';
        altText = 'Aggr';
        handler = () => translate(record, PQL.Split);
        oldCssClass = 'pl-conversion-widget__button--aggregation';
        newCssClass = 'pl-conversion-widget__button--split';
      }
      $conversionButton
        .attr('src', src)
        .attr('alt', altText)
        .removeClass(oldCssClass)
        .addClass(newCssClass)
        .off('click.pl-conversion')
        .on('click.pl-conversion',
          (ev) => {
            handler();
            $widget.render();
            ev.stopPropagation();
        });
      return $widget;
    };

    return $widget.render();
  }

  return {
    head,
    defaultHeadOpts,
    moreOnClick,
    makeModal,
    controlButtons,
    conversionButton,
    icon,
    button,
    removeButton,
  };

});