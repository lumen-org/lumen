define(['app/shelves','app/utils'], function(s, util) {
  'use strict';
  //var logger = Logger.get('pl-visuals');
  var DirectionTypeT = Object.freeze({
    vertical: 'vertical',
    horizontal: 'horizontal',
    box: 'box'
  });
  var AttachStringT = {
    record: Object.freeze('recordAttachment'),
    shelf : Object.freeze('shelfAttachment')
  };

  /**
   * A mixin function that creates a visual representation (as HTML elements) of the shelf and its records. That representation is stored in an attribute $visual of the shelf.
   * @param {Shelf} shelf The shelf to become a visual.
   * @return this
   */
  s.Shelf.prototype.beVisual = function (opt) {
    opt = util.selectValue(opt, {});
    opt.label = util.selectValue(opt.label, this.type);
    opt.direction = util.selectValue(opt.direction, DirectionTypeT.vertical);

    // create visual container
    var visual = $('<div></div>').addClass('shelf');

    // create label
    var label;
    switch (opt.direction) {
      case DirectionTypeT.vertical:
      case DirectionTypeT.box:
        label = $('<div></div>');
        break;
      case DirectionTypeT.horizontal:
        label = $('<span></span>');
        break;
    }
    label.addClass('shelf-title')
      .text(opt.label)
      .appendTo(visual);

    // create element container
    var container;
    switch (opt.direction) {
      case DirectionTypeT.vertical:
      case DirectionTypeT.box:
        container = $('<div></div>');
        break;
      case DirectionTypeT.horizontal:
        container = $('<span></span>');
        break;
    }
    container.addClass('shelf-list')
      .appendTo(visual);

    // attach shelf to visual
    visual.data(AttachStringT.shelf, this);

    // add visual to shelf
    this.$visual = visual;
    this.$visual.container = container;
    this.$visual.direction = opt.direction;

    // make all records visuals too
    switch (this.multiplicity) {
      case s.ShelfMultiplicityT.singletonShelf:
        if (!this.empty()) this.record.beVisual();
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
   * Note: You may not make a record visible before makking its shelf visible.
   * @param record
   * @return The record iself for chaining.
   */
  s.Record.prototype.beVisual = function () {
    var visual;
    switch (this.shelf.$visual.direction) {
      case DirectionTypeT.vertical:
        visual = $('<div></div>');
        break;
      case DirectionTypeT.horizontal:
      case DirectionTypeT.box:
        visual = $('<span></span>');
        break;
    }
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
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});