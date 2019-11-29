define(['lib/emitter', 'cytoscape', 'cytoscape-cola', 'lib/d3-color', './VisUtils'], function (Emitter, cytoscape, cola, d3color, VisUtils) {

  cola(cytoscape); // register cola extension

  /**
   * Convert a 'standard' edge list to suitable format for cytoscape.
   * Each element of the edge list is a 2-element list, with first source and second target node of the edge.
   * @param edges
   */
  function convertEdgeList(edges) {
    return edges.map( edge => ({
          group: 'edges',
          data: {'source': edge[0], 'target': edge[1], 'weight':1, 'originalWeight':1}
        }));
  }

  /**
   * Convert a list of node names to a suitable list of nodes for cytoscape.
   * @param nodenames
   * @returns {any[]}
   */
  function convertNodenameDict(nodenames, dtypes) {
    return nodenames.map( name => ({
        group: 'nodes',
        data: {
          id: name,
          dtype: dtypes.get(name).dataType,
        }
    }));
  }

  const config = {
    defaultNodeDiameter: 26,
    remainingNodeDiameterPrct: 25,
    minEdgeWidth: 1,
    wheelSensitivity: 0.25,

    'line-color': '#929292',
    'arrow-color': '#d4d4d4',
    'line-width': '6px',
    'border-color': '#717171',
    //'border-color': '#232323',
    'border-width': '4px',

  };

  // default style sheet
  let style = [
    {
      selector: 'node',
      style: {
        'background-color': '#efefef',
        'label': 'data(id)',
        'border-width': config["border-width"],
        'border-style': 'dashed',
        'border-color': config["border-color"],
        'width': config.defaultNodeDiameter,
        'height': config.defaultNodeDiameter,
        'shape': ele => (ele.data('dtype') === 'string' ? 'rectangle' : 'ellipse'),
        'font-family': 'Roboto Slab, serif',
        'font-size': "larger",
        'color': '#404040',
        'min-zoomed-font-size': "8px",  //TODO: use min-zoomed-font-size ?
        'text-outline-color': "#FFFFFF",
        'text-outline-opacity': 1,
        'text-outline-width': "1px",
        'z-index': 1,
      }
    },

    {
      selector: '.pl-forced-node',
      style: {
        'border-width': config["border-width"],
        'border-style': 'solid',
        'z-index': 2,
      }
    },

    /* old styles */

    /*{
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
    }, */

    {
      selector: 'edge',
      style: {
        //'width': ele => {return config.minEdgeWidth + (config.defaultNodeDiameter - config.minEdgeWidth) * 0.7 * ele.data('weight')},
        'width': config["line-width"],
        'line-color': config["line-color"],
        'line-style': 'dashed',
        'opacity': 0.8,
        'curve-style': 'straight',
        'z-index': 1,
      }
    },
    
    {
      selector: '.pl-forced-edge',
      style: {
        'line-style': 'solid',
        'mid-target-arrow-shape': 'triangle',
        'mid-target-arrow-color': config["arrow-color"],
        'arrow-scale': 1.7,
        'target-endpoint': 'inside-to-node',
        'z-index': 2,
      }
    },

    {
      selector: '.pl-forbidden-edge',
      style: {
        'line-color': '#ffFFFF',
        // 'line-color': '#ffa5aa',
        // 'width': "10px",
        // 'arrow-scale': 0.6,
        // 'line-color': '#ff727c',
        // 'width': "1px",
        // 'arrow-scale': 3,

        //'line-style': 'solid',
        // 'opacity': .8,
        // 'mid-source-arrow-shape': 'vee',
        // 'mid-source-arrow-color': '#ffc3cb',
        // 'mid-target-arrow-shape': 'vee',
        // 'mid-target-arrow-color': '#ffc3cb',
        'z-index': 0,
      }
    },

/*    {
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
    }*/
  ];

  // defaults for layout
  let layout = {
    'cola': {
      name: 'cola',
      nodeDimensionsIncludeLabels: true,
      ungrabifyWhileSimulating: true,
      padding: 0,
      nodeSpacing: 30,
      //nodeSpacing: function( node ){ return 30; }
      //edgeLength: 150,
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
   *  * represents
   *  * provides visual distinction between different data types of the dimensions:
   *    Categorical ones are encoded as rectangles, while numerical ones are encoded as circles
   *
   * It also provides interactivity as follows:
   *  * user may trigger auto-layout and centering of the plotted graph by double clicking anywhere
   *  * user may reposition a node by left-click dragging
   *  * user may drag a node over to shelves and drop it there by right-click dragging. This triggers a assignment of the dropped dimension to the target shelf, instead of moving the node with the drawing canvas.
   *
   * A Graph Widget also emit events.
   *    Node.DragMoved: passes the id of the moved/dragged node to the event handler
   *    Node.Selected: passes the id of the selected node to the event handler
   *    Node.Unselected: passes the id of the unselected node to the event handler
   */
  class GraphWidget {
    
    constructor(domDiv, graph,  dtypes={}, layoutmode='cola') {

      let graphContainer = $('<div></div>')
          .addClass('dg_graphCanvas-container')
          .appendTo(domDiv);

      if (!graph) {
        graphContainer.append($('<div class=pl-graph-container__message>graph not available</div>'));
        graph = {
          'nodes': [],
          'edges': [],
          'forbidden_edges': [],
          'enforced_edges': [],
          'enforced_node_dtypes': {}
        }
      }

      this._originalNodes = convertNodenameDict(graph.nodes, dtypes);
      this._originalEdges = convertEdgeList([...graph.edges, ...graph.forbidden_edges]);

      this._enforcedCategoricals = new Set();
      this._enforcedNumericals = new Set();
      for (const [name, dtype] of Object.entries(graph.enforced_node_dtypes)) {
        if (dtype === 'string')
          this._enforcedCategoricals.add(name);
        else if (dtype === 'numerical')
          this._enforcedNumericals.add(name);
        else
          throw RangeError();
      }

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

      // setup collection for each type and set class
      this.allNodes = cy.nodes();
      this.allEdges = cy.edges();

      this.enforcedCategoricalNodes = this.allNodes.filter( node => this._enforcedCategoricals.has(node.id()) );
      this.enforcedNumericalNodes = this.allNodes.filter( node => this._enforcedNumericals.has(node.id()) );

      this.enforcedEdges = cy.collection();
      for (const [source, target] of graph.enforced_edges) {
        this.enforcedEdges.merge(
          this.allEdges.filter(`edge[source = "${source}"][target = "${target}"]`))
      }

      this.forbiddenEdges = cy.collection();
      for (const [source, target] of graph.forbidden_edges) {
        this.forbiddenEdges.merge(
          this.allEdges.filter(`edge[source = "${source}"][target = "${target}"]`))
      }

      // set styles
      this.forbiddenEdges.addClass('pl-forbidden-edge');
      this.enforcedEdges.addClass('pl-forced-edge');
      this.enforcedCategoricalNodes.addClass('pl-forced-node');
      this.enforcedNumericalNodes.addClass('pl-forced-node');

      this.selected = cy.collection();
      this.adjacent = cy.collection();
      this.remaining = cy.collection();

      this._threshhold = 0;  // threshold for edge weights to be included in graph visualization

      // this._updateStylings();

      onDoubleClick(cy, ev => {
        this._cy.fit();
        this._layout.run(); // rerun layout!
      });

      // this.allNodes
      //     .on('select', this.onNodeSelect.bind(this))
      //     .on('unselect', this.onNodeUnselect.bind(this))
      //     .map( ele => ele.scratch('_dg', {}));  // create empty namespace scratch pad object for each node

      this._prependRangeSlider(domDiv);
      this._makeToolBar().appendTo(domDiv);

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

    _makeToolBar() {

      let handleWithStopPropagation = handler => {return ev => {handler(); ev.stopPropagation();}};

      // make slider container
      let $container = $('<div></div>')
          .addClass('dg_tool-container');

      let addEdgeHandler = () => {throw "not implemented"};
      VisUtils.button('Add Edge', 'plus')
          .addClass('pl-fu__control-button')
          .on('click', handleWithStopPropagation(addEdgeHandler))
          .appendTo($container);

      let removeEdgeHandler = () => {throw "not implemented"};
      VisUtils.button('Remove Edge', 'minus')
          .addClass('pl-fu__control-button')
          .on('click', handleWithStopPropagation(removeEdgeHandler))
          .appendTo($container);

      let modifyDTypeHandler = () => {throw "not implemented"};
      VisUtils.button('Modify Type', 'categorical')
          .addClass('pl-fu__control-button')
          .on('click', handleWithStopPropagation(modifyDTypeHandler))
          .appendTo($container);

      let applyHandler = () => {throw "not implemented"};
      VisUtils.button('Apply', 'confirm')
          .addClass('pl-fu__control-button')
          .on('click', handleWithStopPropagation(applyHandler))
          .appendTo($container);

      let resetHandler = () => {throw "not implemented"};
      VisUtils.button('Reset', 'revert')
          .addClass('pl-fu__control-button')
          .on('click', handleWithStopPropagation(resetHandler))
          .appendTo($container);

      return $container;
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
      let maxWeight = 1;

      // make slider
      sliderDiv.slider({
        range: "min",
        value: 0,
        min: 0,
        step: maxWeight/200,
        max: maxWeight,
        slide: (event, ui) => {
          valueDiv.text(ui.value.toPrecision(3));
          //this.edgeThreshhold(ui.value);
        }
      });
    }
  /*

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
    } */

    redraw () {
      this._cy.resize();
    }

    /**
     * Sets or gets the threshold
     * @param value
     *
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
    } */

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
      'z-index': 1000, // this is a bit hacky...
    })
  };

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
    if (!this._isDraggable) {
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
    }
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