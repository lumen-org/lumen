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

define(['lib/logger', 'lib/d3-collection', './PQL', './VisMEL', './ResultTable', './SplitSample', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3c, PQL, VisMEL, RT, S, ScaleGen, Settings) {
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

      // attach direct label accessors
      table.byFu = RT.getByFuAccessor(table);

      return table;
    }

    function select_column(data, col_idx) {
      return data.map(e => e[col_idx]);
    }

    /**
     * Utility Function. Depth-first traversal of a (full) tree where internal nodes are maps, and leaves are anything.
     * @param tree The tree to traverse
     * @param fct Function to apply on all leaves. The leave is passed to the function.
     * @param max_depth Depth of all leaves.
     * @param depth Current depth. Start with 0.
     * @param msg debug.
     */
    function dfs (tree, fct, max_depth, depth=0, msg="") {
      if (depth >= max_depth)
      // apply function on leave level (tree is a leave now!)
        fct(tree);
      else
      // recurse down, i.e. tree is a map
        tree.each( (value, key) => dfs(value, fct, max_depth, depth+1, msg+"+"));
    }

    function plot(pane, aggrRT, dataRT, p1dRT, p2dRT, query) {

      // empty pane
      Plotly.purge(pane);

      // shortcuts
      let qlayout = query.layout;
      let qaesthetics = query.layers[0].aesthetics;

      // array of all traces to show. to be filled
      let traces = [];

      // build traces for plot
      let xfu = qlayout.cols[0],
        yfu = qlayout.rows[0];

      // ### aggregation plot traces, grouped by splits
      if (aggrRT !== undefined) {
        let xIdx = aggrRT.fu2idx.get(xfu),
          yIdx = aggrRT.fu2idx.get(yfu);

        // split into more traces by all remaining splits
        // i.e.: possibly details, color, shape, size
        let splits = query.fieldUsages('layout', 'exclude').filter(PQL.isSplit);
        let split_idxs = splits.map(split => aggrRT.fu2idx.get(split));

        // build nesting function
        let nester = d3c.nest();
        for (let idx of split_idxs)
          nester.key(e => e[idx]);

        // nest it!
        let aggrNestedRT = nester.map(aggrRT);

        // create and attach trace for each group, i.e. each leave in the nested data
        let attach_aggr_trace = (data) => {
          let aggr_trace = {
            name: 'aggregations',
            type: 'scatter',
            showlegend: false,
            x: select_column(data, xIdx),
            y: select_column(data, yIdx),
            // TODO: support color, size and shape
          };
          traces.push(aggr_trace);
        };
        dfs(aggrNestedRT, attach_aggr_trace, splits.length);

        // let fmap_color = qaesthetics.color;
        // if (fmap_color instanceof VisMEL.ColorMap) {
        //   let color = aggrRT.byFu.get(fmap_color.fu);
        //   aggr_trace.color = color;
        // }
      }

      // ### marginal histogram / density traces
      // -> up to two traces per axis, one for a histogram of the data and one for a density line chart of the model

      /**
       * Returns a trace for marginal histogram/density of x or y axis.
       * @param data Data for trace.
       * @param xOrY 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @return A trace.
       */
      function getUniTrace(data, xOrY, modelOrData) {
        let xIdx = (xOrY === 'x'? 1 : 2),
          yIdx = (xOrY === 'x'? 2 : 1),
          xAxis = (xOrY === 'x'? 'x' : 'x2'),
          yAxis = (xOrY === 'x'? 'y2' : 'y');

        let trace = {
          name: modelOrData + ' marginal on ' + xOrY,
          //type: modelOrData === 'model' ? 'scatter' : 'bar',
          type: 'scatter',
          showlegend: false,
          x: select_column(data, xIdx),
          y: select_column(data, yIdx),
          xaxis: xAxis,
          yaxis: yAxis
        };
        if (modelOrData === 'data') {
          trace.line = {shape: 'vh'};
        }
        return trace;
      }

      function getSplittedUniTraces(data, fu2idx, xOrY, modelOrData) {
        // split into more traces by all remaining splits (but not model vs data splits)
        let splits = query.fieldUsages('layout', 'exclude').filter(PQL.isSplit)
          .filter(split => split.name !== 'model vs data');
        let split_idxs = splits.map(split => fu2idx.get(split));

        // build nesting function
        let nester = d3c.nest();
        for (let idx of split_idxs)
          nester.key(e => e[idx]);

        // nest it!
        let nestedData = nester.map(data);

        let traces = [];
        dfs(nestedData, leaveData => traces.push(getUniTrace(leaveData, xOrY, modelOrData)), splits.length);
        return traces;
      }

      let nestByMvd = d3c.nest().key(v => v[0]);
      for (let xOrY of ['x', 'y'])
        if (p1dRT[xOrY] !== undefined) {
          let rt = nestByMvd.map(p1dRT[xOrY]);
          for (let modelOrData of ['model', 'data']) {
            if (rt.get(modelOrData) !== undefined)
              traces.push(...getSplittedUniTraces(rt.get(modelOrData), p1dRT[xOrY].fu2idx, xOrY, modelOrData));
          }
        }

      // ### 2d density plot trace
      if (p2dRT !== undefined) {
        p2dRT = row_major_RT_to_col_major_RT(p2dRT);
        let contour_trace = {
          name: '2d density',
          type: 'contour',
          showlegend: false,
          // note: the indexes are by convention!
          x: p2dRT[0],
          y: p2dRT[1],
          z: p2dRT[2],
          opacity: 0.3,
          colorscale: colorscale.density,
          reversescale: true
        };
        traces.push(contour_trace);
      }

      // ### samples trace
      if (dataRT !== undefined) {
        dataRT = row_major_RT_to_col_major_RT(dataRT);
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
          // TODO: support color, size and shape
        };
        traces.push(sample_trace);
      }

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

      Plotly.plot(pane, traces, layout);
    }

    return {
      plot: plot
    }
  });