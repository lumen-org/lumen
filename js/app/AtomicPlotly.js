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
     * Utility Function. Depth-first traversal of a (full) tree where internal nodes are d3 maps, and leaves are anything.
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


    let tracer = {};
    /**
     * Build and return traces for aggregation plot, grouped by splits.
     * @param aggrRT
     * @param query
     * @return {Array}
     */
    tracer.aggr = function (aggrRT, query) {
      let xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];

      if (aggrRT !== undefined) {
        let xIdx = aggrRT.fu2idx.get(xfu),
          yIdx = aggrRT.fu2idx.get(yfu);

        // split into more traces by all remaining splits on discrete field
        // i.e.: possibly details, color, shape, size
        let splits = query.fieldUsages('layout', 'exclude')
          .filter(PQL.isSplit)
          .filter(split => split.field.isDiscrete());
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

          // let fmap_color = qaesthetics.color;
          // if (fmap_color instanceof VisMEL.ColorMap) {
          //   let color = aggrRT.byFu.get(fmap_color.fu);
          //   aggr_trace.color = color;
          // }
          traces.push(aggr_trace);
        };

        dfs(aggrNestedRT, attach_aggr_trace, splits.length);
      }

      return traces;
    };

    tracer.aggrNew = function (aggrRT, query, mapper) {
      let xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];

      if (aggrRT !== undefined) {
        let xIdx = aggrRT.fu2idx.get(xfu),
          yIdx = aggrRT.fu2idx.get(yfu);

        // split into more traces by all remaining splits on discrete field
        // i.e.: possibly details, color, shape, size
        let splits = query.fieldUsages('layout', 'exclude')
          .filter(PQL.isSplit)
          .filter(split => split.field.isDiscrete());
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

          let color = mapper.fill;
          aggr_trace.color = _.isFunction(color) ? aggrRT.map(color) : color;

          // let fmap_color = qaesthetics.color;
          // if (fmap_color instanceof VisMEL.ColorMap) {
          //   let color = aggrRT.byFu.get(fmap_color.fu);
          //   aggr_trace.color = color;
          // }
          traces.push(aggr_trace);
        };

        dfs(aggrNestedRT, attach_aggr_trace, splits.length);
      }

      return traces;
    };

    /**
     * marginal histogram / density traces
     * -> up to two traces per axis, one for a histogram of the data and one for a density line chart of the model
     * @param p1dRT
     * @param query
     * @return {Array}
     */
    tracer.uni = function(p1dRT, query) {
      /**
       * Returns a trace for marginal histogram/density of x or y axis.
       * @param data Data for trace.
       * @param xOrY 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @return Object: A trace.
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

      /**
       * Splits given data into subgroups by all splits of the vismel query (but not model vs data splits). For each subgroup an appropriate trace is generated. The array of all traces is returned.
       * @param data The data to split further.
       * @param fu2idx A map of FieldUsages to column indices in the data.
       * @param xOrY 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @return {Array} or traces.
       */
      function getSplittedUniTraces(data, fu2idx, xOrY, modelOrData) {
        // split into more traces by all remaining splits (but not model vs data splits)
        let splits = query.fieldUsages('layout', 'exclude')
          .filter(PQL.isSplit)
          .filter(split => (split.name !== 'model vs data' && split.field.isDiscrete()));
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

      let traces = [];
      let nestByMvd = d3c.nest().key(v => v[0]);
      for (let xOrY of ['x', 'y'])
        if (p1dRT[xOrY] !== undefined) {
          let rt = nestByMvd.map(p1dRT[xOrY]);
          for (let modelOrData of ['model', 'data']) {
            if (rt.get(modelOrData) !== undefined)
              traces.push(...getSplittedUniTraces(rt.get(modelOrData), p1dRT[xOrY].fu2idx, xOrY, modelOrData));
          }
        }
      return traces;
    };

    /** 2d density plot trace builder.
     * @param p2dRT
     * @param query
     * @return {Array}
     */
    tracer.bi = function (p2dRT, query) {
      let traces = []
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
      return traces;
    };

    /**
     * samples trace builder.
     * @param p2dRT
     * @param query
     * @return {Array}
     */
    tracer.samples = function (dataRT, query) {
      let xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];
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
      return traces;
    };

    /**
     * Plot given data in ResultTables into pane, using the scales and mappers of the FieldUsages of the query.
     * @param pane
     * @param query
     */
    function plot(pane, aggrRT, dataRT, p1dRT, p2dRT, query) {

      // empty pane
      Plotly.purge(pane);

      // build up traces
      let traces = [];
      traces.push(...tracer.aggr(aggrRT, query));
      // traces.push(...tracer.samples(dataRT, query));
      // traces.push(...tracer.uni(p1dRT, query));
      // traces.push(...tracer.bi(p2dRT, query));

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
      plot,
      tracer
    }
  });