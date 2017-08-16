/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', './PQL', './VisMEL', './ResultTable', './SplitSample', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3, PQL, VisMEL, RT, S, ScaleGen, Settings) {
    "use strict";

    var logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    // vis defaults
    var colorscale = {
      density: 'Greys'
    };


    function row_major_RT_to_col_major_RT(rt) {

    }


    function plot(pane, aggrRT, dataRT, uniDensityRT, biDensityRT, query) {

      let layout = query.layout;
      // build traces for plot

      // field usages
      let xfu = layout.cols[0],
        yfu = layout.rows[0];
      // column indices in result table
      let xidx = aggrRT.fu2idx[xfu],
        yidx = aggrRT.fu2idx[yfu];

      // aggregation plot trace
      let aggr_trace = {
        type: 'scatter',
        x: aggrRT[xidx],
        y: aggrRT[yidx],
      };

      // // 2d density plot trace
      // let contour_trace = {
      //   type: 'contour',
      //   x: common_densities.sepal_width,
      //   y: common_densities.sepal_length,
      //   z: common_densities.p,
      //   opacity: 0.3,
      //   colorscale: colorscale.density,
      //   reversescale: true
      // };
      //
      // // samples trace
      // let sample_trace = {
      //   type: 'scatter',
      //   mode: 'markers',
      //   marker: {
      //     symbol: "circle-open"
      //   },
      //   x: samples.sepal_width,
      //   y: samples.sepal_length,
      //   opacity: 0.8
      // };
      //
      // // marginal histogram / density traces
      // let histo_x_trace_data = {
      //   type: 'bar',
      //   x: marginal_densities.sepal_width.value,
      //   y: marginal_densities.sepal_width.data,
      //   xaxis: 'x',
      //   yaxis: 'y2'
      // };
      //
      // let histo_y_trace_model = {
      //   type: 'scatter',
      //   x: marginal_densities.sepal_length.model,
      //   y: marginal_densities.sepal_length.value,
      //   xaxis: 'x2',
      //   yaxis: 'y'
      // };
      //
      // // assemble all traces
      // let data = [
      //   aggr_trace,
      //   sample_trace,
      //   contour_trace,
      //   histo_x_trace_data,
      //   histo_y_trace_model
      // ];
      //
      // // create layout
      // let layout = {
      //   xaxis2: {
      //     domain: [0, 0.1],
      //     autorange: 'reversed'
      //   },
      //   xaxis: {
      //     domain: [0.2, 0.9]
      //   },
      //   yaxis2: {
      //     domain: [0, 0.1],
      //     autorange: 'reversed'
      //   },
      //   yaxis: {
      //     domain: [0.2, 0.9]
      //   }
      // };
      //
      // Plotly.plot(pane, data, layout);
    }

    return {
      plot: plot
    }
  });