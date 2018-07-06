/**
 * @module interaction
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger', './PQL'], function (Logger, PQL) {
  'use strict';

  var logger = Logger.get('pl-ShelfGraphConnector');
  logger.setLevel(Logger.DEBUG);


  /**
   * Given a Shelf return the first record that has content that is a Field with name == dimName.
   * @param shelf
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
    let handler = {

      // not really needed
      dragEnter: (ev) => console.log("enter"),

      // not really needed
      dragLeave: (ev) => console.log("leave"),

      // adaption of ShelfInteractionMixin
      'drop': function ({event, dragged}) {
        console.log("drop of " + dragged.field.toString());

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

          // how to get source!?
          let source = getRecordByDimensionName(shelves.dim, dragged.field.name);
          if (source === undefined)
            source = getRecordByDimensionName(shelves.meas, dragged.field.name);
          if (source === undefined)
            throw RangeError("INTERNAL ERROR: could not find matching record");

          // find correct record in schema shelves
          //let source = $(_draggedElem).data(vis.AttachStringT.record),

          let overlap = inter.overlap([event.pageX, event.pageY], event.target);

          drop(target, source, overlap);

          event.stopPropagation();
          event.preventDefault();
        }
        inter.clearHighlight(event.currentTarget);
      },

      // needed: need to trigger a 'dragover' event on the target element. it requires the correct position of the event to be set - because it triggers the highlighting!
      dragOver: ({event, dragged}) => {
        console.log("over");
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
      widget.addDropTarget(shelf.$visual, handler);
      for (const record of shelf)
        widget.addDropTarget(record.$visual, handler)

      // listen for any added or deleted drop targets
      shelves[key].on(sh.Shelf.Event.Add,
          record => widget.addDropTarget(record.$visual, handler));
      // shelves[key].on(sh.Shelf.Event.Remove,
      //   record => widget.addDropTarget(record.$visual, handlers));
    }
  }


  return {
    connect,
  };
});