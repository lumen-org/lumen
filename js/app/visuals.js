/**
 * Visuals module. It provides self-contained views for shelves, records, Fields, FieldUsages, and Maps. They are
 * self-contained in the sense that are automatically synchronized with their model, if that changes.
 *
 * @module visuals
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define(['lib/logger','./utils', 'lib/emitter', './shelves', './VisMEL', './PQL'], function(Logger, util, Emitter, s, VisMEL, PQL) {

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
    horizontal: 'horizontal'
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
   * That representation is stored in the attribute $visual of the shelf.
   * @return {module:shelves.Shelf} The instance it was called on.
   * @alias module:shelves.Shelf.beVisual
   * @augments module:shelves.Shelf
   */
  s.Shelf.prototype.beVisual = function (opt) {
    opt = util.selectValue(opt, {});
    opt.label = util.selectValue(opt.label, this.type);
    opt.direction = util.selectValue(opt.direction, DirectionTypeT.vertical);

    // create visual container
    var visual = $('<div></div>')
      .addClass('shelf')
      .addClass(opt.direction);

    // create label
    var label = $('<div></div>');
    label.addClass('shelf-title')
      .text(opt.label)
      .appendTo(visual);

    // create element container
    var container = $('<div></div>');
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
    this.on(s.Shelf.Event.Remove, record => {
      return record.removeVisual();
    }
    );

    return this;
  };

  /**
   * Removes the visual representation of this shelf.
   * @returns The instance it was called on.
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
   * Creates a visual representation of the record and attaches it to the visual of its shelf.
   * Records take care of finding their correct position and add themselves to the shelf
   * hence, records cannot be visual without a visual parent shelf.
   * Since records are simply containers for arbitrary content, that content it expected to provide a 'makeVisual'-
   * method, which must return a visual representation of it.
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
   * Creates a visual representation of this record, i.e. specialized for ColorMaps
   *
  VisMEL.ColorMap.prototype.makeVisual = function () {
    function _updateVisual () {
      $visual.html('')
        .append('<img src="http://www.w3schools.com/tags/colormap.gif" height="25px" width="25px">')
        .append($('<span>'+ that.fu.yields +'</span>'));
    }
    let that = this;
    let $visual = $('<div></div>');
    _updateVisual();
    this.on(Emitter.InternalChangedEvent, _updateVisual);
    return $visual;
  };*/

  /// Mixins for PQL Fields and FieldUsages

  PQL.Field.prototype.makeVisual = function () {
    return $('<div class="pl-field pl-field-name">'+this.name+'</div>');
  };

  PQL.Aggregation.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that, Object.keys(PQL.AggrMethod)))
        .append(multiFieldDiv(that, record))
        .append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-aggregation"> </div>');
    _updateVisual();
    this.on(Emitter.InternalChangedEvent, _updateVisual);
    return $visual;
  };

  PQL.Density.prototype.makeVisual = function (record) {
   function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that, Object.keys(PQL.DensityMethod)))
        .append(multiFieldDiv(that, record))
        .append(conversionButtons(record))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-density"> </div>');
    _updateVisual();
    this.on(Emitter.InternalChangedEvent, _updateVisual);
    return $visual;
  };

  PQL.Split.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
      // .append(methodSelector(that, Object.keys(PQL.SplitMethod)))  // TODO: this should be the way
        .append(methodSelector(that, ['equiinterval', 'data']))
        .append(singleFieldDiv([that.name], record))
        .append(conversionButtons(record))
        .append(argumentsEditField(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-split"> </div>');
    _updateVisual();
    this.on(Emitter.InternalChangedEvent, _updateVisual);
    return $visual;
  };

  PQL.Filter.prototype.makeVisual = function (record) {
    function _updateVisual () {
      $visual.html('')
        .append(methodSelector(that, Object.keys(PQL.FilterMethodT)))
        .append(singleFieldDiv([that.name], record))
        .append(argumentsEditField_Filter(that))
        .append(removeButton(record));
    }
    let that = this;
    let $visual = $('<div class="pl-fu pl-fu-filter"> </div>');
    _updateVisual();
    this.on(Emitter.InternalChangedEvent, _updateVisual);
    return $visual;
  };

  function methodSelector (fu, options) {
    let $methodDiv = $('<div class="pl-method noselect pl-hidden">' + fu.method + '</div>');
    $methodDiv.click( () => {
      // clicking on it selects the next option
      let curValue = $methodDiv.html();
      let newIdx = (options.indexOf(curValue) + 1) % options.length;
      $methodDiv.html(options[newIdx]);
      fu.method = options[newIdx];
      fu.emit(Emitter.InternalChangedEvent);
      // fu.emit(Emitter.ChangedEvent);
    });
    return($methodDiv);
  }

  function removeButton (record) {
    var removeButton = $('<div class="pl-remove-button noselect pl-hidden"> <span>x</span> </div>');
    removeButton.click(() => record.remove());
    return removeButton;
  }


  //// in the following are utility / helper functions to create the GUI elements. I try to reuse as much as possible, but eventually there is naturally different GUI for different things...


  /**
   * Creates and returns GUI elements to convert the given record to another usage.
   * The records content must either be a BaseMap or a FieldUsage. The buttons allow to change the
   * FieldUsage to another 'type', i.e. switching between aggregation, split and density.
   *
   * This is self-contained. Using the buttons
   */
  function conversionButtons (record) {

    function translate (record, TargetType) {
      let content = record.content;
      let isBaseMap = content instanceof VisMEL.BaseMap;
      // construct new FU
      let newFU = TargetType.FromFieldUsage(isBaseMap ? content.fu : content);
      // construct new Mapping if necessary
      let newContent = isBaseMap ? content.constructor.DefaultMap(newFU) : newFU;
      // and replace the old one
      record.replaceBy(newContent);
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
    function submitOnEnter(elem) {
      if (event.keyCode == 13) {
        try{
          fu.args = JSON.parse(elem.target.value);
          fu.emit(Emitter.InternalChangedEvent);
        } catch (e) { }
      }
    }

    let textEdit = $('<input type="text" class="pl-arg-text pl-hidden"' +
      " value='" + JSON.stringify(fu.args) + "'" +
      ">");
    textEdit.keydown(submitOnEnter);
    return textEdit;
  }

  // almost same as above, but still different
  function argumentsEditField_Filter (fu) {
    function submitOnEnter(elem) {
      if (event.keyCode == 13) {
        try{
          // create domain of same type as in fu
          let input = JSON.parse(elem.target.value);
          fu.setDomain(new fu.args.constructor(input));
          fu.emit(Emitter.InternalChangedEvent);
        } catch (e) {
          console.log("invalid arguments for FU");
        }
      }
    }

    let textEdit = $('<input type="text" class="pl-arg-text pl-hidden"' +
      " value='" + JSON.stringify(fu.args.value) + "'" +
      ">");
    textEdit.keydown(submitOnEnter);
    return textEdit;
  }

  function singleFieldDiv (fieldName, record, removable = true) {
    var $fieldNames = $('<div class="pl-fields-in-fu noselect"></div>');
    let $fieldDiv = $('<div class="pl-field-name"></div>');
    if (removable) {
      let $removeButton = $('<span class="pl-remove-button pl-hidden">x</span>');
      $removeButton.click(()=>{
        record.remove();
      });
      $fieldDiv.append($removeButton)
        .append($('<span>' + fieldName + '</span>'));
    }

    $fieldNames.append($fieldDiv);
    return $fieldNames;
  }

  function multiFieldDiv (fu, record, removable = true) {
    var $fieldNames = $('<div class="pl-fields-in-fu noselect"></div>');
    for (let name of fu.names) {

      let $fieldDiv = $('<div class="pl-field-name"></div>');

      // add remove button: i.e. a botton that allows to remove a field from a multi-field-usage
      if (removable) {
        let $removeButton = $('<span class="pl-remove-button pl-hidden">x</span>');
        $removeButton.click(()=>{
          if (fu.names.length === 1)
            return record.remove();
          fu.fields = fu.fields.filter( elem => elem.name !== name );
          if (fu.yields === name)
            fu.yields = fu.fields[0].name;
          fu.emit(Emitter.InternalChangedEvent);
        });
        $fieldDiv.append($removeButton);
      }

      // add name of field and make it clickable to select the yield type
      let $clickableName = $('<span>' + name + '</span>')
        .toggleClass('pl-yield-field', fu.yields === name)
        .click(() => {
          if (fu.yields !== name) {
            fu.yields = name;
            fu.emit(Emitter.InternalChangedEvent);
          }
        });
      $fieldDiv.append($clickableName);

      $fieldNames.append($fieldDiv);
    }
    return $fieldNames;
  }

  return {
    AttachStringT: AttachStringT,
    DirectionTypeT: DirectionTypeT
  };
});