/**
 * Visuals module. This adds a visual layer on top of shelves and records by mixin appropriate functions into the
 * prototype of {@link module:shelves.Shelf} and {@link module:shelves.Record}.
 *
 * @module visuals
 * @author Philipp Lucas
 */
define(['lib/logger','./utils', 'lib/emitter', './shelves', './VisMEL', './PQL'], function(Logger, util, E, s, VisMEL, PQL) {

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

  /// Mixins for Shelves

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

    // make all records visuals too, and register to related events
    this.records.forEach(record => record.beVisual());

    // register to related events to keep view updated
    this.on(s.Shelf.Event.Add, record => record.beVisual());
    this.on(s.Shelf.Event.Remove, record => record.removeVisual());

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

  /// Mixins for Records

  function _createVisualRecordContainer (record) {
    var $visual;
    switch (record.shelf.$visual.direction) {
      case DirectionTypeT.vertical:
        $visual = $('<div></div>');
        break;
      case DirectionTypeT.horizontal:
      case DirectionTypeT.box:
        $visual = $('<div style="display:inline-block">');
        break;
    }
    $visual.addClass('shelf-list-item');

    // attach record to visual
    $visual.data(AttachStringT.record, record);

    return $visual;
  }

  function _insertVisualInShelf (record) {
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
    return record;
  }

  /**
   * Creates a simple visual representation (as HTML elements) of this record. The root of representation is returned.
   * It is also attaches as the attribute 'visual' to the record and added to the parent shelf.
   * Note: You may not make a record visible before making its shelf visible.
   * @return {module:shelves.Record} The instance it was called on.
   * @alias module:shelves.Record.beVisual
   * @augments module:shelves.Record
   */
  s.Record.prototype.beVisual = function () {

    // create appropriate container for view on record content
    var $visual = _createVisualRecordContainer(this);
    this.$visual = $visual;

    // add visual of content in that container
    var content = this.content;
    $visual.append(content.makeVisual(this));
    // redraw visual of content on content change
    // todo: this should be done in beVisual of content itself.
    // content.on("changed", content => {
    //   $visual.html(content.makeVisual(this));
    // });

    // add visual of record to correct position in shelf
    _insertVisualInShelf(this);
    return this;
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

  /// Mixins for VisMEL Mappings

  VisMEL.BaseMap.prototype.makeVisual = function (record) {
    return this.fu.makeVisual(record);
  };

  /**
   * Creates a visual representation of this record, i.e. specialized for {@link s.ColorRecord}.
   * @returns {module:shelves.Record}
   * @alias module:shelves.ColorRecord.beVisual
   * @augments module:shelves.ColorRecord
   */
  VisMEL.ColorMap.prototype.makeVisual = function () {
    function _updateVisual () {
      $visual.html('')
        .append('<img src="http://www.w3schools.com/tags/colormap.gif" height="25px" width="25px">')
        .append($('<span>'+ that.fu.yields +'</span>'));
    }
    let that = this;
    let $visual = $('<div></div>');
    _updateVisual();
    //this.on("changed", _updateVisual);
    return $visual;
  };

  /// Mixins for PQL Fields and FieldUsages

  PQL.Field.prototype.makeVisual = function () {
    let $visual = $('<div>this.name</div>');
    return $visual;
  };

  PQL.Aggregation.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that))   // method div
        .append($('<div class="pl-field noselect">' + that.names +  '</div>'))
        .append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-aggregation"> </div>');
    _updateVisual();
    //this.on("changed", _updateVisual);
    return $visual;
  };

  PQL.Density.prototype.makeVisual = function (record) {
   function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that))   // method div
        .append($('<div class="pl-field noselect">' + that.names +  '</div>'))
        .append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-density"> </div>');
    _updateVisual();
    //this.on("changed", _updateVisual);
    return $visual;
  };

  PQL.Split.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that))   // method div
        .append($('<div class="pl-field noselect">' + that.name +  '</div>'))
        .append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-split"> </div>');
    _updateVisual();
    //this.on("changed", _updateVisual);
    return $visual;
  };

  PQL.Filter.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that))   // method div
        .append($('<div class="pl-field noselect">' + that.toString() +  '</div>'))
        //.append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-filter"> </div>');
    _updateVisual();
    //this.on("changed", _updateVisual);
    return $visual;
  };

  function methodSelector (fu) {
    return($('<div class="pl-method noselect pl-hidden">' + fu.method + '</div>'));   // method div
  }

  function removeButton (record) {
    var removeButton = $('<div class="pl-remove-button noselect pl-hidden"> <span>x</span> </div>');
    removeButton.click( () => {
      record.shelf.remove(record);
    });
    return removeButton;
  }

  function conversionButtons (record) {

    function translate (record, TargetType) {
      let content = record.content;
      let oldFU =  (content instanceof VisMEL.BaseMap ? content.fu : content);
      // construct new FU/Map
      let newFU = TargetType.FromFieldUsage(oldFU);
      // and replace the old one
      record.replaceBy(newFU);
    }

    var button = $(/*jshint multistr: true */
            '<div class="pl-button-container pl-hidden">\
             <span class="pl-aggregation-button">A</span>\
             <span class="pl-density-button">D</span>\
             <span class="pl-split-button pl-active">S</span>\
             </div>');
    button.find('.pl-aggregation-button').click(()=>{
      translate(record, PQL.Aggregation);
    });
    button.find('.pl-density-button').click(()=>{
      translate(record, PQL.Density);
    });
    button.find('.pl-split-button').click(()=>{
      translate(record, PQL.Split);
    });
    return button;
  }

  function argumentsEditField (fu) {
    //debugger;
    function submitOnEnter(elem) {
      if (event.keyCode == 13) {
        //console.log(elem.target.value);
        try{
          fu.args = JSON.parse(elem.target.value);
        } catch (e) { }
        console.log(fu);
      }
    }

    let textedit = $('<input type="text" class="pl-arg-text pl-hidden"' +
      "value='" + JSON.stringify(fu.args) + "'" +
      ">");
    textedit.keydown(submitOnEnter);
    return textedit;
  }

  return {
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});