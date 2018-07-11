/**
 .
 *
 * @module interaction
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger'], function (Logger) {
  'use strict';

  // let logger = Logger.get('pl-interaction');
  // logger.setLevel(Logger.INFO);

  let _OverlapEnum = Object.freeze({
    left: 'left',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    center: 'center',
    none: 'none'
  });

  let _OverlapMargins = Object.freeze({
    type: 'rel',
    top: 0.35, left: 0.3,
    bottom: 0.35, right: 0.3
  });

  /**
   * Functions for calculating positions and overlaps of DOM elements.
   * @type {{center: Function, within: Function, overlap: Function}}
   * @private
   */
  let _geom = {
    /**
     * Returns the center as {x,y} of the first element of the $selection relative to the document
     * @param elem DOM element.
     */
    center: function (elem) {
      let _pos = elem.getBoundingClientRect();
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
      let x = point[0], y = point[1],
        inside = false,
        xi, xj, yi, yj, intersect;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        xi = vs[i][0];
        yi = vs[i][1];
        xj = vs[j][0];
        yj = vs[j][1];
        intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
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
    overlap: function (relPos, elem, options=_OverlapMargins) {
      let o = $.extend({}, elem.getBoundingClientRect());
      o.width = o.right - o.left;
      o.height = o.bottom - o.top;
      o.center = _geom.center(elem);

      // calculate dimensions of inner rectangle
      let i;
      if (options) {
        console.assert(options.type && options.type === 'abs' || options.type === 'rel', "invalid options!");
        if (options.type === 'rel') {
          i = {
            left: o.center.x - (1 - options.left) * 0.5 * o.width,
            top: o.center.y - (1 - options.top) * 0.5 * o.height,
            right: o.center.x + (1 - options.right) * 0.5 * o.width,
            bottom: o.center.y + (1 - options.bottom) * 0.5 * o.height
          };
        } else if (type === 'abs') {
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
      let ovrlp = _OverlapEnum.none;
      if (_geom.within(relPos, [[o.left, o.top], [i.left, i.top], [i.left, i.bottom], [o.left, o.bottom]])) {
        ovrlp = _OverlapEnum.left;
      } else if (_geom.within(relPos, [[o.left, o.top], [o.right, o.top], [i.right, i.top], [i.left, i.top]])) {
        ovrlp = _OverlapEnum.top;
      } else if (_geom.within(relPos, [[i.right, i.top], [o.right, o.top], [o.right, o.bottom], [i.right, i.bottom]])) {
        ovrlp = _OverlapEnum.right;
      } else if (_geom.within(relPos, [[i.left, i.bottom], [i.right, i.bottom], [o.right, o.bottom], [o.left, o.bottom]])) {
        ovrlp = _OverlapEnum.bottom;
      } if (_geom.within(relPos, [[i.left, i.top], [i.right, i.top], [i.right, i.bottom], [i.left, i.bottom]])) {
        ovrlp = _OverlapEnum.center;
      }
      return ovrlp;
    }
  };


  /**
   * @type {{clear: _highlight.clear, set: _highlight.set}}
   * @private
   */
  let _highlight = {
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

  return {
    overlap: _geom.overlap,
    setHighlight: _highlight.set,
    clearHighlight: _highlight.clear,
  };
});