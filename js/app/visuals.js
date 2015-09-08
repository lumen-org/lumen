define(['app/shelves','app/utils'], function(s, util) {
  'use strict';

  var logger = Logger.get('pl-visuals');

  var DirectionString = Object.freeze('direction');
  var DirectionType = Object.freeze({
    vertical: 'vertical',
    horizontal: 'horizontal'
//          box: 'box'
  });
  var DirectionElement = {};
  DirectionElement[DirectionType.vertical] = Object.freeze('<div></div>');
  DirectionElement[DirectionType.horizontal] = Object.freeze('<span></span>');
//        build.DirectionElement[DirectionType.box] = Object.freeze('<span></span>');

//  var ShelfTypeString = Object.freeze('shelfType');
  var AttachStringT = {
    record: Object.freeze('recordAttachment'),
    shelf : Object.freeze('shelfAttachment')
  };

  /**
   * A mixin function that creates a visual representation (as HTML elements)
   * of the shelf and its records. The root of this returned.
   * This will add attributes to shelf: $visual
   * @param {Shelf} shelf The shelf to become a visual.
   */
  function asVisualShelf (shelf, opt) {

    opt = util.selectValue(opt, {});
    //opt.direction = util.selectValue(opt.direction, DirectionType.vertical);
    opt.label = util.selectValue(opt.label, shelf.type);

    // create visual container
    var visual = $('<div></div>')
      .addClass('shelf');

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

    // attach direction
    //visual.data(build.DirectionString, opt.direction);

    // attach shelf to visual
    visual.data(AttachStringT.shelf, shelf);

    // add visual to shelf
    shelf.$visual = visual;
    shelf.$visual.container = container;

    // add removal method for visual
    shelf.removeVisual = _removeVisual;

    // make all records visual too
    switch (shelf.multiplicity) {
      case s.ShelfMultiplicityT.singletonShelf:
        asVisualRecord(shelf.record);
        break;
      case s.ShelfMultiplicityT.multiShelf:
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

    // add to visual of shelf
    // todo: add to the correct relative position!
    visual.appendTo(record.shelf.$visual.container);

    // attach record to visual
    visual.data(AttachStringT.record, record);

    // add visual to record
    record.$visual = visual;

    // add removal method for visual
    record.removeVisual = _removeVisual;

    return visual;
  }

  function _removeVisual () {
    this.$visual.remove();
  }

  // public part of the module
  return {
    AttachStringT: AttachStringT,
    asVisualRecord: asVisualRecord,
    asVisualShelf: asVisualShelf
    //removeVisual: removeVisual
  };
});