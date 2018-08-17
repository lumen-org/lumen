define(['lib/emitter', 'cytoscape', 'cytoscape-cola', 'd3-color'], function (Emitter, cytoscape, cola, d3color) {

  cola(cytoscape); // register cola extension

  /**
   * Convert a 'standard' edge list to suitable format for cytoscape.
   * @param edges
   */
  function convertEdgeList(edges) {

    // get min and max of weights for normalization
    let min_=Infinity, max_=-Infinity;
    for (let edge of edges) {
      if (edge.weight < min_)
        min_ = edge.weight;
      if (edge.weight > max_)
        max_ = edge.weight;
    }

    if (min_ < 0)
      throw RangeError("edges may not have negative weights!");
    min_ = 0;
    let len = max_ - min_;

    return edges.map(edge => {
      for (let prop of ['source', 'target', 'weight'])
        if (!edge.hasOwnProperty(prop))
          throw RangeError("missing '{1}' property in edge_ {2}".format(prop, edge.toString()));
      return {
        group: 'edges',
        // normalize weights to [0,1]
        data: Object.assign({}, edge, {'weight': (edge.weight - min_)/len, 'originalWeight': edge.weight}),
      }
    })
  }

  /**
   * Convert a Dictionary of indexes (that bear no meaning) to node names to a suitable list of nodes for cytoscape.
   * @param nodenames
   * @returns {any[]}
   */
  function convertNodenameDict(nodenames) {
    return Object.values(nodenames).map( name=> {
      return {
        group: 'nodes',
        data: {
          id: name
        },
      }
    });
  }


  const config = {
    defaultNodeDiameter: 30,
    remainingNodeDiameterPrct: 25,
    minEdgeWidth: 1,
    wheelSensitivity: 0.25,
  };

  // default style sheet
  let style = [
    {
      selector: 'node',
      style: {
        'background-color': '#a8a8a8',
        'label': 'data(id)',
        'border-width': '1px',
        'border-style': 'solid',
        'border-color': "#7f7f7f",
        'width': config.defaultNodeDiameter,
        'height': config.defaultNodeDiameter,
        'font-family': 'Roboto Slab, serif',
        'color': '#404040',
        //TODO: use min-zoomed-font-size ?
      }
    },

    {
      selector: '.pl-selected-node',
      style: {
        'background-color': '#cc7137',
        'border-width': '4px',
        'border-style': 'solid',
        'border-color': "#404040",
      }
    },

    {
      selector: '.pl-adjacent-node',
      style: {
        'border-width': '3px',
        'border-style': 'dashed',
        'border-color': "#626262",
      }
    },

    {
      selector: '.pl-remaining-node',
      style: {
        'background-color': '#cecece',
        'width': config.remainingNodeDiameterPrct,
        'height': config.remainingNodeDiameterPrct,
        'border-width': 1,
        'opacity': 0.7,
        // 'background-opacity': 0.4,
        // 'border-opacity': 0.4,
      }
    },

    {
      selector: 'edge',
      style: {
        'width': ele => {return config.minEdgeWidth + (config.defaultNodeDiameter - config.minEdgeWidth) * 0.7 * ele.data('weight')},
        'line-color': '#d7d7d7',
        'opacity': 0.6,
        //'curve-style': 'bezier',
      }
    },

    {
      selector: '.pl-adjacent-edge',
      style: {
        'line-color': '#cc7137',
        'opacity': 0.6,
      }
    },

    {
      selector: '.pl-remaining-edge',
      style: {
        'line-color': '#d6d6d6',
        'opacity': 0.4,
      }
    },

    {
      selector: '.pl-node--hover',
      style: {
        // 'background-color': '#d8d8d8',
        'background-color': node => {          
          let stuff = node.scratch('_dg');
          // for some reason this function is triggered multiple times, even though it should not... we fix it by storing that we have brightened the color already
          if ( !stuff['hover'] ) {
            stuff.hover = true;
            return d3color.color(node.css('background-color')).brighter(0.4).toString();
          }
          return node.css('background-color');
        }
      }
    }
  ];

  // defaults for layout
  let layout = {
    'cola': {
      name: 'cola',
      nodeDimensionsIncludeLabels: false,
      ungrabifyWhileSimulating: true,
      //edgeLength: 150,
      padding: 0,
      nodeSpacing: function( node ){ return 30; }
      //edgeLength: edge => edge.data.weight*10,
    },
    'circle': {
      name: 'circle',
      nodeDimensionsIncludeLabels: false,
      padding: 0,
      animate: true,
    }
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

  /**
   * This widget display a graph whose nodes represent dimensions. It:
   *  * represents the dimensions of a given remote model
   *  * represents a given weighted edge structure between all pairs of dimensions
   *  * provides visual distinction between different data types of the dimensions
   *
   * It also provides interactivity as follows:
   *  * user may select a node by clicking on it
   *  * user may select multiple nodes by holding ctrl and clicking on nodes
   *  * user may deselect all node by clicking anywhere in the widget
   *  * user may trigger auto-layout and centering of the plotted graph by double clicking anywhere
   *  * user may reposition a node by left-click dragging
   *  * user may drag a node over to shelves and drop it there by right-click dragging. This triggers a assignment of the dropped dimension to the target shelf, instead of moving the node with the drawing canvas.

   * Selection causes a classification of the nodes, as follows
   *  (i) pl-selected-node: selected nodes
   *  (ii) pl-adjacent-node: nodes adjacant to selected nodes, but not selected:
   *  (iii) pl-remaining-node: nodes that are neither in (i) or (ii)
   *  (iv) pl-default-node: if no node is selected at all
   *
   * A Graph Widget also emit events.
   *    Node.DragMoved: passes the id of the moved/dragged node to the event handler
   *    Node.Selected: passes the id of the selected node to the event handler
   *    Node.Unselected: passes the id of the unselected node to the event handler
   */
  class GraphWidget {

    constructor(domDiv, graph, layoutmode='cola') {

      this._originalNodes = convertNodenameDict(graph.nodes);
      this._originalEdges = convertEdgeList(graph.edges);      

      let graphContainer = $('<div></div>')
        .addClass('dg_graphCanvas-container')
        .appendTo(domDiv);

      this._cy = cytoscape({
        container: graphContainer,
        elements: [...this._originalNodes, ...this._originalEdges],
        style: style,
        selectionType: 'additive',
        wheelSensitivity: config.wheelSensitivity,
      });
      this._layout = this._cy.layout(layout[layoutmode]);
      this._layout.run();      
      let cy = this._cy;

      this.selected = cy.collection();
      this.adjacent = cy.collection();
      this.remaining = cy.collection();
      this.allNodes = cy.nodes();
      this.allEdges = cy.edges();
      this._threshhold = 0;  // threshold for edge weights to be included in graph visualization

      this._updateStylings();
      onDoubleClick(cy, ev => {
        this._cy.fit();
        this._layout.run(); // rerun layout!
      });

      this.allNodes
        .on('select', this.onNodeSelect.bind(this))
        .on('unselect', this.onNodeUnselect.bind(this))
        .map( ele => ele.scratch('_dg', {}));  // create empty namespace scratch pad object for each node

      this._excludedEdges = cy.collection();
      this._prependRangeSlider(domDiv);

      this.$visual = $(domDiv);
      Emitter(this);
    }

    /**
     * Given the set of currently selected nodes in this.selected it recalculates and sets all stylings.
     * @private
     */
    _updateStylings() {
      this.allNodes.removeClass('pl-adjacent-node pl-remaining-node');
      this.allEdges.removeClass('pl-adjacent-edge pl-remaining-edge');

      if (this.selected.size() !== 0) {
        this.adjacent = this.selected.openNeighborhood('node[!pl_selected]')
          .addClass('pl-adjacent-node');
        this.remaining = this.allNodes.subtract(this.adjacent).subtract(this.selected)
          .addClass('pl-remaining-node');

        let selectedEdges = this.selected.connectedEdges()
          .addClass('pl-adjacent-edge');
        this.allEdges.subtract(selectedEdges).addClass('pl-remaining-edge');
      }
    }

    _prependRangeSlider(domDiv) {
      // make slider container
      let container = $('<div></div>')
        .addClass('dg_slider-container')
        .prependTo(domDiv);

      $('<div>threshold </div>')
        .addClass('pl-label dg_slider__label')
        .appendTo(container);

      let sliderDiv = $('<div></div>')
        .addClass('dg_slider__slider')
        .appendTo(container);

      let valueDiv = $('<div></div>')
        .addClass('pl-label dg_slider__value')
        .text(0)
        .appendTo(container);

      // get maximum of graph weight
      let maxWeight = this.allEdges.max(
        ele => ele.data('originalWeight')
      ).value*1.1;

      // make slider
      sliderDiv.slider({
          range: "min",
          value: 0,
          min: 0,
          step: maxWeight/200,
          max: maxWeight,
          slide: (event, ui) => {
            valueDiv.text(ui.value.toPrecision(3));
            this.edgeThreshhold(ui.value);
          }
        });
    }

    onNodeSelect(ev) {
      //this._cy.batchStart();
      // if (this.selected.size() === 0)
      //   this.allNodes.removeClass('pl-default-node');

      let node = ev.target;
      this.selected = this.selected.union(node);
      node.toggleClass('pl-selected-node');
      node.data('pl_selected', true);
      this._updateStylings();
      // this._cy.batchEnd();

      this.emit('Node.Selected', node.id());
    }

    onNodeUnselect(ev) {
      // this._cy.batchStart();
      let node = ev.target;
      this.selected = this.selected.subtract(node);
      node.toggleClass('pl-selected-node');
      node.data('pl_selected', false);
      this._updateStylings();
      // this._cy.batchEnd();
      this.emit('Node.Unselected', node.id());
    }

    _onNodeMouseInOut(ev, inOut) {
      let node = ev.target;
      if (inOut === 'out')
        node.scratch('_dg').hover = false;
      // (un)highlight node
      node.toggleClass('pl-node--hover');
      // indicate with mouse cursor that the node is draggable 'drag' or return to default cursor
      $(this._cy.container()).toggleClass('dg_graphCanvas-container--hover-on-node');
    }

    redraw () {
      this._cy.resize();
    }

    /**
     * Sets or gets the threshold
     * @param value
     */
    edgeThreshhold (value=undefined) {
      if (value === undefined)
        return this._threshhold;

      // possibly include edges that are now excluded
      if (value < this._threshhold) {
           let toRestore = this._excludedEdges.filter(`edge[originalWeight >= ${value}]`);
           this._excludedEdges = this._excludedEdges.subtract(toRestore);
           toRestore.restore();
      }
      // possible exclude edges that are not included
      else if (value > this._threshhold) {
        let toExclude = this._cy.remove(`edge[originalWeight < ${value}]`);
        this._excludedEdges = this._excludedEdges.union(toExclude);
      }
      this.allEdges = this._cy.edges();
      this._threshhold = value;
      this._updateStylings();
    }

  }


  GraphWidget.prototype.makeDragGhostForNode = function (node) {
    let boundingRect = this._cy.container().getBoundingClientRect();    
    return $('<div class="dg-drag-ghost"></div>').css({
      position: 'fixed',
      left: boundingRect.x + node.renderedPosition('x'),
      top: boundingRect.y + node.renderedPosition('y'),
      width: "34px",
      height: "34px",
      'border-radius': "17px",
      border: "2px solid #404040",
      'background-color': 'grey',
      'z-index': 100000, // this is a bit hacky...
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
    //see http://js.cytoscape.org/#events
    this.allNodes

      .on('cxttapstart', ev => {
        let node = ev.target;

        this.draggedObject.node = node;
        this.draggedObject.field = node.data('field');

        this.dragGhost = this.makeDragGhostForNode(node)
          .appendTo(this._cy.container());
        this.dragState = "dragging";
      })
      .on('cxtdrag', (ev) => {
        let boundingRect = this._cy.container().getBoundingClientRect();
        this.dragGhost.css({
          // this prevents the mouse from being directly above this div and hence blocking event triggerings
          left: boundingRect.x + ev.renderedPosition.x+2,
          top: boundingRect.y + ev.renderedPosition.y+2,
        });
      })
      .on('cxttapend', ev => this._reset_drag())
      .on('tapend', ev => this.emit("Node.DragMoved", ev.target.id()))
      .on('mouseover', ev => this._onNodeMouseInOut(ev, "in"))
      .on('mouseout', ev => this._onNodeMouseInOut(ev, "out"))
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
  };

  return GraphWidget;
});