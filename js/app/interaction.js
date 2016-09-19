/**
 * Adds interactivity to {@link module:shelves.Shelf}s and {@link module:shelves.Record}s.
 *
 * @module interaction
 * @author Philipp Lucas
 */
define(['lib/emitter', 'lib/logger', './shelves', './visuals', './PQL', './VisMEL'], function (e, Logger, sh, vis, PQL, VisMEL) {
  'use strict';

  var logger = Logger.get('pl-interaction');
  logger.setLevel(Logger.WARN);

  var _OverlapEnum = Object.freeze({
    left: 'left',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    center: 'center',
    none: 'none'
  });

  var _OverlapMargins = Object.freeze({
    type: 'rel',
    top: 0.3, left: 0.3,
    bottom: 0.3, right: 0.3
  });

  function _isDimOrMeasureShelf (shelf) {
    return (shelf.type === sh.ShelfTypeT.dimension || shelf.type === sh.ShelfTypeT.measure);
  }

  /**
   * Functions for calculating positions and overlaps of DOM elements.
   * @type {{center: Function, within: Function, overlap: Function}}
   * @private
   */
  var _geom = {
    /**
     * Returns the center as {x,y} of the first element of the $selection relative to the document
     * @param elem DOM element.
     */
    center: function (elem) {
      var _pos = elem.getBoundingClientRect();
      return {
        x: _pos.left + _pos.width / 2,
        y: _pos.top + _pos.height / 2
      };
    },

    /**
     * Returns true if point is within the polygon vs, false else.
     * @param point A point as 2-element array.
     * @param vs A polygon as an array of 2-element arrays.
     * @returns {boolean} True if within, false else.
     */
    within: function (point, vs) {
      // credits to: https://github.com/substack/point-in-polygon
      // ray-casting algorithm based on
      // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
      var x = point[0], y = point[1];
      var inside = false;
      for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    },

    /**
     * Returns the type of overlap of relPos relative to elem.
     * Possible overlaps are: 'no', 'left', 'right', 'bottom', 'top', 'center'
     * @param relPos center of DOM element that is possibly overlapping elem.
     * @param elem DOM element
     * @param {Object} options
     * @param {string} options.type - How to interpret the remaining parameters: absolute pixel distances, or relative to dimensions of elem.
     */
    overlap: function (relPos, elem, options) {
      var o = $.extend({}, elem.getBoundingClientRect());
      o.width = o.right - o.left;
      o.height = o.bottom - o.top;
      o.center = _geom.center(elem);

      // calculate dimensions of inner rectangle
      var i;
      if (options) {
        console.assert(options.type && options.type == 'abs' || options.type == 'rel', "invalid options!");
        if (options.type == 'rel') {
          i = {
            left: o.center.x - (1 - options.left) * 0.5 * o.width,
            top: o.center.y - (1 - options.top) * 0.5 * o.height,
            right: o.center.x + (1 - options.right) * 0.5 * o.width,
            bottom: o.center.y + (1 - options.bottom) * 0.5 * o.height
          };
        } else if (type == 'abs') {
          i = {
            left: o.center.x - options.left,
            top: o.center.y - options.top,
            right: o.center.x + options.right,
            bottom: o.center.y + options.bottom
          };
        }
      } else {
        i = elem[0].getBoundingClientRect();
      }

      // check overlap
      if (_geom.within(relPos, [[o.left, o.top], [i.left, i.top], [i.left, i.bottom], [o.left, o.bottom]])) {
        return _OverlapEnum.left;
      } else if (_geom.within(relPos, [[o.left, o.top], [o.right, o.top], [i.right, i.top], [i.left, i.top]])) {
        return _OverlapEnum.top;
      } else if (_geom.within(relPos, [[i.right, i.top], [o.right, o.top], [o.right, o.bottom], [i.right, i.bottom]])) {
        return _OverlapEnum.right;
      } else if (_geom.within(relPos, [[i.left, i.bottom], [i.right, i.bottom], [o.right, o.bottom], [o.left, o.bottom]])) {
        return _OverlapEnum.bottom;
      } else if (_geom.within(relPos, [[i.left, i.top], [i.right, i.top], [i.right, i.bottom], [i.left, i.bottom]])) {
        return _OverlapEnum.center;
      } else {
        return _OverlapEnum.none;
      }
    }
  };

  /**
   * The currently dragged DOM element.
   * @private
   */
  var _draggedElem = null;

  /**
   * @type {{clear: _highlight.clear, set: _highlight.set}}
   * @private
   */
  var _highlight = {
    /**
     * Clears the highlighting of the given droppable
     * @param elem
     */
    clear : function (elem) {
      if (elem) {
        $(elem).removeClass("overlap-top overlap-bottom overlap-left overlap-right overlap-center");
      }
    },
    /**
     * updates the highlighting of the given droppable according to given overlap
     * @param elem
     * @param overlap
     */
    set : function  (elem, overlap) {
      if (elem) {
        _highlight.clear(elem);
        $(elem).addClass('overlap-' + overlap);
      }
    }
  };

  /**
   * Called when a drag started on the element that was dragged.
   * @param event
   */
  function onDragStartHandler (event) {
    logger.debug('starting'); logger.debug(event.currentTarget);
    _draggedElem = event.currentTarget;
  }

  /**
   * Called on the element that a drag just left.
   * @param event
   */
  function onDragEnterHandler (event) {
    logger.debug('entering');
    logger.debug(event.currentTarget);
  }

  /**
   * Called for the element that the drag is currently dragging over.
   * @param event
   */
  function onDragOverHandler (event) {
    var mousePos = [event.pageX, event.pageY];
    var dropElem = event.currentTarget;
    var overlap = _geom.overlap(mousePos, dropElem, _OverlapMargins);
    _highlight.set(dropElem, overlap);
    event.preventDefault();
  }

  /**
   * Called on the element that a drag just left.
   * @param event
   */
  function onDragLeaveHandler (event) {
    logger.debug('leaving');
    logger.debug(event.currentTarget);
    _highlight.clear(event.currentTarget);
  }

  /**
   * Called for the element a drop occurred on.
   * @param event
   */
  function onDropHandler (event) {
    var $curTarget = $(event.currentTarget); // is shelf-visual
    var $target = $(event.target); // is shelf-visual or record-visual
    // a drop may also occur on the record-visuals - however, we 'delegate' it to the shelf
    if ($curTarget.hasClass('shelf')) {
      logger.debug('dropping on'); logger.debug($curTarget); logger.debug($target);
      var targetShelf = $curTarget.data(vis.AttachStringT.shelf);
      var target = ( $target.hasClass('shelf-list-item') ? $target.data(vis.AttachStringT.record) : targetShelf );
      var source= $(_draggedElem).data(vis.AttachStringT.record);
      var overlap = _geom.overlap([event.pageX, event.pageY], event.target, _OverlapMargins);
      onDrop(target, source, overlap);
      _draggedElem = null;
      event.stopPropagation();
      event.preventDefault();
    }
    _highlight.clear(event.currentTarget);
  }

  /**
   * @param $record The visual of a record.
   */
  function _makeRecordDraggable($record) {
    $record.attr('draggable', true);
    var domRecord = $record.get(0);
    domRecord.addEventListener('dragstart', onDragStartHandler);
  }

  /**
   * @param $record The visual of a record.
   */
  function _makeRecordDroppable($record) {
    var domRecord = $record.get(0);
    domRecord.addEventListener('dragenter',  onDragEnterHandler);
    domRecord.addEventListener('dragover',  onDragOverHandler);
    domRecord.addEventListener('dragleave', onDragLeaveHandler);
    domRecord.addEventListener('drop', onDropHandler);
  }

  /**
   * @param $shelf The visual of a shelf.
   */
  function _makeShelfDroppable($shelf) {
    var domShelf = $shelf.get(0);
    domShelf.addEventListener('dragenter', onDragEnterHandler);
    domShelf.addEventListener('dragover',  onDragOverHandler);
    domShelf.addEventListener('dragleave', onDragLeaveHandler);
    domShelf.addEventListener('drop',      onDropHandler);
  }

  /**
   * Makes elem droppable such that any FUsageRecord dropped there is removed from its source.
   * @param {jQuery} $elem
   * @alias module:interaction.asRemoveElem
   */
  function asRemoveElem ($elem) {
    $elem.get(0).addEventListener('dragover', event => event.preventDefault());
    $elem.get(0).addEventListener('drop', event => {
      onDrop(new sh.RemoveShelf(), $(_draggedElem).data(vis.AttachStringT.record), {});
      _draggedElem = null;
      event.stopPropagation();
    });
  }

  /**
   * Mixin to make a Record interactable, i.e. it can be dragged and dropped on.
   * @returns {Record}
   */
  sh.Record.prototype.beInteractable = function () {
    _makeRecordDroppable(this.$visual);
    _makeRecordDraggable(this.$visual);
    return this;
  };

  /**
   * Mixin to make make a shelf interactable. i.e. its records can be dragged and be dropped on and the shelf itself can be dropped on.
   * Note that it also makes all current records of that shelf interactable.
   * @returns {sh.Records}
   */
  sh.Shelf.prototype.beInteractable = function () {
    _makeShelfDroppable(this.$visual);
    this.records.forEach(function (record) {
      record.beInteractable();
    });
  };

  /**
   * Helper function that extracts a Field from a record that contains either a Field, a BaseMap or a FieldUsage
   */
  function _getFieldUsage (record) {
    let content = record.content;
    if (content instanceof VisMEL.BaseMap)
      return content.fu;
    else if (PQL.isFieldUsage(content))
      return content;
    else
      throw new RangeError("unsupported type of content of record: " + content);
  }

  function _getField (record) {
    let content = record.content;
    if (PQL.isField(content))
      return content;
    else {
      if (content instanceof VisMEL.BaseMap)
        content = content.fu;
      if (PQL.isSplit(content) || PQL.isFilter(content))
        return content.field;
      else if (PQL.isAggregationOrDensity(content))
        return content.fields[0];
    }
    throw new RangeError('invalid record content: ' + content);
  }

  function _fieldUsageFromRecord (record) {
    let shelf = record.shelf;
    if (shelf.type === sh.ShelfTypeT.dimension || shelf.type === sh.ShelfTypeT.measure || shelf.type === sh.ShelfTypeT.filter) {
      let field = _getField(record);
      return field.isDiscrete() ? PQL.Split.DefaultSplit(field) : PQL.Aggregation.DefaultAggregation(field);
    } else
      return _getFieldUsage(record);
  }

  /**
   * Primary interaction handler. There is one handler for each value in {@link module:shelves.ShelfTypeT}, hence one for each type of shelf.
   *
   * Drops emit an {@link module:interaction.onDrop.dropDoneEvent} after a drop has been processed.
   *
   * abbreviations are as follows:
   *  * tRecord: target record
   *  * sRecord: source record
   *  * tShelf: target shelf
   *  * sShelf: source shelf
   *
   * @type {{}}
   * @alias module:interaction.onDrop
   */
  var onDrop = function (target, source, overlap) {
    // delegate to correct handler
    if (target instanceof sh.Record)
      //onDrop[target.shelf.type](target, source, overlap);
      onDrop[target.shelf.type](target, target.shelf, source, source.shelf, overlap);
      //onDrop[target.shelf.type](targetRecord, targetShelf, sourceRecord, overlap);
    else if (target instanceof sh.Shelf)
      onDrop[target.type](undefined, target, source, source.shelf, overlap);
      //onDrop[target.type](target, source, overlap);
    else
      throw new TypeError('wrong type for parameter target');
    onDrop.emit(onDrop.dropDoneEvent); // emit dropped event for outside world
  };

  onDrop[sh.ShelfTypeT.dimension] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (sShelf.type === sh.ShelfTypeT.dimension || sShelf.type === sh.ShelfTypeT.measure) {
      // move to target shelf
      let newRecord =  (tRecord !== undefined ? tRecord.append(sRecord) : tShelf.append(sRecord));
      _fix(newRecord).beVisual().beInteractable();
    }
    _fix(sRecord).removeVisual().remove();
  };

  onDrop[sh.ShelfTypeT.measure] = onDrop[sh.ShelfTypeT.dimension];

  onDrop[sh.ShelfTypeT.row] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // general rule: measures always come after dimensions
    let newRecord,
      content;
    // construct aggregation or split usage
    let sField = _getField(sRecord);
    if (sShelf.type === sh.ShelfTypeT.dimension)
      content = PQL.Split.DefaultSplit(sField);
    else if (sShelf.type === sh.ShelfTypeT.measure)
      content = PQL.Aggregation.DefaultAggregation(sField);
    else if (sField.isDiscrete())
      content = PQL.Split.DefaultSplit(sField);
    else
      content = PQL.Aggregation.DefaultAggregation(sField);

    // todo: fix for invalid drop positions,i.e.: dropping dimensions _after_ measures, or measures _before_ dimensions
    // alternative: do reorder after the element has been dropped
    if (tRecord !== undefined) {
      switch (overlap) {
        case _OverlapEnum.left:
        case _OverlapEnum.top:
          // insert before element
          newRecord = tRecord.prepend(content);
          break;
        case _OverlapEnum.right:
        case _OverlapEnum.bottom:
          // insert after target element
          newRecord = tRecord.append(content);
          break;
        case _OverlapEnum.center:
          // replace
          _fix(tRecord).removeVisual().remove();
          newRecord = tRecord.replaceBy(content);
          break;
        default:
          console.error("Dropping on item, but overlap = " + overlap);
      }
    } else {
      newRecord = tShelf.append(content);
    }
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
    _fix(newRecord).beVisual().beInteractable();
  };

  onDrop[sh.ShelfTypeT.column] = onDrop[sh.ShelfTypeT.row];

  onDrop[sh.ShelfTypeT.detail] = function (tRecord, tShelf, sRecord, sShelf, overlap) {    
    let content = PQL.Split.DefaultSplit(_getField(sRecord));
    let newRecord =  (tRecord !== undefined ? tRecord : tShelf).append(content);
    _fix(newRecord).beVisual().beInteractable();
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
  };

  onDrop[sh.ShelfTypeT.filter] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (sShelf === sh.ShelfTypeT.filter) {
      // do nothing if just moving filters
      // todo: allow reordering
      return;
    }

    let filter = PQL.Filter.DefaultFilter(_getField(sRecord));
    let newRecord;
    if (tRecord !== undefined) { // replace
      _fix(tRecord).removeVisual();
      newRecord = tRecord.replaceBy(filter);
    } else  // append
      newRecord = tShelf.append(filter);

    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
    _fix(newRecord).beVisual().beInteractable();
  };

  onDrop[sh.ShelfTypeT.color] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) _fix(tShelf.at(0)).removeVisual().remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.ColorMap.DefaultMap(fu);
    // add new color map
    let newRecord = tShelf.append(content);
    _fix(newRecord).beVisual().beInteractable();
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
  };

  onDrop[sh.ShelfTypeT.shape] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) _fix(tShelf.at(0)).removeVisual().remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.ShapeMap.DefaultMap(fu);
    // add new color map
    let newRecord = tShelf.append(content);
    _fix(newRecord).beVisual().beInteractable();
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
  };

  onDrop[sh.ShelfTypeT.size] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) _fix(tShelf.at(0)).removeVisual().remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.SizeMap.DefaultMap(fu);
    // add new color map
    let newRecord = tShelf.append(content);
    _fix(newRecord).beVisual().beInteractable();
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
  };

  onDrop[sh.ShelfTypeT.remove] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (!_isDimOrMeasureShelf(sShelf)) _fix(sRecord).removeVisual().remove();
  };

  onDrop.noVisualNoInteraction = false;
  /**
   * This is a hack to make it possible to use onDrop without the visual or interactable part, but just as a set of commands to add/move/remove fields from shelves.
   * For this, it adds empty function stubs for that function that are called in onDrop for the visual/interactable part.
   * In order to activate this "hack", set onDrop.noVisualNoInteraction to true.
   * todo: make it nicer... looks like onDrop is mixing up things: logic of how fields on shelves can move around, and the actual interaction and visual part
   * @param arg The record to fix
   * @returns {*} the modified record.
   * @private
   */
  function _fix (arg) {
    function returnsItself () { return this; } //jshint ignore: line
    if(onDrop.noVisualNoInteraction) {
      arg.removeVisual = returnsItself;
      arg.beVisual = returnsItself;
      arg.beInteractable = returnsItself;
    }
    return arg;
  }

  /**
   * the dropDoneEvent is fired after completing a drop in onDrop
   * @name module:interaction.onDrop.dropDoneEvent
   */
  Object.defineProperty(onDrop, 'dropDoneEvent', {
    value: 'interaction.dropDoneEvent',
    enumerable: false
  });

  e.Emitter(onDrop);

  return {
    onDrop : onDrop,
    asRemoveElem : asRemoveElem
  };
});