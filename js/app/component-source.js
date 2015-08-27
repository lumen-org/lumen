/**
 * @author Philipp Lucas
 *
 * JavaScript code for this the source component of the UI of the EMV tool.
 */

define(['d3'], function (d3) {
  'use strict';

  // setup code here
  Logger.useDefaults();

  // definitions of modules functions here
  return {

    /**
     * Start the application.
     */
    start: function () {


      /**
       * Class constructor for items
       * @constructor
       *
      var Item = function() {
      }

      var ItemClass = (function() {

        // the closure is my class variables, methods, ... !

        var ItemClass = {};


      })();*/


      /**
       * namespace build: Methods for building up the DOM with Shelfs and Shelf elements
       */
      var build = (function() {

        var build = {};
        var logger = Logger.get('pl-build');

        build.DirectionString = Object.freeze('direction');
        build.DirectionType = Object.freeze({
          vertical: 'vertical',
          horizontal: 'horizontal'
        });
        build.DirectionElement = {};
        build.DirectionElement[build.DirectionType.vertical] = Object.freeze('<div></div>');
        build.DirectionElement[build.DirectionType.horizontal] = Object.freeze('<span></span>');

        build.ShelfTypeString = Object.freeze('shelfType');
        build.ShelfType = Object.freeze({
          field: 'fieldShelf',
          layout: 'layoutShelf',
          filter: 'filterShelf',
          color: 'colorShelf',
          shape: 'shapeShelf',
          size: 'sizeShelf',
          aesthetic: 'aestheticShelf',
          remove: 'removeShelf'
        });

        function makeItemDraggable ($item) {
          $item.draggable({
            helper: 'clone',
            scope: 'vars',
            zIndex: 1000,

            start: function (event, ui) {
              ddr.linkDraggable(ui.draggable || ui.helper);
            },

            stop: function (event, ui) {
              ddr.unlinkDraggable();
            },

            drag: function(event, ui) {
              // todo: just check the position and underlying element every time in drag, not in over / out ... it just doesn't work well
              // todo: http://stackoverflow.com/questions/15355553/jqueryui-droppable-over-and-out-callback-firing-out-of-sequence ??
              if (ddr.linkDroppable()) {
                var overlap = ddr.overlap()
                //console.log(overlap);
                ddr.highlight(overlap);
              }
            }
          });
        };

        function makeItemDroppable ($item) {
          $item.droppable({
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
        };

        function makeShelfDroppable ($shelf) {
          $shelf.droppable({
            scope: 'vars',
            //activeClass: 'drop-allow',
            //hoverClass: 'drop-hover',
           // greedy: false,
            tolerance: 'pointer',

            drop: function (event, ui) {

              logger.debug('log on shelf');

              if (!(ddr.linkDraggable() && ddr.linkDroppable())) {
                // todo: why is the event triggered again on the shelf, if it was actually dropped on an shelf-list-item?
                return;
              }
              logger.debug("log on shelf cont'd");

              var target = {};
              target.item = event.targetItem ||
                (ddr.linkDroppable().hasClass('shelf-list-item') ? ddr.linkDroppable() : false);
              target.shelf = $(event.target);
              target.shelfType = target.shelf.data(build.ShelfTypeString);

              var source = {};
              source.item = ui.draggable;
              source.shelf = source.item.closest('.shelf');
              source.shelfType = source.shelf.data(build.ShelfTypeString);
              
              var overlap = ddr.overlap();

              onDrop[target.shelfType](target, source, overlap, event, ui);

              ddr.unlinkDroppable();
              event.stopPropagation();
            },

            over: function(event, ui) {
              ddr.linkDroppable($(this));
            },

            out: function(event, ui) {
              ddr.unlinkDroppable();
            }
          });
        };

        /**
         * Adds a shelf as a <ul> to each element of the passed selection.
         * @param selection The selection
         * @param typeString The type of the shelf.
         * @param opt = {id, label, direction}
         * Where:
         *   - id is the string that will used as ID for the added shelf-<div> element.
         *   - label is the label of the shelf
         *   - direction = ['horizontal'|'vertical']
         *
         * @returns the added shelf.
         */
        build.addShelf = function (selection, typeString, opt) {

          if (!opt) opt = {};
          if (!opt.direction) opt.direction = build.DirectionType.vertical;
          if (!opt.label) opt.label = typeString;

          // create shelf container
          var shelf = $('<div></div>')
            .addClass('shelf');

          if (opt.id) {
            shelf.attr('id', opt.id);
          }

          // create label
          var htmlElem = build.DirectionElement[opt.direction];
          $(htmlElem)
            .addClass('shelf-title')
            .text(opt.label)
            .appendTo(shelf);

          // create element container
          $(htmlElem).addClass('shelf-list')
            .appendTo(shelf);

          // attach type and direction
          shelf.data(build.ShelfTypeString, typeString);
          shelf.data(build.DirectionString, opt.direction);

          // add drag&drop
          makeShelfDroppable(shelf);

          // append!
          shelf.appendTo(selection);

          return shelf;
        };


        /**
         * @param labelString The label of the new item.
         * @param shelf The shelf the item is for. It will not be added to the shelf.
         * @returns {*|jQuery}
         */
        build.createShelfItem = function (labelString, shelf) {
          var item = {};
          if (shelf.data(build.DirectionString) == build.DirectionType.horizontal) {
            item = $('<span></span>');
          } else {
            item = $('<div></div>');
          }
          item.addClass('shelf-list-item')
            .text(labelString);
          makeItemDraggable(item);
          makeItemDroppable(item);
          return item;
        };

        /**
         * Adds an item to the shelf passed as selection.
         * @param shelf
         * @param itemString
         * @returns the added item.
         */
        build.addShelfItem = function (shelf, itemString) {
          var item = build.createShelfItem(itemString, shelf);
          var itemContainer = shelf.children('.shelf-list');
          item.appendTo(itemContainer);
          return item;
        };

        return build;
      })();

      /**
       * namespace util: various things, but especially utils for dealing with positions, overlapping, ... of elements
       */
      var util = (function() {

        var logger = Logger.get('pl-util');
        logger.setLevel(Logger.WARN);
        var util = {};

        util.OverlapEnum = Object.freeze({
          // todo: change code to use enum
          left: 'left',
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          center: 'center',
          none: 'none'
        });

        /**
         * Returns the center as {x,y} of the first element of the $selection relative to the document
         * @param $selection
         */
        util.center = function ($selection) {
          var _pos = $selection[0].getBoundingClientRect();
          return {
            x : _pos.left + _pos.width/2,
            y : _pos.top  + _pos.height/2
          };
        };

        /**
         * Returns the type of overlap of the first element of the selection $rel relative to first element of the selection $base.
         * Possible overlaps are: 'no', 'left', 'right', 'bottom', 'top', 'center'
         *
         * @param rel DOM element
         * @param base DOM element
         * @param options {type='abs'|'rel', top, left, bottom, right}.
         */
        util.overlap = function ($rel, $base, options) {

          var o = $.extend( {}, $base[0].getBoundingClientRect() );
          o.width  = o.right  - o.left;
          o.height = o.bottom - o.top;
          o.center = util.center($base);

          // calculate dimensions of inner rectangle
          var i;
          if (options) {
            console.assert(options.type && options.type == 'abs' || options.type == 'rel', "invalid options!");
            if (options.type == 'rel') {
              i = {
                left:  o.center.x - (1-options.left)*0.5*o.width,
                top:   o.center.y - (1-options.top)*0.5*o.height,
                right: o.center.x + (1-options.right)*0.5*o.width,
                bottom:o.center.y + (1-options.bottom)*0.5*o.height
              };
            } else if (type == 'abs') {
              i = {
                left:  o.center.x - options.left,
                top:   o.center.y - options.top,
                right: o.center.x + options.right,
                bottom:o.center.y + options.bottom
              };
            }
          } else {
            i = $base[0].getBoundingClientRect();
          }

          // check overlap
          var relCenter = util.center($rel);
          var p = [relCenter.x, relCenter.y];

          if (util.within(p, [ [o.left, o.top], [i.left, i.top], [i.left, i.bottom], [o.left, o.bottom] ] )) {
            return 'left';
          } else
          if (util.within(p, [ [o.left, o.top], [o.right, o.top], [i.right, i.top], [i.left, i.top]  ] )) {
            return 'top';
          } else
          if (util.within(p, [ [i.right, i.top], [o.right, o.top], [o.right, o.bottom], [i.right, i.bottom] ] )) {
            return 'right';
          } else
          if (util.within(p, [ [i.left, i.bottom], [i.right, i.bottom], [o.right, o.bottom], [o.left, o.bottom] ] )) {
            return 'bottom';
          } else
          if (util.within(p, [ [i.left, i.top], [i.right, i.top], [i.right, i.bottom], [i.left, i.bottom] ] )) {
            return 'center';
          } else {
            return 'no';
          }

        };

        /** Returns true iff the position pos (relative to the document) is within the $selection elem
          *@param pos X,Y position as [top, left]
         * @param $elem
         */
        /*within : function (pos, $elem) {
          var rect = $elem[0].getBoundingClientRect();
          return (rect.left < pos.left && rect.right > pos.left &&
            rect.top < pos.top && rect.bottom > pos.top);
        },*/

        /**
         * Returns true if point is within the polygon vs, false else.
         * @param point A point as 2-element array.
         * @param vs A polygon as an array of 2-element arrays.
         * @returns {boolean} True if within, false else.
         */
        util.within = function (point, vs) {
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
          };

        return util;
      })();


      /**
       * namespace ddr: Drag, Drop and Replace management
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
            return util.overlap(
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
       * Callback functions for dropping
       */
      var onDrop = (function() {

        var logger = Logger.get('pl-onDrop');
        //logger.setLevel(Logger.WARN);

        var onDrop = {};

        // public methods and variables

        /**
         * The default behaviour for dropping is: remove source item from source shelf
         */
        onDrop.default = function (target, source, overlap, event, ui) {
          source.item.remove();
        };

        onDrop[build.ShelfType.field] = function (target, source, overlap, event, ui) {
          if (source.shelfType == build.ShelfType.field) {
            // from field shelf to field shelf
            // -> just append to target shelf
            source.item.appendTo(target.shelf.children('.shelf-list'));
          } else {
            // default: remove from source shelf
            onDrop.default(target, source, overlap, event, ui);
          }
        };

        onDrop[build.ShelfType.layout] = function (target, source, overlap, event, ui) {

          var item;
          if (source.shelfType == build.ShelfType.field) {
            item = build.createShelfItem(source.item.text(), target.shelf);
          } else {
            item = source.item;
          }

          if (target.item) {
            var OverlapEnum = util.OverlapEnum;
            switch (overlap) {
              case OverlapEnum.left:
              case OverlapEnum.top:
                // move to before element
                item.insertBefore(target.item);
                break;
              case OverlapEnum.right:
              case OverlapEnum.bottom:
                // move to after target element
                item.insertAfter(target.item);
                break;
              case OverlapEnum.center:
                // replace
                target.item.replaceWith(item);
                break;
              default:
                console.error("Dropping on item, but overlap = " + overlap);
            }
          } else {
            item.appendTo(target.shelf.children('.shelf-list'));
          }
        };

        onDrop[build.ShelfType.filter] = function (target, source, overlap, event, ui) {
          if (source.shelfType == build.ShelfType.filter) {
            // do nothing if just moving filters
            // todo: allow reordering
          } else {
            // create new filter item
            var newItem = build.createShelfItem('filter based on ' + source.item.text(), target.shelf)

            if (target.item) {
              // replace
              target.item.replaceWith(newItem);
            } else {
              // append
              newItem.appendTo(target.shelf.children('.shelf-list'));
            }
          }
        };

        onDrop[build.ShelfType.color] = function (target, source, overlap, event, ui) {
          // remove any current color item
          target.shelf.find('.shelf-list-item').remove();

          var item = {};
          if (source.shelfType == build.ShelfType.field) {
            // create new item (-> copy)
            item = build.createShelfItem(source.item.text(), target.shelf);
          } else {
            // get existing item (-> move)
            item = source.item;
          }
          item.appendTo(target.shelf.children('.shelf-list'));
        };

        onDrop[build.ShelfType.shape] = onDrop[build.ShelfType.color];

        onDrop[build.ShelfType.size] = onDrop[build.ShelfType.color];

        onDrop[build.ShelfType.remove] = function (target, source, overlap, event, ui) {
          if (source.shelfType != build.ShelfType.field) {
            onDrop.default(target, source, overlap, event, ui);
          }
        };

        return onDrop;

      })();

      /// build up initial DIMENSION and MEASURE shelves and add some elements
      var sourceColumn = $('#sourceColumn');

      var dimShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.field,
        { id: 'dimension-shelf',
          label: 'Dimensions'}
      );
      build.addShelfItem(dimShelf, 'Name');
      build.addShelfItem(dimShelf, 'Home City');

      var measureShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.field,
        { id: 'measure-shelf',
          label: 'Measures'}
      );
      build.addShelfItem(measureShelf, 'Weight');
      build.addShelfItem(measureShelf, 'Height');

      var removeShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.remove,
        { id: 'remove-shelf',
          label: 'Drop here to remove' }
      );

      /// build up initial ASTHETICS shelves and add elements
      var aestheticsColumn = $('#aestheticsColumn');

      var colorShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.color,
        { id: 'color-shelf',
          label: 'Color'}
      );
      build.addShelfItem(colorShelf, 'CurrentColor');

      var shapeShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.shape,
        { id: 'shape-shelf',
          label: 'Shape'}
      );
      build.addShelfItem(shapeShelf, 'CurrentShape');

      var filterShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.filter,
        { id: 'filter-shelf',
          label: 'Filter'}
      );
      build.addShelfItem(filterShelf, 'some filter');
      build.addShelfItem(filterShelf, 'another filter');
      build.addShelfItem(filterShelf, 'a third filter');

      var sizeShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.size,
        { id: 'size-shelf',
          label: 'Size'}
      );

      // build up initial LAYOUT shelf
      var layoutRow = $('#layoutRow');
      var rowShelf = build.addShelf(
        layoutRow,
        build.ShelfType.layout,
        { id: 'row-shelf',
          label: 'Rows',
          direction: build.DirectionType.horizontal }
        );
      var colsShelf = build.addShelf(
        layoutRow,
        build.ShelfType.layout,
        { id: 'cols-shelf',
          label: 'Cols',
          direction: build.DirectionType.horizontal }
      );
    }
  };

});
