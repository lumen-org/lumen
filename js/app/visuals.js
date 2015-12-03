/**
 * Visuals module. This adds a visual layer on top of shelves and records by mixin appropriate functions into the
 * prototype of {@link module:shelves.Shelf} and {@link module:shelves.Record}.
 *
 * @module visuals
 * @author Philipp Lucas
 */
define(['lib/logger','./utils', './Field', './shelves'], function(Logger, util, F, s) {

  'use strict';
  var logger = Logger.get('pl-visuals');
  logger.setLevel(Logger.WARN);

  /**
   * Enum for possible layout types of shelves.
   * @type {{vertical: String, horizontal: String, box: String}}
   * @enum
   * @alias module:visuals.DirectionTypeT
   */
  var DirectionTypeT = Object.freeze({
    vertical: 'vertical',
    horizontal: 'horizontal',
    box: 'box'
  });

  /**
   * Enum of strings that are used to attach data to jQuery selections.
   * @type {{record: String, shelf: String}}
   * @enum
   * @alias module:visuals.AttachStringT
   */
  var AttachStringT = {
    record: Object.freeze('recordAttachment'),
    shelf : Object.freeze('shelfAttachment')
  };

  /**
   * Common things to start with when making a record visual.
   * @param {module:shelves.Record} record
   * @returns {module:shelves.Record} the modified record.
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
   * Common things to end with when making a record visual.
   * @param {module:shelves.Record} record
   * @returns {module:shelves.Record} the modified record.
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
   * A mixin function that creates a visual representation (as HTML elements) of this shelf and all its records.
   * That representation is stored in an attribute $visual of the shelf.
   * @return {module:shelves.Shelf} The instance it was called on.
   * @alias module:shelves.Shelf.beVisual
   * @augments module:shelves.Shelf
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
    this.records.forEach(function(record){record.beVisual();});
    return this;
  };

  /**
   * Remove the visual representation of this shelf.
   * @returns {module:shelves.Shelf} The instance it was called on.
   * @alias module:shelves.Shelf.removeVisual
   * @augments module:shelves.Shelf
   */
  s.Shelf.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  /**
   * Creates a simple visual representation (as HTML elements) of this record. The root of representation is returned.
   * It is also attaches as the attribute 'visual' to the record and added to the parent shelf.
   * Note: You may not make a record visible before making its shelf visible.
   * @return {module:shelves.Record} The instance it was called on.
   * @alias module:shelves.Record.beVisual
   * @augments module:shelves.Record
   */
  s.Record.prototype.beVisual = function () {
    var visual = _before4Record(this);
    visual.text(this.toString());
    return _after4Record(this);
  };

  /**
   * Removes the visual representation of this record.
   * @returns {module:shelves.Record} The instance it was called on.
   * @alias module:shelves.Record.removeVisual
   * @augments module:shelves.Record
   */
  s.Record.prototype.removeVisual = function () {
    this.$visual.remove();
    return this;
  };

  /**
   * Creates a visual representation of this record, i.e. specialized for {@link s.ColorRecord}.
   * @returns {module:shelves.Record}
   * @alias module:shelves.ColorRecord.beVisual
   * @augments module:shelves.ColorRecord
   */
  s.ColorRecord.prototype.beVisual = function () {
    var visual = _before4Record(this);
    visual.append('<img src="http://www.w3schools.com/tags/colormap.gif" height="25px" width="25px">');
    visual.append($('<span>'+ this.toString() +'</span>'));
    return _after4Record(this);
  };

  s.DimensionRecord.prototype.beVisual = function () {
    var visual = _before4Record(this);
    visual.text(this.content.name);
    return _after4Record(this);
  };

  s.MeasureRecord.prototype.beVisual = s.DimensionRecord.prototype.beVisual;

  return {
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});