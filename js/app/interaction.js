/**
 * @author Philipp Lucas
 * @module
 *
 *
 */
define(['app/shelves', 'app/visuals', 'app/utils'], function (sh, vis, util) {
  'use strict';

  var logger = Logger.get('pl-interaction');

  var OverlapEnum = Object.freeze({
    // todo: change code to use enum
    left: 'left',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    center: 'center',
    none: 'none'
  });

  var geom = {
    /**
     * Returns the center as {x,y} of the first element of the $selection relative to the document
     * @param $selection
     */
    center: function ($selection) {
      var _pos = $selection[0].getBoundingClientRect();
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

        var intersect = ((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    },

    /**
     * Returns the type of overlap of the first element of the selection $rel relative to first element of the selection $base.
     * Possible overlaps are: 'no', 'left', 'right', 'bottom', 'top', 'center'
     *
     * @param $rel DOM element
     * @param $base DOM element
     * @param options Object: {type='abs'|'rel', top, left, bottom, right}.
     */
    overlap: function ($rel, $base, options) {

      var o = $.extend({}, $base[0].getBoundingClientRect());
      o.width = o.right - o.left;
      o.height = o.bottom - o.top;
      o.center = geom.center($base);

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
        i = $base[0].getBoundingClientRect();
      }

      // check overlap
      var relCenter = geom.center($rel);
      var p = [relCenter.x, relCenter.y];

      if (geom.within(p, [[o.left, o.top], [i.left, i.top], [i.left, i.bottom], [o.left, o.bottom]])) {
        return 'left';
      } else if (geom.within(p, [[o.left, o.top], [o.right, o.top], [i.right, i.top], [i.left, i.top]])) {
        return 'top';
      } else if (geom.within(p, [[i.right, i.top], [o.right, o.top], [o.right, o.bottom], [i.right, i.bottom]])) {
        return 'right';
      } else if (geom.within(p, [[i.left, i.bottom], [i.right, i.bottom], [o.right, o.bottom], [o.left, o.bottom]])) {
        return 'bottom';
      } else if (geom.within(p, [[i.left, i.top], [i.right, i.top], [i.right, i.bottom], [i.left, i.bottom]])) {
        return 'center';
      } else {
        return 'no';
      }

    }
  };

  /**
   * singelton ddr: Drag, Drop and Replace management
   */
  var ddr = (function () {
    var droppable = false;
    var draggable = false;
    var logger = Logger.get('ddr');
    logger.setLevel(Logger.WARN);

    var ddr = {
      linkDroppable: function (obj) {
        ddr.clearHighlight();
        if (obj) {
          droppable = obj;
          logger.debug('linked to droppable', obj);
        }
        return droppable;
      },

      unlinkDroppable: function () {
        ddr.clearHighlight();
        logger.debug('unlinked from droppable', droppable);
        droppable = false;
      },

      linkDraggable: function (obj) {
        if (obj) {
          draggable = obj;
          logger.debug('linked to draggable', obj);
        }
        return draggable;
      },

      unlinkDraggable: function () {
        logger.debug('unlinked from draggable', draggable);
        draggable = false;
      },

      /**
       * Returns the type of overlap of the current draggable relative to the current droppable.
       * Possible types of overlap: no, left, right, bottom, top, center
       */
      overlap: function () {
        console.assert(draggable && droppable);
        var margin = {
          h: 0.5,
          v: 0.6
        };
        return geom.overlap(
          draggable,
          droppable,
          {type: 'rel', top: margin.v, left: margin.h, bottom: margin.v, right: margin.h}
        );
      },

      /**
       * updates the highlighting of the current droppable according to given overlap
       * @param overlap
       */
      highlight: function (overlap) {
        if (droppable) {
          ddr.clearHighlight();
          droppable.addClass('overlap-' + overlap);
          logger.debug('overlap-' + overlap);
        }
      },

      /**
       * Clears the highlighting of the current droppable
       */
      clearHighlight: function () {
        if (droppable) {
          droppable.removeClass("overlap-top overlap-bottom overlap-left overlap-right overlap-center");
        }
      }
    };

    return ddr;
  })();

  /**
   * @param $record The visual of a record.
   */
  function makeRecordDraggable($record) {
    $record.draggable({
      helper: 'clone',
      scope: 'vars',
      zIndex: 9999,

      start: function (event, ui) {
        ddr.linkDraggable(ui.draggable || ui.helper);
      },

      stop: function (event, ui) {
        ddr.unlinkDraggable();
      },

      drag: function (event, ui) {
        // todo: just check the position and underlying element every time in drag, not in over / out ... it just doesn't work well
        // todo: http://stackoverflow.com/questions/15355553/jqueryui-droppable-over-and-out-callback-firing-out-of-sequence ??
        if (ddr.linkDroppable()) {
          var overlap = ddr.overlap();
          //console.log(overlap);
          ddr.highlight(overlap);
        }
      }
    });
  }

  /**
   * @param $record The visual of a record.
   */
  function makeRecordDroppable($record) {
    $record.droppable({
      scope: 'vars',
      //activeClass: 'drop-allow',
      // hoverClass: 'drop-hover',
      //greedy: false,
      tolerance: "pointer",
      /*drop: function (event, ui) {
       // attach original target
       event.originalEvent.targetItem = $(event.target);
       event.originalEvent.targetItemType = "some";
       Logger.debug('drop on shelf-list-item');
       },*/

      over: function (event, ui) {
        ddr.linkDroppable($(this));
      },

      out: function (event, ui) {
        ddr.unlinkDroppable();
      }
    });
  }

  /**
   * @param $shelf The visual of a shelf.
   */
  function makeShelfDroppable($shelf) {
    $shelf.droppable({
      scope: 'vars',
      //activeClass: 'drop-allow',
      //hoverClass: 'drop-hover',
      // greedy: false,
      tolerance: 'pointer',

      drop: function (event, ui) {
        logger.debug('drop on shelf');
        if (!(ddr.linkDraggable() && ddr.linkDroppable())) {
          // todo: why is the event triggered again on the shelf, if it was actually dropped on an shelf-list-item?
          return;
        }
        logger.debug("drop on shelf cont'd");

        // note: we pass the actual records and shelves, not the visuals

        var target = {
          item: (ddr.linkDroppable().hasClass('shelf-list-item') ? ddr.linkDroppable().data(vis.AttachStringT.record) : false),
          shelf: $(event.target).data(vis.AttachStringT.shelf)
        };
        //target.type = target.shelf.data(build.ShelfTypeString);

        var source = $(ui.draggable).data(vis.AttachStringT.record);
        //source.item = ui.draggable;
        //source.shelf = source.item.closest('.shelf');
        //source.type = source.shelf.data(build.ShelfTypeString);

        var overlap = ddr.overlap();

        onDrop[target.shelf.type](target, source, overlap);

        ddr.unlinkDroppable();
        event.stopPropagation();
      },

      over: function (event, ui) {
        ddr.linkDroppable($(this));
      },

      out: function (event, ui) {
        ddr.unlinkDroppable();
      }
    });
  }

  var onDrop = {};

  onDrop[sh.ShelfTypeT.dimension] = function (target, source, overlap) {
    if (source.shelf.type === sh.ShelfTypeT.dimension || source.shelf.type === sh.ShelfTypeT.measure) {
      // from field shelf to field shelf
      // -> move to target shelf
      var newRecord = target.shelf.append(source);
      vis.asVisualRecord(newRecord);
      makeRecordDraggable(newRecord.$visual);
      makeRecordDroppable(newRecord.$visual);
    }

    // in any way:
    source.removeVisual();
    source.remove();
  };

  onDrop[sh.ShelfTypeT.measure] = onDrop[sh.ShelfTypeT.dimension];

  onDrop[sh.ShelfTypeT.row] = function (target, source, overlap) {
    if (target.item) {
      switch (overlap) {
        case OverlapEnum.left:
        case OverlapEnum.top:
          // insert before element
          Item.prepend(source.item, target.item, target.shelf);
          break;
        case OverlapEnum.right:
        case OverlapEnum.bottom:
          // insert after target element
          Item.append(source.item, target.item, target.shelf);
          break;
        case OverlapEnum.center:
          // replace
          Item.replaceBy(source.item, target.item, target.shelf);
          break;
        default:
          console.error("Dropping on item, but overlap = " + overlap);
      }
    } else {
      Shelf.append(target.shelf, source.item);
    }
    if (source.shelf.type !== sh.ShelfTypeT.dimension &&
      source.shelf.type !== sh.ShelfTypeT.measure) {
      Item.remove(source.item);
    }
  };

  onDrop[sh.ShelfTypeT.column] = onDrop[sh.ShelfTypeT.row];

  onDrop[sh.ShelfTypeT.filter] = function (target, source, overlap) {
    if (source.shelf.type == sh.ShelfTypeT.filter) {
      // do nothing if just moving filters
      // todo: allow reordering
    } else {
      if (target.item) {
        // replace
        Item.replaceBy(source.item, target.item, target.shelf);
      } else {
        // append
        Shelf.append(target.shelf, source.item);
      }
    }
  };

  onDrop[sh.ShelfTypeT.color] = function (target, source, overlap) {
    Shelf.clear(target.shelf);
    Shelf.append(target.shelf, source.item);
    if (source.shelf.type !== sh.ShelfTypeT.dimension &&
      source.shelf.type !== sh.ShelfTypeT.measure) {
      Item.remove(source.item);
    }
  };

  onDrop[sh.ShelfTypeT.shape] = onDrop[sh.ShelfTypeT.color];

  onDrop[sh.ShelfTypeT.size] = onDrop[sh.ShelfTypeT.color];

  onDrop[sh.ShelfTypeT.remove] = function (target, source, overlap) {
    if (source.shelf.type !== sh.ShelfTypeT.dimension &&
      source.shelf.type !== sh.ShelfTypeT.measure) {
      Item.remove(source.item);
    }
  };

  /**
   * Makes the given Shelf an interactable, i.e. it can be do
   * @param shelf
   */
  function asInteractable(shelf) {
    makeShelfDroppable(shelf.$visual);
    switch (shelf.multiplicity) {
      case sh.ShelfMultiplicityT.singletonShelf:
        makeRecordDraggable(shelf.record.$visual);
        makeRecordDroppable(shelf.record.$visual);
        break;
      case sh.ShelfMultiplicityT.multiShelf:
        shelf.records.forEach(function (record) {
          makeRecordDraggable(record.$visual);
          makeRecordDroppable(record.$visual);
        });
        break;
    }
  }

  return {
    asInteractable: asInteractable
    /*makeItemDraggable: makeItemDraggable,
     makeItemDroppable: makeItemDroppable,
     makeShelfDroppable: makeShelfDroppable,
     onDrop: onDrop*/
  };
});