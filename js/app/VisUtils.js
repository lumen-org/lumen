define([], function () {

  'use strict';

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

    if (confirmHandler) {
      $buttons.append($('<div class="pl-button pl-fu__control-button">Confirm</div>'))
        .on('click', confirmHandler);
    }

    if (resetHandler) {
      $buttons.append($('<div class="pl-button pl-fu__control-button">Cancel</div>'))
        .on('click', resetHandler);
    }

    if (closeHandler) {
      $buttons.append($('<div class="pl-button pl-fu__control-button">Close</div>'))
        .on('click', closeHandler);
    }

    return $buttons;
  }

  return {
    head,
    moreOnClick,
    controlButtons,
  };

});