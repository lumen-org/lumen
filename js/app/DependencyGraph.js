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
define(['cytoscape', 'cytoscape-cola', './interaction', './PQL'], function (cytoscape, cola, inter, PQL) {

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
  }


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

      this.updateNodes();
      this.allNodes.addClass('pl-default');
      onDoubleClick(this._cy, ev => this._cy.fit());

      this.allNodes
        .on('select', this.onNodeSelect.bind(this))
        .on('unselect', this.onNodeUnselect.bind(this));
    }

    updateNodes() {
      this.allNodes.removeClass('pl-adjacent pl-remaining');

      if (this.selected.size() === 0) {
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
      if (this.selected.size() === 0)
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


  function makeDragGhostForNode(node) {
    return $('<div></div>').css({
      position: 'absolute',
      left: node.renderedPosition('x'),
      top: node.renderedPosition('y'),
      width: "34px",
      height: "34px",
      'border-radius': "17px",
      border: "2px solid #404040",
      'background-color': 'grey',
    })
  }

  /**
   * Mixin to make a GraphWidget draggable on calling.
   */
  GraphWidget.prototype._reset_drag = function () {
    this.draggedObject = {};
    if (this.dragGhost)
      this.dragGhost.remove();
    this.dragState = "not_dragging";
  };

  GraphWidget.prototype.draggable = function () {
    this._reset_drag();
    this._isDraggable = true;
    this._dropTargets = new Set();
    let that = this;

    //see http://js.cytoscape.org/#events
    this.allNodes
      .on('cxttapstart', ev => {
        console.log("drag start");
        let node = ev.target;

        that.draggedObject.node = node;
        that.draggedObject.field = node.data('field');

        that.dragGhost = makeDragGhostForNode(node)
          .appendTo(that._cy.container());
        that.dragState = "dragging";
      })
      .on('cxtdrag', (ev) => {
        that.dragGhost.css({
          // this prevents the mouse from being directly above this div and hence blocking event triggerings
          left: ev.renderedPosition.x+2,
          top: ev.renderedPosition.y+2,
        });
      })
      .on('cxttapend', ev => {
        console.log("widget drag end");
        that._reset_drag();
      })

  };

  /**
   * Registers drag'n'drop handlers for the DOM element domElem.
   *
   * You may specify any of the handlers dragEnter, dragLeave, dragOver, drop as key : value pairs in the handlers object.
   * The semantic is as follows:
   *  * dragEnter: called if domElem or any of its childred is entered during the drag of an element of this GraphWidget
   *  * dragLeave: ... is left ...
   *  * drag: called continuously if a drag is moved over domElem
   *  * drop: called if mouseup occurs on domElem during drag.
   *
   * The handlers are called with one object as an arguments that has two keys:
   *  * event: the underlying event that occured
   *  * dragged: a dict with various information about the object being dragged.
   *
   * @param domElem
   * @param handlers
   * @param eventFilter
   */
  GraphWidget.prototype.addDropTarget = function (domElem, handlers, eventFilter = () => true) {
    if (!this._isDraggable)
      throw "Cannot add drop target to undraggable GraphWidget. Call .draggable() before!";
    
    /**
     * Augments a given handler by:
     *   * only calling it if there is currently a drag under go.
     *   * changing the arguments to provide information on the dragged object
     * @param handler
     * @returns {function(...[*])}
     */
    let that = this;
    function augmentHandler (handler) {
      return (event, ...args) => {
        if (that.dragState === 'dragging' && eventFilter(event, ...args))
          // only if currently draggin!
          return handler({event:event, dragged: that.draggedObject, args: args});
      }
    }

    // augment all handlers and assign
    let augmentedHandlers = {};
    for (let key in handlers)
      augmentedHandlers[key] = augmentHandler(handlers[key]);

    // register handler: dragEnterHandler, dragLeaveHandler, dragOverHandler, dropHandler
    // see also: https://developer.mozilla.org/en-US/docs/Web/Events
    if (handlers.dragEnter) {
      domElem.addEventListener('mouseover', augmentedHandlers.dragEnter)
    }
    if (handlers.dragLeave) {
      domElem.addEventListener('mouseout', augmentedHandlers.dragLeave)
    }
    if (handlers.drop) {
      domElem.addEventListener('mouseup', augmentedHandlers.drop)
    }
    if (handlers.dragOver) {
      domElem.addEventListener('mousemove', augmentedHandlers.dragOver)
    }

    // TODO: remove handler if domElem is destroyed
    // TODO: add to dropTargets?
  };

  return {
    GraphWidget,
  };
});