define(['d3', 'd3legend', './ScaleGenerator'], function (d3, d3legend, ScaleGen) {


  function _filterUndefined(lst) {
    return lst.filter(e => e !== undefined);
  }

  // add color legend
  function colorLegend(svgD3, colorMap, heightOffset) {
    // build scale again ...
    // TODO: reuse the ones build in atomicplots...
    let colorScale = ScaleGen.color(colorMap, _filterUndefined(colorMap.fu.extent));
    let legendG = svgD3.append("g")
      .attr('class', 'pl-legend__color-g')
      .attr('transform', `translate(0,${heightOffset})`);

    let legend = d3.legend.color()
      .shape("rect")
      .shapePadding(7)
      .title(colorMap.fu.yields)
      //.classPrefix('pl-')
      .scale(colorScale)
      .cells(7);

    return legendG.call(legend);
  }

  function shapeLegend(svgD3, shapeMap, heightOffset) {
    let shapeScale = ScaleGen.shape(shapeMap, _filterUndefined(shapeMap.fu.extent), 'svgPath'); // use hand-built svg paths - plotly does not naturally expoze them...
    let legendG = svgD3.append("g")
      .attr('class', 'pl-legend__shape-g')
      // need to move 5 to the right because of some svg issue with the shapes
      .attr('transform', `translate(5,${heightOffset + 20})`);

    let legend = d3.legend.symbol()
      .shapePadding(7)
      .labelOffset(5)
      .title(shapeMap.fu.yields)
      .scale(shapeScale);

    return legendG.call(legend);
  }

  function sizeLegend(svgD3, sizeMap, heightOffset) {
    let sizeScale = ScaleGen.size(sizeMap, _filterUndefined(sizeMap.fu.extent), [3,20]);

    let legendG = svgD3.append("g")
      .attr('class', 'pl-legend__size-g')
      .attr('transform', `translate(0,${heightOffset + 40})`);

    let legend = d3.legend.size()
      .shape('circle')
      .shapePadding(7)
      //.labelOffset(5)
      .title(sizeMap.fu.yields)
      .scale(sizeScale)
      .cells(7);

    return legendG.call(legend);
  }


  /**
   * Clears provided legendDOM and draws a svg-based legend for vismel in there.
   * @param vismel A VisMEL query.
   * @param legendDOM A DOM element to contain the visualization.
   * @param [cssClass] Optional. Defaults to 'pl-legend__svg'. The css class to assign to the svg element that contains the legend.
   */
  function addLegend (vismel, legendDOM, cssClass='pl-legend__svg') {
    // clear legend
    let legendD3 = d3.select(legendDOM);
    legendD3.selectAll("*").remove();
    let svgD3 = legendD3.append("svg").classed(cssClass, true);

    // add legends one after another
    let height = 20;
    if (vismel.used.color) {
      let clrLegend = colorLegend(svgD3, vismel.layers[0].aesthetics.color, height);
      height += clrLegend.node().getBBox().height;
    }
    if (vismel.used.shape) {
      let shpLegend = shapeLegend(svgD3, vismel.layers[0].aesthetics.shape, height);
      height += shpLegend.node().getBBox().height;
    }
    if (vismel.used.size) {
      sizeLegend(svgD3, vismel.layers[0].aesthetics.size, height);
    }
  }

  return addLegend;
});