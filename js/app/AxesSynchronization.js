/**
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 *
 * This file provides a singelton
 */
define(['cytoscape', 'd3-scale-chromatic','d3-format', 'd3-color', './plotly-shapes', './SplitSample', './Domain', './ViewSettings', './utils'], function (cytoscape, d3chromatic, d3f, d3color, plotlyShapes, ss, Domain, viewSettings, utils) {
  "use strict";


  /**
   * Gets strings like
   *  a) xaxis4000.range[0]: 2.578102064155785
   *  b) yaxis4004.autorange: true
   * and returns a parsed dict like:
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
    // TODO: implement
    return {};
  }


  class AxesSyncManager {

    constructor () {
      // dependency graph
      let dependencies = cytoscape({
        headless: true
      });
    }

    static
    _makeNode(axis) {
      return {
        group: 'nodes',
        data: {
          'id': axis
        },
      }
    }

    static
    _makeEdge(axis1, axis2) {
      return {
        group: 'edge',
        data: {
          'source': axis1,
          'target': axis2,
        }
      }
    }

    /**
     * Link axis with id axis1 and axis with id axis2. Any update that is subsequently applied to either of them wie propagate is also applied to the other one.
     * @param axis1
     * @param axis2
     */
    linkAdd(axis1, axis2) {
      let deps = this.dependencies;

      // add axes as nodes if not there already
      for (let axis of [axis1, axis2])
        if (deps.nodes(`#{axis}`).empty())
            deps.add(AxesSyncManager._makeNode(axis));

      // add link if not there already
      if (deps.edges(`#{axis1} <-> #{axis2}`).empty()) {
        deps.add(_makeEdge(axis1, axis2))
      }
      return this;
    }

    SEARCH FOR "TODO: disabled in favor of global axis linking"

    /**
     * Propagate the list of updates to all dependent axis and return the updated layout.
     * @param update A list of updates (i.e. typically the result of parsing a relayoutstring with parseRelayoutString())
     * @param layout The layout config of a plotly plot to update
     */
    propagate(update, layout) {

      let u = undefined; // for closure of applyUpdate

      // Apply update on given node/axis
      function applyUpdate(node) {
        let axis = layout[node.axis];
        if (u.attr === 'autorange')
          axis.autorange = u.value;
        else if (u.attr === 'range')
          axis.range[u.idx] = u.value;
        else
          throw ValueError("invalid update: {}".format(u))
      }

      for (u of updates) {
        this.dependencies.bfs(this.nodes[u.id], applyUpdate, false);
      }

      return layout;
    }

  }



  return AxesSyncManager;
});
