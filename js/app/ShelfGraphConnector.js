/**
 * @module interaction
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger', './interaction', './PQL', './shelves', './visuals', './VisMELShelfDropping'], function (Logger, inter, PQL, sh, vis, drop) {
  'use strict';

  var logger = Logger.get('pl-ShelfGraphConnector');
  logger.setLevel(Logger.INFO);


  /**
   * Given a Shelf return the first record that has content that is a Field with name == dimName.
   * @param shelf
   * @param dimName
   */
  function getRecordByDimensionName(shelf, dimName) {
    for (let record of shelf) {
      let field = record.content;
      if (PQL.isField(field) && field.name === dimName)
        return record;
    }
    return undefined;
  }

  /**
   * Connect the GraphWidget widget and the shelves, i.e. enable dragging and dropping between them.
   * @param widget
   * @param shelves
   */
  function connect(widget, shelves) {
    /*
   * These are specific handlers for the dragging and dropping of nodes of a GraphWidget onto Shelves and Records,
   * i.e. they are the glue between these otherwise unrelated objects.
   *
   * The handlers need the context of the shelves - which provided by this closure.
   */
    const handler = {

      // not really needed
      dragEnter: (ev) => {
        logger.debug("enter")
      },

      dragLeave: ({event, dragged}) => {
        logger.debug("leave");
        inter.clearHighlight(event.currentTarget);
      },

      // adaption of ShelfInteractionMixin
      'drop': function ({event, dragged}) {
        let fieldName = dragged.node.data('id');
        logger.debug("drop of " + fieldName);

        let $curTarget = $(event.currentTarget), // is shelf-visual
          $target = $(event.target); // is shelf-visual or record-visual
        // a drop may also occur on the record-visuals - however, we 'delegate' it to the shelf. i.e. it will be bubble up
        if ($curTarget.hasClass('shelf')) {
          logger.debug('dropping on');
          logger.debug($curTarget);
          logger.debug($target);

          let targetShelf = $curTarget.data(vis.AttachStringT.shelf),
            // find closest ancestor that is a shelf-list-item
            target = $target.parentsUntil('.shelf', '.shelf-list-item');

          target = (target.length === 0 ? targetShelf : target.data(vis.AttachStringT.record));

          // get source!
          let source = getRecordByDimensionName(shelves.dim, fieldName);
          if (source === undefined)
            source = getRecordByDimensionName(shelves.meas, fieldName);
          if (source === undefined)
            throw RangeError("INTERNAL ERROR: could not find matching record");

          let overlap = inter.overlap([event.pageX, event.pageY], event.target);

          drop(target, source, overlap);
          //event.stopPropagation();
          event.preventDefault();
        }
        inter.clearHighlight(event.currentTarget);
      },

      // needed: need to trigger a 'dragover' event on the target element. it requires the correct position of the event to be set - because it triggers the highlighting!
      dragOver: ({event, dragged}) => {
        let mousePos = [event.pageX, event.pageY],
          dropElem = event.currentTarget,
          overlap = inter.overlap(mousePos, dropElem);
        inter.setHighlight(dropElem, overlap);
        event.preventDefault();
      }

    };

    // make widget nodes draggable
    widget.draggable();

    for (const key of Object.keys(shelves)) {
      let shelf = shelves[key];

      // add all shelves and existing records as drop targets
      widget.addDropTarget(shelf.$visual[0], handler);
      for (const record of shelf)
        widget.addDropTarget(record.$visual[0], handler)

      // listen for any added or deleted drop targets
      shelves[key].on(sh.Shelf.Event.Add,
          record => widget.addDropTarget(record.$visual[0], handler));
    }
  }

  return {
    connect,
  };
});