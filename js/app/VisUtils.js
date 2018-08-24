/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define([], function () {

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

    modalNode = $(modalNode).addClass('pl-modal__foreground').hide();
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

  function head (fu, removeHandler=undefined) {
    // add remove button
    let $removeButton =  $('<div class="pl-button pl-fu__remove-button">x</div>')
      .on('click.pl-remove-button', removeHandler);

    // field name(s)
    let $fieldNames = $('<div class="pl-fu__field-names"></div>'),
      names = (fu.names ? fu.names : [fu.name]);
    for (let name of names) {
      $(`<div class="pl-field-name pl-fu__field-name">${name}</div>`).appendTo($fieldNames);
    }

    return $('<div class="pl-fu__head"></div>')
      .append(removeHandler ? $removeButton : "", $fieldNames);
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

    if (confirmHandler) {
      $('<div class="pl-button pl-fu__control-button">Confirm</div>')
        .on('click', handleWithStopPropagation(confirmHandler))
        .appendTo($buttons);
    }

    if (resetHandler) {
      $('<div class="pl-button pl-fu__control-button">Reset</div>')
        .on('click', handleWithStopPropagation(resetHandler))
        .appendTo($buttons);
    }

    if (closeHandler) {
      $('<div class="pl-button pl-fu__control-button">Close</div>')
        .on('click', handleWithStopPropagation(closeHandler))
        .appendTo($buttons);
    }

    return $buttons;
  }

  return {
    head,
    moreOnClick,
    controlButtons,
    makeModal,
  };

});