define(['lib/emitter', 'cytoscape', 'cytoscape-cola', 'lib/d3-color', './VisUtils', './ViewSettings'], function (Emitter, cytoscape, cola, d3color, VisUtils, Settings) {

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

  // TODO: move whole config to SettingsJSON.js
  const config = {
    defaultNodeDiameter: 26,
    remainingNodeDiameterPrct: 25,
    minEdgeWidth: 1,
    wheelSensitivity: 0.25,

    'line-width': '6px',

    'line-color': '#757575',
    'line-color__hover': '#464646',
    'arrow-color': '#d4d4d4',

    'forbidden-line-color': '#ffbec4',
    'forbidden-line-color__hover': '#ff797e',

    'background-color': '#e2e2e2',
    'background-color__hover': '#ffffff',

    'border-color': '#666666',
    'border-color__hover': '#434343',
    'border-width': '4px',

    'transition-duration': '150ms',
  };

  const _prefix = "_dg";

  // default style sheet
  let style = [
    {
      selector: 'node',
      style: {
        'background-color': config['background-color'],
        'border-width': config["border-width"],
        'border-style': 'dashed',
        'border-color': config["border-color"],
        'width': config.defaultNodeDiameter,
        'height': config.defaultNodeDiameter,
        'shape': ele => (ele.data('dtype') === 'string' ? 'rectangle' : 'ellipse'),
        'label': 'data(id)',
        'font-family': 'Roboto Slab, serif',
        'font-size': "larger",
        'color': '#404040',  // color of the label
        'min-zoomed-font-size': "8px",  //TODO: use min-zoomed-font-size ?
        'text-outline-color': "#FFFFFF",
        'text-outline-opacity': 1,
        'text-outline-width': "1.5px",
        'z-index': 1,
        'transition-duration': config['transition-duration'],
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

    {
      selector: '.pl-node--hover',
      style: {
        'border-color': '#434343',
        'background-color': '#ffffff',
        'transition-property': 'background-color border-color',
        'transition-duration': config['transition-duration'],
        // 'border-color':   d3color.color(config["border-color"]).darker(0.6).toString(),
        // 'background-color':   d3color.color(config["background-color"]).darker(0.6).toString(),
        // 'background-color': node => {
        //   let stuff = node.scratch(_prefix);
        //   // for some reason this function is triggered multiple times, even though it should not... we fix it by storing that we have brightened the color already
        //   if ( !stuff['hover'] ) {
        //     stuff.hover = true;
        //     return d3color.color(node.css('background-color')).brighter(0.4).toString();
        //   }
        //   return node.css('background-color');
        // }
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
        'transition-duration': config['transition-duration'],
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
        // 'line-color': '#ffFFFF',
        'line-color': config['forbidden-line-color'],
        // 'line-color': '#ff9492',
        // 'width': "10px",
        // 'arrow-scale': 0.6,
        // 'line-color': '#ff727c',
        // 'width': "1px",
        // 'arrow-scale': 3,

        // 'line-style': 'solid',
        'opacity': .8,
        // 'mid-source-arrow-shape': 'vee',
        // 'mid-source-arrow-color': '#ffc3cb',
        // 'mid-target-arrow-shape': 'vee',
        // 'mid-target-arrow-color': '#ffc3cb',
        'z-index': 0,
        'transition-property': 'opacity line-color',
        'transition-duration': config['transition-duration'],
      }
    },

    {
      selector: '.pl-hidden-edge',
      style: {
        'opacity': 0,
        'transition-property': 'opacity',
        'transition-duration': config['transition-duration'],
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
    },*/

    {
      selector: '.pl-adjacent-edge-to-hovered-node',
      style: {
        // 'line-color': d3color.color(config["line-color"]).darker(1).toString(),
        'line-color': config["line-color__hover"],
        'opacity': 1,
        'z-index': 10,
        'transition-property': 'opacity line-color',
        'transition-duration': config['transition-duration'],
      }
    },

    {
      selector: '.pl-adjacent-edge-to-hovered-node.pl-forbidden-edge',
      style: {
        // 'line-color': d3color.color(config["forbidden-line-color"]).darker(1).toString(),
        'line-color': config["forbidden-line-color__hover"],
        'opacity': 1,
        'z-index': 10,
        'transition-property': 'opacity line-color',
        'transition-duration': config['transition-duration'],
      }
    },
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
      nodeDimensionsIncludeLabels: true,
      // spacingFactor: 1.3,
      padding: 0,
      spacingFactor: 0.6,
      animate: false,
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

  class WidgetInteraction {
    constructor (graphWidget) {
      this._enabled = true;
      this._widget = graphWidget;
      this.registerCallsbacks();
    }

    enable (onoff=true) {
      this._enabled = enable;
    }

    registerCallsbacks () {
      throw "Abstract method registerCallbacks not implemented";
    }
  }

  class EnforcedEdgeInteraction extends WidgetInteraction {

    constructor (graphWidget) {
      super(graphWidget);
    }

    registerCallsbacks () {
      let that = this,
          widget = this._widget;

      // add additional scratchpad data
      widget.enforcedEdges.map( ele => ele.scratch(_prefix).originallyEnforced = true);
      widget.forbiddenEdges.map( ele => ele.scratch(_prefix).originallyForbidden = true);

      function _toggleEdge (ev) {
        if (!that._enabled)
          return;
        let edge = ev.target,
            meta = edge.scratch(_prefix);

        //TODO: Better toggling: automatic -> enforced ->forbidden -> automatic ... ???

        // toggling:
        //  automatic -> enforced ( -> automatic)
        //  forbidden -> enforded ( -> forbidden)


        if (!meta.enforcedEdge && !meta.forbiddenEdge) {
          meta.enforcedEdge = true;
          edge.addClass('pl-forced-edge');

        } else if (meta.forbiddenEdge) {
          meta.enforcedEdge = true;
          meta.forbiddenEdge = false;
          edge.addClass('pl-forced-edge')
              .removeClass('pl-forbidden-edge');

        } else if (meta.enforcedEdge) {
          if (meta.originallyEnforced) {
            meta.enforcedEdge = true;
            meta.forbiddenEdge = false;
            edge.addClass('pl-forced-edge')
                .removeClass('pl-forbidden-edge');
          } else if (meta.originallyForbidden) {
            meta.enforcedEdge = false;
            meta.forbiddenEdge = true;
            edge.addClass('pl-forbidden-edge')
                .removeClass('pl-forced-edge');
          } else {
            meta.enforcedEdge = false;
            meta.forbiddenEdge = false;
            edge.removeClass('pl-forbidden-edge pl-forced-edge');
          }
        }
      }

      widget.allEdges.on('tap', _toggleEdge);
    }

  }

  class DataTypeToggleInteraction extends WidgetInteraction {

    constructor (graphWidget) {
      super(graphWidget);
    }

    registerCallsbacks() {
      let that = this,
          widget = this._widget;

      // add additional scratchpad data
      widget.allNodes.map( ele => ele.scratch(_prefix).originalDtype = ele.data('dtype'));

      function _onNodeClick (ev) {
        if (!that._enabled)
          return;
        let node = ev.target,
            meta = node.scratch(_prefix);

        // toggling: automatic -> enforced string -> enforced numerical -> automatic ...
        if (!meta.enforcedCategorical && !meta.enforcedNumerical) {
          meta.enforcedCategorical = true;
          node.data('dtype', 'string');
          node.addClass('pl-forced-node');
        } else if (meta.enforcedCategorical) {
          meta.enforcedCategorical = false;
          meta.enforcedNumerical = true;
          node.data('dtype', 'numerical')
        } else {
          meta.enforcedCategorical = false;
          meta.enforcedNumerical = false;
          node.data('dtype', meta.originalDtype);
          node.removeClass('pl-forced-node');
        }
      }

      widget.allNodes.on('tap', _onNodeClick);
    }
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
   *
   * TODO: call GraphWidget.redraw() when ever the containing DOM element changes its size in order to redraw the graph accordingly
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
      // this._originalGraph = graph;
      // this._originalNodes = convertNodenameDict(graph.nodes, dtypes);
      // this._originalEdges = ;
      this._showForbiddenEdges = Settings.widgets.ppWidget.forbiddenEdges.showByDefault;

      this._cy = cytoscape({
        container: graphContainer,
        elements: [...convertNodenameDict(graph.nodes, dtypes),
          ...convertEdgeList([...graph.edges, ...graph.forbidden_edges])],
        style: style,
        selectionType: 'additive',
        wheelSensitivity: config.wheelSensitivity,
      });
      this._layout = this._cy.layout(layout[layoutmode]);
      let cy = this._cy;

      this._layout.run();
      // workaround to fit the graph after layout is finished. I dont konw why the other two lines below dont work.
      setTimeout(() => this._cy.fit(), 1000);
      // this._layout.one('layoutstop', () => this._cy.fit());
      // this._cy.one('ready', () => this._cy.fit());

      // build set of enforced nodes
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

      // setup collections
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

      // set meta data as scratch pad data
      this.allNodes.map(ele => ele.scratch(_prefix, {'enforcedCategorical': false, 'enforcedNumerical': false}));
      this.allEdges.map(ele => ele.scratch(_prefix, {'forbiddenEdge': false, 'enforcedEdge': false}));
      this.enforcedCategoricalNodes.map(ele => ele.scratch(_prefix).enforcedCategorical = true);
      this.enforcedNumericalNodes.map(ele => ele.scratch(_prefix).enforcedNumerical = true);
      this.enforcedEdges.map(ele => ele.scratch(_prefix).enforcedEdge = true);
      this.forbiddenEdges.map(ele => ele.scratch(_prefix).forbiddenEdge = true);

      // set styles
      this.forbiddenEdges.addClass('pl-forbidden-edge');
      this.enforcedEdges.addClass('pl-forced-edge');
      this.enforcedCategoricalNodes.addClass('pl-forced-node');
      this.enforcedNumericalNodes.addClass('pl-forced-node');

      // this.selected = cy.collection();
      // this.adjacent = cy.collection();
      // this.remaining = cy.collection();
      // this._updateStylings();
      // this.allNodes
      //     .on('select', this.onNodeSelect.bind(this))
      //     .on('unselect', this.onNodeUnselect.bind(this))
      //      .map( ele => ele.scratch(_prefix, {}));  // create empty namespace scratch pad object for each node

      // build UI
      this._threshhold = 0;  // threshold for edge weights to be included in graph visualization
      $('<div class="dg_tool-container"></div>').append(
          this._makeRangeSlider(), this._makeForbiddenEdgeToggle()
      ).prependTo(domDiv);
      this._makeToolBar().appendTo(domDiv);
      this.$visual = $(domDiv);

      // add interactions
      this._dataTypeToggle = new DataTypeToggleInteraction(this);
      this._dataEnforcedEdgeToggle = new EnforcedEdgeInteraction(this);

      onDoubleClick(cy, ev => {
        this._cy.fit();
        this._layout.run(); // rerun layout!
      });

      Emitter(this);
    }

    /**
     * Given the set of currently selected nodes in this.selected it recalculates and sets all stylings.
     * @private
     */
     _updateStylings() {
      this.allNodes.removeClass('pl-adjacent-node pl-remaining-node');
      this.allEdges.removeClass('pl-adjacent-edge pl-remaining-edge');

      if (this._showForbiddenEdges) {
        this.allEdges.filter('.pl-forbidden-edge').removeClass('pl-hidden-edge');
      } else {
        this.allEdges.filter('.pl-forbidden-edge').addClass('pl-hidden-edge');
      }

      // if (this.selected.size() !== 0) {
      //   this.adjacent = this.selected.openNeighborhood('node[!pl_selected]')
      //       .addClass('pl-adjacent-node');
      //   this.remaining = this.allNodes.subtract(this.adjacent).subtract(this.selected)
      //       .addClass('pl-remaining-node');
      //
      //   let selectedEdges = this.selected.connectedEdges()
      //       .addClass('pl-adjacent-edge');
      //   this.allEdges.subtract(selectedEdges).addClass('pl-remaining-edge');
      // }
    }

    _makeToolBar() {
      let handleWithStopPropagation = handler => {return ev => {handler(); ev.stopPropagation();}};

      // make slider container
      let $container = $('<div class="dg_tool-container"></div>');

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

    _makeForbiddenEdgeToggle() {
      let $container = $('<div class="dg_edgeToggle-container"></div>');

      $('<div class="pl-label">Forbidden Edges</div>')
          .appendTo($container);
      $('<input type="checkbox">')
          .prop({
            "checked": Settings.widgets.ppWidget.forbiddenEdges.showByDefault,
            "disabled": false,
            "id": "dg_forbiddenEdgeToggle"})
          .change( (e) => {
            this._showForbiddenEdges = e.target.checked;
            this._updateStylings();
          }).appendTo($container);
      return $container;
    }

    _makeRangeSlider() {
      // make slider container
      let container = $('<div class="dg_slider-container"></div>').append(
          $('<div class="pl-label dg_slider__label">threshold</div>'),
          $('<div class="pl-label dg_slider__value"></div>').text(0),
      );

      let sliderDiv = $('<div class="dg_slider__slider"></div>')
          .appendTo(container);

      // get maximum of graph weight
      let maxWeight = 1;
      // make slider
      sliderDiv.slider({
        range: "min",
        value: 0,
        min: 0,
        step: maxWeight/250,
        max: maxWeight,
        slide: (event, ui) => {
          valueDiv.text(ui.value.toPrecision(3));
          //this.edgeThreshhold(ui.value);
        }
      });

      return container;
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
    } */

    _onNodeMouseInOut(ev, inOut) {
      let node = ev.target;
      if (inOut === 'out') {
        node.scratch(_prefix).hover = false;
      }

      let adjacentEdges = node.connectedEdges();
      adjacentEdges.toggleClass('pl-adjacent-edge-to-hovered-node');

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