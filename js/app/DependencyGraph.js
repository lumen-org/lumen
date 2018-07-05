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
 *  (i) pl-selected: selected nodes
 *  (ii) pl-adjacent: nodes adjacant to selected nodes, but not selected:
 *  (iii) pl-remaining: nodes that are neither in (i) or (ii)
 *  (iv) pl-default: if no node is selected at all
 *
 * Implements a drag and drop idiom:
 *   * node may be dragged over to shelves and dropped there. this triggers a assignment of the dropped dimension to
 *   the target shelf, instead of moving the node with the drawing canvas.
 *    * nodes may be manually moved around in the drawing cancas.
 *
 */
define(['cytoscape', 'cytoscape-cola', './PQL'], function (cytoscape, cola, PQL) {

  cola(cytoscape); // register cola extension

  // default style sheet
  let style = [
    {
      selector: 'node',
      style: {
        'background-color': '#cecece',
        'label': 'data(id)',
        'border-width': '2px',
        'border-style': 'solid',
        'border-color': "#404040",
        'width': 30,
        'height': 30,
      }
    },

    {
      selector: 'edge',
      style: {
        'width': function (ele) {
          return 4 + 10 * ele.data('weight')
        },
        'line-color': '#ccc',
      }
    },

    {
      selector: '.pl-selected',
      style: {
        'background-color': 'red',
        'border-width': '4px',
        'border-style': 'solid',
        'border-color': "#404040",
      }
    },

    {
      selector: '.pl-adjacent',
      style: {
        'background-color': 'green',
        'border-width': '2px',
        'border-style': 'dashed',
        'border-color': "#404040",
      }
    },

    {
      selector: '.pl-remaining',
      style: {
        'background-color': '#cecece',
        'width': 20,
        'height': 20,
        'border-width': 1,
        // 'background-opacity': 0.4,
        // 'border-opacity': 0.4,
      }
    },

    {
      selector: '.pl-default',
      style: {
        'background-color': 'grey',
      }
    }
  ];

  // defaults for layout
  let layout = {
    name: 'cola',
    nodeDimensionsIncludeLabels: true,
    //edgeLength: edge => edge.data.weight*10,
  };

  function onDoubleClick(cyOrElems, callback) {
    let lastClick = Date.now();
    cyOrElems.on('tap', (...args) => {
      let now = Date.now();
      if ((now - lastClick) < 200) {        
        callback(...args)
      } 
      lastClick = now;
    });
  };

//   function () {
    
//   }


  class GraphWidget {

    constructor(domDiv, graph) {
      this._cy = cytoscape({
        container: $(domDiv),
        elements: [...graph.nodes, ...graph.edges],
        style: style,
        layout: layout
      });
      let cy = this._cy;

      this.selected = cy.collection();
      this.adjacent = cy.collection();
      this.remaining = cy.collection();
      this.allNodes = cy.nodes();

      let dragDiv = undefined;

      //see http://js.cytoscape.org/#events
      this.allNodes
        .on('select', this.onNodeSelect.bind(this))
        .on('unselect', this.onNodeUnselect.bind(this))
        .on('cxttapstart', ev => {
          console.log("drag start");
          let node =  ev.target;
          dragDiv = $('<div></div>').css({
              position: 'absolute',
              left: node.renderedPosition('x'),
              top: node.renderedPosition('y'),
              width: "34px",
              height: "34px",
              'border-radius': "17px",
              border: "2px solid #404040",
              'background-color': 'grey',
            })
            .appendTo(domDiv);
        })
        .on('cxtdrag', (ev) => {
          //console.log(ev);
          dragDiv.css({
            // this prevents the mouse from being directly above this div and hence blocking event triggerings
            left: ev.renderedPosition.x+2,
            top: ev.renderedPosition.y+2,
          });           
        })
      .on('cxttapend', ev => {
        console.log("HITHIT");
        dragDiv.remove();
      })


      this.updateNodes();
      this.allNodes.addClass('pl-default');
      onDoubleClick(this._cy, ev => this._cy.fit());

    }

    updateNodes() {
      this.allNodes.removeClass('pl-adjacent pl-remaining');

      if (this.selected.size() == 0) {
        this.allNodes.addClass('pl-default');
      } else {
        this.adjacent = this.selected.openNeighborhood('node[!pl_selected]')
          .addClass('pl-adjacent');
        this.remaining = this.allNodes.subtract(this.adjacent).subtract(this.selected)
          .addClass('pl-remaining');
      }
    }

    onNodeSelect(ev) {
      //this._cy.batchStart();
      if (this.selected.size() == 0)
        this.allNodes.removeClass('pl-default');

      let node = ev.target;
      this.selected = this.selected.union(node);
      node.toggleClass('pl-selected');
      node.data('pl_selected', true);
      this.updateNodes();
      // this._cy.batchEnd();
    }

    onNodeUnselect(ev) {
      // this._cy.batchStart();
      let node = ev.target;
      this.selected = this.selected.subtract(node);
      node.toggleClass('pl-selected');
      node.data('pl_selected', false);
      this.updateNodes();
      // this._cy.batchEnd();
    }


  }

  return {
    GraphWidget
  };
});