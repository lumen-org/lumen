define(['app/shelves','app/utils'], function(s, util) {
  'use strict';

  /*var LayoutT = Object.freeze({
    vertical: 'vertical',     // title goes in its own row, so does each record this shelf holds
    horizontal: 'horizontal', // all on one row
    box: 'box'
  });*/

  /**
   * A mixin function that creates a visual representation (as HTML elements)
   * of the shelf and its records. The root of this returned.
   * This will add attributes to shelf: $visual
   * @param {Shelf} shelf The shelf to become a visual.
   */
  function asVisualShelf (shelf, typeString, opt) {

    opt = util.selectValue(opt, {});
    //opt.direction = util.selectValue(opt.direction, build.DirectionType.vertical);
    opt.label = util.selectValue(opt.label, typeString);

    // create visual container
    var visual = $('<div></div>')
      .addClass('shelf');

    if (opt.id) {
      visual.attr('id', opt.id);
    }

    // create label
    //var label = build.DirectionElement[opt.direction];
    //$(label)
    $('<div></div>')
      .addClass('shelf-title')
      .text(opt.label)
      .appendTo(visual);

    // create element container
    var container = $('<div></div>').addClass('shelf-list')
      .appendTo(visual);

    // attach type and direction
    //visual.data(build.ShelfTypeString, typeString);
    //visual.data(build.DirectionString, opt.direction);

    // extend the shelf
    shelf.$visual = visual;
    shelf.$visual.container = container;

    // make all records visual too
    switch (shelf.type) {
      case s.ShelfTypeT.singletonShelf:
        asVisualRecord(shelf.record);
        break;
      case s.ShelfTypeT.multiShelf:
        shelf.records.forEach(asVisualRecord);
        break;
    }

    // return root html element
    return visual;
  }


  /**
   * A mixin function that creates a simple visual representation (as HTML elements) of this record. The root of representation is returned. It is also attaches as the attribute 'visual' to the record and added to the parent shelf.
   * @param record
   */
  function asVisualRecord (record) {
    // build visual
    //var visual = $(build.DirectionElement[shelf.data(build.DirectionString)]);
    var visual = $('<div></div>');
    visual.addClass('shelf-list-item')
      .text(record.content.name);
    //makeItemDraggable(item);
    //makeItemDroppable(item);

    // add to shelf

    // todo: add to the correct relative position!
    visual.appendTo(record.shelf.$visual.container);

    // add to record
    record.$visual = visual;

    return visual;
  }

  // public part of the module
  return {
    asVisualRecord:asVisualRecord,
    asVisualShelf:asVisualShelf
  };
});