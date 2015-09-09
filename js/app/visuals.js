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
   * of the shelf and its records. The root of that visual is returned.
   * This function will add attributes to shelf: $visual
   * @param {Shelf} shelf The shelf to become a visual.
   */
  s.Shelf.prototype.beVisual = function (opt) {

    opt = util.selectValue(opt, {});
    //opt.direction = util.selectValue(opt.direction, DirectionType.vertical);
    opt.label = util.selectValue(opt.label, this.type);

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
    visual.data(AttachStringT.shelf, this);

    // add visual to shelf
    this.$visual = visual;
    this.$visual.container = container;

    // make all records visual too
    switch (this.multiplicity) {
      case s.ShelfMultiplicityT.singletonShelf:
        this.record.beVisual();
        break;
      case s.ShelfMultiplicityT.multiShelf:
        this.records.forEach(function(record) {record.beVisual();});
        break;
    }
    return this;
  };

  s.Shelf.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  /**
   * A mixin function that creates a simple visual representation (as HTML elements) of this record. The root of representation is returned. It is also attaches as the attribute 'visual' to the record and added to the parent shelf.
   * Returns the record iself for chaining.
   * @param record
   */
  s.Record.prototype.beVisual = function () {
    // build visual
    //var visual = $(build.DirectionElement[shelf.data(build.DirectionString)]);
    var visual = $('<div></div>');
    visual.addClass('shelf-list-item')
      .text(this.content.name);

    // add to visual of shelf
    // todo: add to the correct relative position!
    visual.appendTo(this.shelf.$visual.container);

    // attach record to visual
    visual.data(AttachStringT.record, this);

    // add visual to record
    this.$visual = visual;
    return this;
  };

  s.Record.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  // public part of the module
  return {
    AttachStringT: AttachStringT
    //asVisualRecord: asVisualRecord,
    //asVisualShelf: asVisualShelf
    //removeVisual: removeVisual
  };
});