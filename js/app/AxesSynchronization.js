/**
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 *
 */

define(['cytoscape'], function (cytoscape) {
  "use strict";

  /**
   * Converts strings like
   *  a) xaxis4000.range[0]: 2.578102064155785
   *  b) yaxis4004.autorange: true
   * into dicts like:
   *  a) {
   *       'id': x4000,
   *       'xy': x,
   *       'axis': xaxis4000,
   *       'attr': 'range',
   *       'idx': 0
   *       'value': 2.578102064155785,
   *     }
   *  b) {
   *       'id': y4004,
   *       'xy': y,
   *       'axis': yaxis4004,
   *       'attr': 'autorange',
   *       'value': true
   *     }
   * @param str
   */
  function parseRelayoutString(str) {

    // regex magic ...
    let m = str.match(/^([xy])axis([0-9]+)\.([a-z]+)(.*):\s*(.*)$/);

    return {
      id: m[1]+m[2],
      xy: m[1],
      axis: m[1]+'axis'+m[2],
      attr: m[3],
      value: (m[3] === 'range' ? +m[5] : m[5].toLocaleLowerCase() === 'true'),
      idx: (m[3] === 'range'?m[4][1]:undefined),
    };
  }


  function parseRelayoutDict(dict) {
    let lst = [];
    for (let k of Object.keys(dict))
      lst.push(parseRelayoutString(k + ": " + dict[k]))
    return lst;
  }


  function _makeNode(axis) {
    return {
      group: 'nodes',
      data: {
        'id': axis
      },
    }
  }


  function _makeEdge(axis1, axis2) {
    return {
      group: 'edges',
      data: {
        'source': axis1,
        'target': axis2,
      }
    }
  }


  class AxesSyncManager {

    constructor () {
      // dependency graph
      this.dependencies = cytoscape({
        headless: true
      });
    }

    /**
     * Link axis with id axis1 and axis with id axis2. Any update that is subsequently applied to either of them wie propagate is also applied to the other one.
     * @param axis1 {String} id of axis1
     * @param axis2 {String} id of axis2
     */
    linkAdd(axis1, axis2) {
      if (axis1 === axis2)
        return;

      let deps = this.dependencies;
      // add axes as nodes if not there already
      for (let axis of [axis1, axis2])
        if (deps.nodes(`#${axis}`).empty()) 
            deps.add(_makeNode(axis));

      // add link if not there already
      if (deps.edges(`#${axis1} <-> #${axis2}`).empty())
        deps.add(_makeEdge(axis1, axis2));
      return this;
    }

    /**
     * Propagate the list of updates to all dependent axis and return the updated layout.
     * @param update A list of updates (i.e. typically the result of parsing a relayoutstring with parseRelayoutString())
     * @param layout The layout config of a plotly plot to update
     */
    propagate(update, layout) {

      let u = undefined,  // for closure of applyUpdate
        deps = this.dependencies;  // shorthand

      // Apply update on given node/axis
      function applyUpdate(node) {
        // layout xaxis has format [xy]axis[0-9]+, but ours is [xy][0-9]+ 
        let id = node.id();
        let axis = layout[`${id[0]}axis${id.slice(1)}`];
        if (u.attr === 'autorange') {
          axis.autorange = u.value;
          if (!axis.autorange)
            delete axis.range;
        }
        else if (u.attr === 'range') {
          axis.autorange = false;
          if (!axis.range)
            axis.range = [undefined, undefined];
          axis.range[u.idx] = u.value;
        } else
          throw ValueError(`invalid update: ${u}`);
      }

      for (u of update) {
        deps.elements().bfs(deps.nodes(`#${u.id}`), applyUpdate);
      }

      return layout;
    }
  }

  return {
    AxesSyncManager,
    parseRelayoutString,
    parseRelayoutDict
  };

});