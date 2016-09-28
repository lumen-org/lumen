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

  /**
   * Common things to start with when making a record visual.
   * @param {module:shelves.Record} record
   * @returns {module:shelves.Record} The container element for the visual representation of this record.
   * @private
   */
  function _before4Record (record) {
    var visual;
    switch (record.shelf.$visual.direction) {
      case DirectionTypeT.vertical:
        visual = $('<div class="foo"></div>');
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

    // var visual = _before4Record(this); // defines the $visual property on this
    // var content = this.content;
    // // redraw view on content change
    // content.on("changed", content => {
    //   content.removeVisual(visual, this);
    //   content.beVisual(visual, this);
    // });
    // // initial draw
    // content.beVisual(visual)
    // return _after4Record(this);
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

  VisMEL.BaseMap.prototype.beVisual = function (container) {
    this.fu.beVisual(container);
    return this;
  };

  VisMEL.BaseMap.prototype.makeVisual = function () {
    return this.fu.makeVisual();
  };

  /**
   * Creates a visual representation of this record, i.e. specialized for {@link s.ColorRecord}.
   * @returns {module:shelves.Record}
   * @alias module:shelves.ColorRecord.beVisual
   * @augments module:shelves.ColorRecord
   */
  VisMEL.ColorMap.prototype.beVisual = function (container) {
    container.append('<img src="http://www.w3schools.com/tags/colormap.gif" height="25px" width="25px">');
    container.append($('<span>'+ this.fu.yields +'</span>'));
    return this;
  };

  VisMEL.ColorMap.prototype.makeVisual = function () {
    var $visual = $('<div></div>')
      .append('<img src="http://www.w3schools.com/tags/colormap.gif" height="25px" width="25px">')
      .append($('<span>'+ this.fu.yields +'</span>'));
    return $visual;
  };

  /// Mixins for PQL FieldUsages and Fields
  
  PQL.Field.prototype.beVisual = function (container) {
    container.text(this.name);
    return this;
  };

  PQL.Field.prototype.makeVisual = function () {
    return this.name;
  };

  PQL.Filter.prototype.beVisual = function (container) {
    container.text(this.toString());
    return this;
  };

  PQL.Filter.prototype.beVisual = function (container) {
    container.text(this.toString());
    return this;
  };

  PQL.Aggregation.prototype._beVisual = function (container) {
    container.text( this.method + "(" + this.names + ")" );
    return this;
  };

  PQL.Density.prototype._beVisual = function (container) {
    container.text( "p(" + this.names + ")" );
    return this;
  };

  PQL.Split.prototype._beVisual = function (container) {
    container.text( this.method + "(" + this.name + ")" );
    return this;
  };

  PQL.Aggregation.prototype.beVisual = function (container, record) {
    //container.append($('<div class="pl-fu pl-fu-aggregation"> </div>'))
    container.addClass("pl-fu pl-fu-aggregation")
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.names +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return container;
  };

  PQL.Aggregation.prototype.makeVisual = function (record) {
    var $visual = $('<div class="pl-fu pl-fu-aggregation"> </div>')
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.names +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return $visual;
  };

  PQL.Density.prototype.beVisual = function (container, record) {
    //container.append($('<div class="pl-fu pl-fu-aggregation"> </div>'))
    container.addClass("pl-fu pl-fu-density")
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.names +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return container;
  };

  PQL.Density.prototype.makeVisual = function (record) {
    var $visual = $('<div class="pl-fu pl-fu-density"> </div>')
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.names +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return $visual;
  };

  PQL.Split.prototype.beVisual = function (container, record) {
    //container.append($('<div class="pl-fu pl-fu-aggregation"> </div>'))
    container.addClass("pl-fu pl-fu-split")
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.name +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return container;
  };

  PQL.Split.prototype.makeVisual = function (record) {
    var $visual = $('<div class="pl-fu pl-fu-split"> </div>')
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.name +  '</div>'))
      .append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return $visual;
  };

  PQL.Filter.prototype.beVisual = function (container, record) {
    //container.append($('<div class="pl-fu pl-fu-aggregation"> </div>'))
    container.addClass("pl-fu pl-fu-filter")
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.toString() +  '</div>'))
      //.append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return container;
  };

  PQL.Filter.prototype.makeVisual = function (record) {
    var $visual = $('<div class="pl-fu pl-fu-filter"> </div>')
      .append(methodSelector(this))   // method div
      .append($('<div class="pl-field noselect">' + this.toString() +  '</div>'))
      //.append(conversionButtons(record))
      .append(argumentsEditField(this))
      .append(removeButton(record));
    return $visual;
  };

  function methodSelector (fu) {
    return($('<div class="pl-method noselect pl-hidden">' + fu.method + '</div>'));   // method div
  }

  function removeButton (record) {
    var removeButton = $('<div class="pl-remove-button noselect pl-hidden"> <span>x</span> </div>');
    removeButton.click( () => {
      record.removeVisual().shelf.remove(record);
    });
    return removeButton;
  }

  function conversionButtons (record) {

    function translate (record, TargetType) {
      // construct new FU/Map
      let newFU = TargetType.FromFieldUsage(record.content);
      // and replace the old one
      record.removeVisual();
      let newRecord = record.replaceBy(newFU);
      newRecord.beVisual().beInteractable();
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

    let textedit = $('<input type="text" class="pl-arg-text pl-hidden"' 
      + "value='" + JSON.stringify(fu.args) + "'"
      + ">");
    textedit.keydown(submitOnEnter)
    return textedit;
  }

  return {
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});