define(['app/shelves','app/utils'], function(s, util) {
  'use strict';
  var logger = Logger.get('pl-visuals');
  logger.setLevel(Logger.DEBUG);

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
   * @param record
   * @returns {*}
   * @private
   */
  function _before4Record (record) {
    var visual;
    switch (record.shelf.$visual.direction) {
      case DirectionTypeT.vertical:
        visual = $('<div></div>');
        break;
      case DirectionTypeT.horizontal:
      case DirectionTypeT.box:
        visual = $('<span></span>');
        break;
    }
    visual.addClass('shelf-list-item');
    record.$visual = visual;
    return visual;
  }

  /**
   *
   * @param record
   * @private
   */
  function _after4Record (record) {
    var visual = record.$visual;

    // add to visual of shelf
    // find correct position: iterate from (its own index - 1) down to 0. Append visual after the first record that is visual.
    var records = record.shelf.records;
    for (var idx = record.index(); idx > 0 && !records[idx-1].$visual; idx--) {}
    if (idx === 0) {
      visual.prependTo(record.shelf.$visual.container);
    } else {
      visual.insertAfter(records[idx-1].$visual);
    }

    // attach record to visual
    visual.data(AttachStringT.record, record);

    return record;
  }

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
    this.records.forEach(function(record) {record.beVisual();});
    return this;
  };

  s.Shelf.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  /**
   * A mixin function that creates a simple visual representation (as HTML elements) of this record. The root of representation is returned. It is also attaches as the attribute 'visual' to the record and added to the parent shelf.
   * Note: You may not make a record visible before making its shelf visible.
   * @param record
   * @return The record itself for chaining.
   */
  s.Record.prototype.beVisual = function () {
    var visual = _before4Record(this);

    visual.addClass('shelf-list-item')
      .text(this.toPQLString());

    return _after4Record(this);
  };

  s.Record.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  s.ColorRecord.prototype.beVisual = function () {
    var visual = _before4Record(this);

    visual.append('<img src="http://www.w3schools.com/tags/colormap.gif" height="30px" width="30px">');
    var attr = this.content;
    var text = (attr instanceof s.FieldUsage ? attr.aggr + '(' + attr.name + ')': attr.name );
    visual.append($('<span>'+ text +'</span>'));

    return _after4Record(this);
  };


  // public part of the module
  return {
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});