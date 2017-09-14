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

    // TODO?
    let trace = {
      aggr: () => {
        return 0
      },
    };

    function plot(pane, aggrRT, dataRT, p1dRT, p2dRT, query) {

      // empty pane
      Plotly.purge(pane);

      // shortcuts
      let qlayout = query.layout;
      let qaesthetics = query.layers[0].aesthetics;

      // array of all traces to show. to be filled
      let traces = [];

      // build traces for plot
      // field usages
      let xfu = qlayout.cols[0],
        yfu = qlayout.rows[0];

      // aggregation plot trace
      // if (aggrRT !== undefined) {
      //   aggrRT = row_major_RT_to_col_major_RT(aggrRT);
      //   let aggr_trace = {
      //     name: 'aggregations',
      //     type: 'scatter',
      //     showlegend: false,
      //     x: aggrRT.byFu.get(xfu),
      //     y: aggrRT.byFu.get(yfu),
      //     // TODO: support color, size and shape
      //   };
      //
      //   let fmap_color = qaesthetics.color;
      //   if (fmap_color instanceof VisMEL.ColorMap) {
      //     let color = aggrRT.byFu.get(fmap_color.fu);
      //     aggr_trace.color = color;
      //   }
      //   traces.push(aggr_trace);
      // }

      /**
       * Depth-first traversal of a (full) tree where internal nodes are maps, and leaves are anything.
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

      // aggregation plot traces, grouped by splits
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


      // 2d density plot trace
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

      // samples trace
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

      // marginal histogram / density traces
      // -> up to two traces per axis, one for a histogram of the data and one for a density line chart of the model
      let nestByMvd = d3c.nest().key(v => v[0]);

      if (p1dRT.x !== undefined) {
        // group by model vs data
        let rt = nestByMvd.map(p1dRT.x);

        // x axis marginal data histogram
        let rt_data =  rt.get('data');
        if (rt_data !== undefined) {
          let histo_x_trace_data = {
            name: 'data marginal on x',
            type: 'bar',
            showlegend: false,
            x: select_column(rt_data, 1),
            y: select_column(rt_data, 2),
            xaxis: 'x',
            yaxis: 'y2'
          };
          traces.push(histo_x_trace_data);
        }

        // x axis marginal model density plot
        let rt_model =  rt.get('model');
        if (rt_model !== undefined) {
          let histo_x_trace_model = {
            name: 'model marginal on x',
            type: 'scatter',
            showlegend: false,
            x: select_column(rt_model, 1),
            y: select_column(rt_model, 2),
            xaxis: 'x',
            yaxis: 'y2'
          };
          traces.push(histo_x_trace_model);
        }
      }

      if (p1dRT.y !== undefined) {
        // group by model vs data
        let rt = nestByMvd.map(p1dRT.y);

        // y axis marginal data histogram
        let rt_data =  rt.get('data');
        if (rt_data !== undefined) {
          let histo_y_trace_data = {
            name: 'data marginal on y',
            type: 'bar',
            showlegend: false,
            x: select_column(rt_data, 2),
            y: select_column(rt_data, 1),
            xaxis: 'x2',
            yaxis: 'y',
            orientation: 'h'
          };
          traces.push(histo_y_trace_data);
        }

        // y axis marginal model density plot
        let rt_model =  rt.get('model');
        if (rt_model !== undefined) {
          let histo_y_trace_model = {
            name: 'model marginal on y',
            type: 'scatter',
            showlegend: false,
            x: select_column(rt_model, 2),
            y: select_column(rt_model, 1),
            xaxis: 'x2',
            yaxis: 'y'
          };
          traces.push(histo_y_trace_model);
        }
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