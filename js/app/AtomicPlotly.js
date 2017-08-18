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

    let logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    // vis defaults
    let colorscale = {
      density: 'Greys'
    };

    let config = {
      pane : {
        height: 600,
        width: 800
      },
      layout : {
        marginal_ratio: 0.15,
        margin: 0.00
      }
    };

    // function default_layout () {
    //   return {
    //     showlegend: false
    //   }
    // }
    //
    // function default_trace () {
    //   return {
    //     showlegend: false
    //   }
    // }

    function row_major_RT_to_col_major_RT(dataTable) {
      // create dataframe from it
      let df = new dfjs.DataFrame(dataTable, dataTable.header);

      // turn to column major
      df = df.transpose();
      let table = df.toArray();

      // reattach maps
      table.fu2idx = dataTable.fu2idx;
      table.idx2fu = dataTable.idx2fu;

      let byfu = new Map();
      table.fu2idx.forEach((idx, fu) => byfu.set(fu, table[idx]));
      table.byFu = byfu;

      // attach direct label accessors
      /*dataTable.header.forEach((name, idx) => {
        asarray[name] = asarray[idx];
      });*/

      return table;
    }


    function plot(pane, aggrRT, dataRT, uniDensityRT, biDensityRT, query) {

      // empty pane
      Plotly.purge(pane);

      // change to column major
      // TODO: in the future we should pass it like this right away
      aggrRT = row_major_RT_to_col_major_RT(aggrRT);
      dataRT = row_major_RT_to_col_major_RT(dataRT);
      uniDensityRT = {
        x: row_major_RT_to_col_major_RT(uniDensityRT.x),
        y: row_major_RT_to_col_major_RT(uniDensityRT.y)
      };
      biDensityRT = row_major_RT_to_col_major_RT(biDensityRT);

      // shortcuts
      let qlayout = query.layout;
      let qaesthetics = query.layers[0].aesthetics;

      // build traces for plot
      // field usages
      let xfu = qlayout.cols[0],
        yfu = qlayout.rows[0];

      // aggregation plot trace
      let aggr_trace = {
        name: 'aggregations',
        type: 'scatter',
        showlegend: false,
        x: aggrRT.byFu.get(xfu),
        y: aggrRT.byFu.get(yfu),
        // TODO: support color, size and shape
      };

      let fmap_color = qaesthetics.color;
      //let color = fmap_color ? aggrRT.byFu.at(fmap_color.fu) :
      if (fmap_color instanceof VisMEL.ColorMap){
        let color = aggrRT.byFu.get(fmap_color.fu);
        aggr_trace.color = color;
      }

      // 2d density plot trace
      let contour_trace = {
        name: '2d density',
        type: 'contour',
        showlegend: false,
        // note: the indizes are by convention!
        x: biDensityRT[0],
        y: biDensityRT[1],
        z: biDensityRT[2],
        opacity: 0.3,
        colorscale: colorscale.density,
        reversescale: true
      };

      // samples trace
      let sample_trace = {
        name: 'samples',
        type: 'scatter',
        mode: 'markers',
        showlegend: false,
        marker: {
          symbol: "circle-open"
        },
        x: dataRT.byFu.get(xfu),
        y: dataRT.byFu.get(yfu),
        opacity: 0.8
      };

      // marginal histogram / density traces
      let histo_x_trace_data = {
        name: 'data marginal on x',
        type: 'bar',
        showlegend: false,
        x: uniDensityRT.x[0],
        y: uniDensityRT.x[1],
        xaxis: 'x',
        yaxis: 'y2'
      };

      let histo_y_trace_model = {
        name: 'model marginal on y',
        type: 'scatter', // defaults to line chart
        showlegend: false,
        x: uniDensityRT.y[1],
        y: uniDensityRT.y[0],
        xaxis: 'x2',
        yaxis: 'y'
      };

      // assemble all traces
      let data = [
        aggr_trace,
        sample_trace,
        contour_trace,
        histo_x_trace_data,
        histo_y_trace_model
      ];

      let c = config;

      // create layout
      let layout = {
        xaxis2: {
          domain: [0, c.layout.marginal_ratio - c.layout.margin],
          autorange: 'reversed'
        },
        xaxis: {
          domain: [c.layout.marginal_ratio + c.layout.margin, 1]
        },
        yaxis2: {
          domain: [0, c.layout.marginal_ratio - c.layout.margin],
          autorange: 'reversed'
        },
        yaxis: {
          domain: [c.layout.marginal_ratio + c.layout.margin, 1]
        },
        height: c.pane.height,
        width: c.pane.width
      };

      Plotly.plot(pane, data, layout);
    }

    return {
      plot: plot
    }
  });