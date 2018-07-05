/**
 * This module provides a widget to display a graph whos nodes represent dimensions. It:
 *  * represents the dimensions of a given remote model
 *  * represents a given weighted edge structure between all pairs of dimensions
 *  * provides visual distinction between different data types of the dimensions
 *
 * It also provides interactivity as follows:
 *  * user may select one or multiple nodes
 *
 * Selection causes a classification of the nodes, as follows
 *  (i) pl-dc-selected: selected nodes
 *  (ii) pl-dc-adjacent: nodes adjacant to selected nodes, but not selected:
 *  (iii) pl-dc-remaining: nodes that are neither in (i) or (ii)
 *  (iv) pl-dc-default: if no node is selected at all
 *
 * Implements a drag and drop idiom:
 *   * node may be dragged over to shelves and dropped there. this triggers a assignment of the dropped dimension to
 *   the target shelf, instead of moving the node with the drawing canvas.
 *    * nodes may be manually moved around in the drawing cancas.
 *
 */
define(['cytoscape', 'cytoscape-cola', './PQL'], function (cytoscape, cola, PQL) {

  cola(cytoscape); // register cola extension

  function makeWidget(id, graph) {

    let cy = cytoscape({
      container: $(id),

      elements: [...graph.nodes, ...graph.edges],

      style: [ // the stylesheet for the graph
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(id)'
          }
        },

        {
          selector: 'edge',
          style: {
            'width': 'data(weight)',
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle'
          }
        }
      ],

      layout: {
        name: 'cola',
      }

    });
  }




  return {
    makeWidget
  }
});