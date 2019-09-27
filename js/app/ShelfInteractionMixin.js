/**
 * Adds Drag and Drop capability the visuals of to {@link module:shelves.Shelf}s and {@link module:shelves.Record}s.
 *
 * @module interaction
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger', './shelves', './VisMELShelfDropping', './visuals', './interaction'], function (Logger, sh, drop, vis, interaction) {
  'use strict';

  let logger = Logger.get('pl-ShelfInteractionMixin');
  logger.setLevel(Logger.WARN);


  /**
   * The currently dragged DOM element.
   * @private
   */
  let _draggedElem = null;

  /**
   * A fallback drop target, i.e. the lastly entered element
   * @private
   */
  let _fallBackDropTarget = null;

  /**
   * Called when a drag started on the element that was dragged.
   * @param event
   */
  function onDragStartHandler (event) {
    logger.debug('starting'); logger.debug(event.currentTarget);
    _draggedElem = event.currentTarget;
    event.dataTransfer.setData('Text', _draggedElem);
  }

  /**
   * Called on the element that a drag just left.
   * @param event
   */
  function onDragEnterHandler (event) {
    logger.debug('entering');
    logger.debug(event.currentTarget);
    _fallBackDropTarget = event.currentTarget;
    event.preventDefault();
  }

  /**
   * Called for the element that the drag is currently dragging over.
   * @param event
   */
  function onDragOverHandler (event) {
    let mousePos = [event.pageX, event.pageY];
    let dropElem = event.currentTarget;
    let overlap = interaction.overlap(mousePos, dropElem);
    interaction.setHighlight(dropElem, overlap);
    event.preventDefault();
  }

  /**
   * Called on the element that a drag just left.
   * @param event
   */
  function onDragLeaveHandler (event) {
    logger.debug('leaving');
    logger.debug(event.currentTarget);
    interaction.clearHighlight(event.currentTarget);
  }

  /**
   * Called for the element a drop occurred on.
   * @param event
   */
  function onDropHandler (event) {

    logger.debug("drop occured:");
    logger.debug(event);
    logger.debug("dragged elem:");
    logger.debug(_draggedElem);

    let $curTarget = $(event.currentTarget); // is shelf-visual
    let $target = $(event.target); // is shelf-visual or record-visual
    // a drop may also occur on the record-visuals - however, we 'delegate' it to the shelf. i.e. it will be bubble up
    if ($curTarget.hasClass('shelf')) {
      logger.debug('dropping on'); logger.debug($curTarget); logger.debug($target);
      let targetShelf = $curTarget.data(vis.AttachStringT.shelf);
      // find closest ancestor that is a shelf__item
      let target = $target.parentsUntil('.shelf','.shelf__item');
      target = (target.length === 0 ? targetShelf : target.data(vis.AttachStringT.record));
      logger.debug("dropping on target: ");
      logger.debug(target);
      let source= $(_draggedElem).data(vis.AttachStringT.record);
      let overlap = interaction.overlap([event.pageX, event.pageY], event.target);
      drop(target, source, overlap);
      _draggedElem = null;
      _fallBackDropTarget = null;
      event.stopPropagation();
      event.preventDefault();
    } else if ($curTarget.hasClass('shelf__item')) {
      logger.debug('processing drop on shelf__item - no immediate effect');
    } else {
      logger.warn('processing drop somewhere weird:');
      logger.warn(event.$currentTarget);
    }
    interaction.clearHighlight(event.currentTarget);
  }

  /**
   * @param $record The visual of a record.
   * @param flag true makes it draggable, false removes that
   */
  function _setRecordDraggable($record, flag=true) {
    $record.attr('draggable', flag);
    let domRecord = $record.get(0);
    let fct = (flag ? domRecord.addEventListener : domRecord.removeEventListener).bind(domRecord);
    fct('dragstart', onDragStartHandler);
  }

  /**
   * @param $record The visual of a record.
   * @param flag true makes it droppable, false removes that
   */
  function _setRecordDroppable($record, flag=true) {
    let domRecord = $record.get(0);
    let fct = (flag ? domRecord.addEventListener : domRecord.removeEventListener).bind(domRecord);
    fct('dragenter',  onDragEnterHandler);
    fct('dragover',  onDragOverHandler);
    fct('dragleave', onDragLeaveHandler);
    fct('drop', onDropHandler);
  }

  /**
   * @param $shelf The visual of a shelf.
   * @param flag true makes it droppable, false removes that
   */
  function _setShelfDroppable($shelf, flag=true) {
    let domShelf = $shelf.get(0);
    let fct = (flag ? domShelf.addEventListener : domShelf.removeEventListener).bind(domShelf);
    fct('dragenter', onDragEnterHandler);
    fct('dragover',  onDragOverHandler);
    fct('dragleave', onDragLeaveHandler);
    fct('drop',      onDropHandler);
  }

  /**
   * Mixin to make a Record interactable, i.e. it can be dragged and dropped on.
   * @returns {Record}
   */
  sh.Record.prototype.setInteractable = function (flag) {
    _setRecordDroppable(this.$visual, flag);
    _setRecordDraggable(this.$visual, flag);
    return this;
  };

  /**
   * Mixin to make make a shelf interactable. i.e. its records can be dragged and be dropped on and the shelf itself can be dropped on.
   * Note that it also makes all current records of that shelf interactable. Any records added to the shelf later are
   * automatically also made interactable.
   * @returns {sh.Records}
   */
  sh.Shelf.prototype.beInteractable = function () {
    _setShelfDroppable(this.$visual);
    this.records.forEach(record => record.setInteractable(true));
    this.on(sh.Shelf.Event.Add, record => record.setInteractable(true));
    this.on(sh.Shelf.Event.Remove, record => record.setInteractable(false));
    return this;
  };


  /**
   * Makes elem droppable such that any FUsageRecord dropped there is removed from its source.
   * @param {jQuery} $elem
   * @alias module:interaction.asRemoveElem
   */
  function asRemoveElem ($elem) {
    $elem.get(0).addEventListener('dragover', event => event.preventDefault());
    $elem.get(0).addEventListener('drop', event => {
      event.preventDefault();
      drop(new sh.Shelf(sh.ShelfTypeT.remove), $(_draggedElem).data(vis.AttachStringT.record), 'center');
      _draggedElem = null;
      event.stopPropagation();
    });
  }

  return {
    asRemoveElem : asRemoveElem,
  };
});