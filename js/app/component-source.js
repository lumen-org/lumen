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


      function dropOnShelf (event, ui, overlap) {
        if (overlap == util.OverlapEnum.none) {
          console.error("Dropping on shelf, but overlap = " + util.OverlapEnum.none);
          return;
        }

        // ignore overlap and add at the end of target shelf
        var targetList = $(event.target).children('.shelf-list');
        var sourceItem = $(ui.draggable);

        // todo: remove or copy from source?
        sourceItem.appendTo(targetList);
      }


      function dropOnItem (event, ui, overlap) {
        // todo: remove or copy from source?
        var sourceItem = $(ui.draggable);
        var OverlapEnum = util.OverlapEnum;
        if (overlap == OverlapEnum.left || overlap == OverlapEnum.top) {
          // move to before element
          sourceItem.insertBefore($(event.target));
        } else
        if (overlap == OverlapEnum.right || overlap == OverlapEnum.bottom) {
          // move to after target element
          sourceItem.insertAfter($(event.target));
        } else
        if (overlap == OverlapEnum.center) {
          // replace
          $(event.target).replaceWith(sourceItem);
        } else {
          console.error("Dropping on item, but overlap = " + overlap);
          return;
        }
      }


      /**
       * namespace build: Methods for building up the DOM with Shelfs and Shelf elements
       */
      var build = (function() {

        var build = {};

        // private methods and variables


        // public methods and variables


        build.ShelfType = Object.freeze({
          field: 'fieldShelf',
          layout: 'layoutShelf',
          filter: 'filterShelf',
          aestetic: 'aesteticShelf',
          remove: 'removeShelf'
        });


        //build.ItemType = Object.freeze({
        //
        //});

        /**
         * Adds a shelf as a <ul> to each element of the passed selection.
         * @param selection The selection
         * @param typeString The type of the shelf.
         * @param idString String that will used as ID for the added shelf-<div> element
         * @param headerString The label of the shelf.
         * @returns the added shelf.
         */
        build.addShelf = function (selection, typeString, idString, headerString) {

          var shelf = $('<div></div>')
            .addClass('shelf row panel')
            .attr('id',idString)
            .appendTo(selection);

          $('<div></div>')
            .addClass('shelf-title')
            .text(headerString)
            .appendTo(shelf);

          $('<ul></ul>').addClass('shelf-list')
            .appendTo(shelf);

          // attach type to shelf
         // shelf.data('shelfType', typeString);

          return shelf;
        };

        /**
         * Adds an item as <li> to the shelf passed as selection
         * @param selection
         * @param itemString
         * @returns the added item.
         */
        build.addShelfItem = function (selection, itemString) {

          var item = $('<li></li>')
            .addClass('shelf-list-item')
            .text(itemString)
            .appendTo(selection);

          return item;
        };

        return build;
      })();

      /**
       * namespace util: various things, but especially utils for dealing with positions, overlapping, ... of elements
       */
      var util = (function() {

        // private stuff
        var logger = Logger.get('pl-util');
        logger.setLevel(Logger.WARN);

        // object to export
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
           * Returns the type of overlap of the current draggable in relative to the current droppable.
           * Possible types of overlap: no, left, right, bottom, top, center
           */
          overlap: function () {
            console.assert(draggable && droppable);
            var margin = 0.3;
            return util.overlap(draggable, droppable, {type: 'rel', top: margin, left: margin, bottom: margin, right: margin} );
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
       * Shelf-type based callback functions for dropping
       */
      var onDrop = (function() {

        var onDrop = {};

        // public methods and variables

        onDrop[build.ShelfType.field] = function () {
          // todo
        };

        onDrop[build.ShelfType.layout] = function () {
          // todo
        };

        onDrop[build.ShelfType.filter] = function () {
          // todo
        };

        onDrop[build.ShelfType.aestetic] = function () {
          // todo
        };

        onDrop[build.ShelfType.remove] = function () {
          // todo
        };

        return onDrop;

      })();

      /// build up initial DIMENSION and MEASURE shelves and add some elements
      var sourceColumn = $('#sourceColumn');

      var dimShelf = build.addShelf(sourceColumn, build.ShelfType.field, 'dimension-shelf', 'Dimensions');
      var dimList = $('#dimension-shelf .shelf-list');
      build.addShelfItem(dimList, 'Name');
      build.addShelfItem(dimList, 'Home City');

      var measureShelf = build.addShelf(sourceColumn, build.ShelfType.field, 'measure-shelf', 'Measures');
      var measList = $('#measure-shelf .shelf-list');
      build.addShelfItem(measList, 'Weight');
      build.addShelfItem(measList, 'Height');

      var removeShelf = build.addShelf(sourceColumn, build.ShelfType.remove, 'remove-shelf', 'Please drop here to remove');

      /// build up initial ASTHETICS shelves and add elements
      var aesteticsColumn = $('#aesteticsColumn');

      var colorShelf = build.addShelf(aesteticsColumn, build.ShelfType.aestetic, 'color-shelf', 'Color');
      var colorList = $('#color-shelf .shelf-list');
      build.addShelfItem(colorList, 'Blue');
      build.addShelfItem(colorList, 'Green');

      var shapeShelf = build.addShelf(aesteticsColumn, build.ShelfType.aestetic, 'shape-shelf', 'Shape');
      var shapeList = $('#shape-shelf .shelf-list');
      build.addShelfItem(shapeList, 'Round');
      build.addShelfItem(shapeList, 'Tohuwabohu');

      var filterShelf = build.addShelf(aesteticsColumn, build.ShelfType.filter, 'filter-shelf', 'Filter');

      var sizeShelf = build.addShelf(aesteticsColumn, 'size-shelf', 'Size');


      /// DRAG & DROP using jQuery UI
      // draggables
      $('#dimension-shelf .shelf-list-item, ' +
        '#measure-shelf .shelf-list-item').draggable({
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

      // droppables (shelves)
      $([dimShelf, measureShelf, removeShelf])
        .add('#dimension-shelf .shelf-list-item, #measure-shelf .shelf-list-item')
        .droppable({
          scope: 'vars',
          activeClass: 'drop-allow',
          hoverClass: 'drop-hover',
          greedy: true,
          tolerance: "pointer",

          drop: function (event, ui) {
            if (!(ddr.linkDraggable() && ddr.linkDroppable())) {
              // todo: why is the event triggered again on the shelf, if it was actually dropped on an shelf-list-item?
              return;
            }

            // two types of targets
            var $target = $(event.target);
            if ($target.hasClass('shelf')) {
              console.log('drop on shelf!');
              dropOnShelf(event, ui);
            } else if ($target.hasClass('shelf-list-item')) {
              console.log('drop on shelf-list-item!');
              dropOnItem(event, ui, ddr.overlap());
            }

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

      // droppables (items)
/*      $([]).droppable({

      })*/

      // source: can be dragged, but not dropped on it

      // drain: can receive drops, cannot be dragged


    }
  };

});
