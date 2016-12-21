/**
 * Adds Drag and Drop capability the visuals of to {@link module:shelves.Shelf}s and {@link module:shelves.Record}s.
 *
 * @module interaction
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger', './shelves', './VisMELShelfDropping', './visuals'], function (Logger, sh, drop, vis) {
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
    top: 0.35, left: 0.3,
    bottom: 0.35, right: 0.3
  });

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
    // a drop may also occur on the record-visuals - however, we 'delegate' it to the shelf. i.e. it will be bubble up
    if ($curTarget.hasClass('shelf')) {
      logger.debug('dropping on'); logger.debug($curTarget); logger.debug($target);
      var targetShelf = $curTarget.data(vis.AttachStringT.shelf);
      // find closest ancestor that is a shelf-list-item 
      var target = $target.parentsUntil('.shelf','.shelf-list-item');
      target = (target.length === 0 ? targetShelf : target.data(vis.AttachStringT.record));
      var source= $(_draggedElem).data(vis.AttachStringT.record);
      var overlap = _geom.overlap([event.pageX, event.pageY], event.target, _OverlapMargins);
      drop(target, source, overlap);
      _draggedElem = null;
      event.stopPropagation();
      event.preventDefault();
    }
    _highlight.clear(event.currentTarget);
  }

  /**
   * @param $record The visual of a record.
   * @param flag true makes it draggable, false removes that
   */
  function _setRecordDraggable($record, flag=true) {
    $record.attr('draggable', flag);
    var domRecord = $record.get(0);
    let fct = (flag ? domRecord.addEventListener : domRecord.removeEventListener).bind(domRecord);
    fct('dragstart', onDragStartHandler);
  }

  /**
   * @param $record The visual of a record.
   * @param flag true makes it droppable, false removes that
   */
  function _setRecordDroppable($record, flag=true) {
    var domRecord = $record.get(0);
    let fct = (flag ? domRecord.addEventListener : domRecord.removeEventListener).bind(domRecord);
    fct('dragenter',  onDragEnterHandler);
    fct('dragover',  onDragOverHandler);
    fct('dragleave', onDragLeaveHandler);
    fct('drop', onDropHandler);
  }

  /**
   * @param $shelf The visual of a shelf.
   * @param flag true makes it droppable, false removes that
   */
  function _setShelfDroppable($shelf, flag=true) {
    var domShelf = $shelf.get(0);
    let fct = (flag ? domShelf.addEventListener : domShelf.removeEventListener).bind(domShelf);
    fct('dragenter', onDragEnterHandler);
    fct('dragover',  onDragOverHandler);
    fct('dragleave', onDragLeaveHandler);
    fct('drop',      onDropHandler);
  }

  /**
   * Mixin to make a Record interactable, i.e. it can be dragged and dropped on.
   * @returns {Record}
   */
  sh.Record.prototype.setInteractable = function (flag) {
    _setRecordDroppable(this.$visual, flag);
    _setRecordDraggable(this.$visual, flag);
    return this;
  };

  /**
   * Mixin to make make a shelf interactable. i.e. its records can be dragged and be dropped on and the shelf itself can be dropped on.
   * Note that it also makes all current records of that shelf interactable. Any records added to the shelf later are
   * automatically also made interactable.
   * @returns {sh.Records}
   */
  sh.Shelf.prototype.beInteractable = function () {
    _setShelfDroppable(this.$visual);
    this.records.forEach(record => record.setInteractable(true));
    this.on(sh.Shelf.Event.Add, record => record.setInteractable(true));
    this.on(sh.Shelf.Event.Remove, record => record.setInteractable(false));
    return this;
  };


  /**
   * Makes elem droppable such that any FUsageRecord dropped there is removed from its source.
   * @param {jQuery} $elem
   * @alias module:interaction.asRemoveElem
   */
  function asRemoveElem ($elem) {
    $elem.get(0).addEventListener('dragover', event => event.preventDefault());
    $elem.get(0).addEventListener('drop', event => {
      drop(new sh.Shelf(sh.ShelfTypeT.remove), $(_draggedElem).data(vis.AttachStringT.record), {});
      _draggedElem = null;
      event.stopPropagation();
    });
  }

  return {
    asRemoveElem : asRemoveElem
  };
});