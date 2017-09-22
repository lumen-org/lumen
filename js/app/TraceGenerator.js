/**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * What is a trace?
 *
 *  * in plotly a trace is one plotting 'act'.
 *  * if anything is drawn as a line chart, then one line (including its marks) is represented by one trace
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3-collection', './PQL', './VisMEL', './ResultTable', './SplitSample', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3c, PQL, VisMEL, RT, S, ScaleGen, c) {
    "use strict";

    let logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    /**
     * Returns column with index col_idx of row-major data table data.
     *
     * If colIdx is undefined or null then it returns an array length data.length with all values equal to deflt.
     */
    function selectColumn(data, colIdx, deflt=0) {
      return (colIdx== null ?
        new Array(data.length).fill(deflt) :
        data.map(e => e[colIdx]));
    }

    /**
     * Utility function that applies a map, which is based on the fieldUsage fu, to data. The correct column of the data is selected by fu2idx.
     * @param data Data
     * @param map A map, i.e. either a scalar value or a function.
     * @param fu The FieldUsage that is mapped
     * @param fu2idx A Map from FieldUsages to the column index in data.
     * @return {Array|*} Either a scalar, or an array of the same length than data.
     */
    function applyMap(data, map, fu, fu2idx) {
      return _.isFunction(map) ? selectColumn(data, fu2idx.get(fu)).map(map) : map;
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

    /**
     * Utility function. Splits the result table rt into hierarchical data for traces and returns this nested data.
     * @param query A vismel query.
     * @param rt A result Table.
     */
    function splitRTIntoTraceData (rt, query) {
      // split into more traces by all remaining splits on discrete field
      // i.e.: possibly details, color, shape, size
      let splits = query.fieldUsages('layout', 'exclude')
        .filter(PQL.isSplit)
        .filter(split => split.field.isDiscrete());
      let split_idxs = splits.map(split => rt.fu2idx.get(split));

      // build nesting function
      let nester = d3c.nest();
      for (let idx of split_idxs)
        nester.key(e => e[idx]);

      // nest it!
      return [nester.map(rt), splits.length,];
    }


    let tracer = {};

    tracer.aggrHeatmap = function (rt, query, mapper) {
      let fu2idx = rt.fu2idx,
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];

      // this may not be used if any mapping on shape or size is present in query!
      if (aest.shape instanceof VisMEL.ShapeMap) throw RangeError("Cannot use aggrHeatmap if shape is in use!");
      if (aest.size instanceof VisMEL.SizeMap) throw RangeError("Cannot use aggrHeatmap if size is in use!");
      if (!(aest.color instanceof VisMEL.ColorMap)) throw RangeError("Cannot use aggrHeatmap if color is _not_ in use!");

      // in fact no split, other than on rows and cols may be present, since we wouldn't know how to visualize the split within one heatmap tile
      // TODO if ()

      if (rt !== undefined) {
        let xIdx = fu2idx.get(xfu),
          yIdx = fu2idx.get(yfu),
          colorIdx = fu2idx.get(aest.color.fu),
          colorMap = mapper.markersFillColor;
        if (!_.isFunction(colorMap)) throw TypeError("Didn't expect that. Implement this case!");
        let colorTable = ScaleGen.asTable(colorMap.scale),
          colorDomain = colorMap.scale.domain();

        let attach_aggr_trace = (data) => {
          let trace = {
            name: 'aggregations',
            type: 'heatmap',
            x: selectColumn(data, xIdx),
            y: selectColumn(data, yIdx),
            z: selectColumn(data, colorIdx), // TODO: how to handle discrete z data??
            showscale: false,
            autocolorscale: false,
            colorscale: colorTable,
            zauto: false,
            zmin: colorDomain[0],
            zmax: colorDomain[colorDomain.length-1],
          };
          traces.push(trace);
        };

        // no nesting necessary (no further splitting present)
        // let [nestedData, depth] = splitRTIntoTraceData(rt, query);

        // create and attach trace for each group, i.e. each leave in the nested data
        //dfs(nestedData, attach_aggr_trace, depth);
        attach_aggr_trace(rt);
      }

      return traces;
    };

    /**
     * Build and return traces for aggregation scatter plot, grouped by splits.
     * @param rt
     * @param query
     * @return {Array}
     */
    tracer.aggr = function (rt, query, mapper) {
      let fu2idx = rt.fu2idx,
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];

      if (rt !== undefined) {
        let xIdx = fu2idx.get(xfu),
          yIdx = fu2idx.get(yfu);

        let [nestedData, depth] = splitRTIntoTraceData(rt, query);

        // create and attach trace for each group, i.e. each leave in the nested data
        let attach_aggr_trace = (data) => {
          let trace = {
            name: 'aggregations',
            type: 'scatter',
            showlegend: false,
            x: selectColumn(data, xIdx),
            y: selectColumn(data, yIdx),
            opacity: 0.9,
            marker: {
              showscale: false,
              // sizemode: 'area',
            },
            line: {
            },
          };

          // marker color, size and shape
          trace.marker.color = applyMap(data, mapper.markersFillColor, aest.color.fu, fu2idx);
          trace.marker.size = applyMap(data, mapper.markersSize, aest.size.fu, fu2idx);
          trace.marker.symbol = applyMap(data, mapper.aggrShape, aest.shape.fu, fu2idx);

          // line color and width
          let lcmap = mapper.lineColor;
          trace.line.color = _.isFunction(lcmap) ? lcmap(data[0][fu2idx.get(aest.color.fu)]): lcmap;
          // TODO: problem: I cannot (easily) draw lines with changing color. Also no changing width ... :-(
          //trace.line.color = applyMap(data, mapper.lineColor, aest.color.fu, fu2idx);

          // TODO: changing line width is possible: https://plot.ly/javascript/filled-area-animation/#multiple-trace-filled-area
          // trace.line.width = applyMap(data, mapper.size, aest.size.fu, fu2idx);

          traces.push(trace);
        };

        dfs(nestedData, attach_aggr_trace, depth);
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
    tracer.uni = function(p1dRT, query, mapper, mode="") {

      let aest = query.layers[0].aesthetics;

      /**
       * Returns a trace for marginal histogram/density of x or y axis.
       * @param data Data for trace.
       * @param xOrY 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @param fu2idx
       * @return Object: A trace.
       */
      function getUniTrace(data, xOrY, modelOrData, fu2idx) {
        let xIdx = (xOrY === 'x'? 1 : 2),
          yIdx = (xOrY === 'x'? 2 : 1),
          xAxis = (xOrY === 'x'? 'x' : 'x2'),
          yAxis = (xOrY === 'x'? 'y2' : 'y');

        // is axis field usage numeric or categorical, i.e. histogram or barchar?
        let axisFu = query.layout[xOrY === 'x'? 'cols' : 'rows'][0];

        let trace = {
          name: modelOrData + ' marginal on ' + xOrY,
          showlegend: false,
          x: selectColumn(data, xIdx),
          y: selectColumn(data, yIdx),
          xaxis: xAxis,
          yaxis: yAxis,
        };

        let lcmap = mapper.marginalColor;
        // whole line gets same color, or all lines has uniform color anyway
        let color = _.isFunction(lcmap) ? lcmap(data[0][fu2idx.get(aest.color.fu)]): lcmap;

        if (PQL.hasNumericYield(axisFu)) {
          // line chart trace
          _.extendOwn(trace, {
            //type: modelOrData === 'model' ? 'scatter' : 'bar',
            //type: PQL.hasNumericYield(axisFu) ? 'scatter' : 'bar',
            type: 'scatter',
            mode: 'lines',
            line: {
              color: color,
              width: 2, // TODO
            },
          });
          if (modelOrData === 'data') {
            trace.line.shape = (xOrY === 'x' ? 'hvh' : 'vhv');
          }
          // TODO: add trace annotations for shape support and other?
          // see: https://plot.ly/javascript/line-charts/#labelling-lines-with-annotations
        }
        else {
          // bar chart trace
          _.extendOwn(trace, {
            //type: modelOrData === 'model' ? 'scatter' : 'bar',
            type: 'bar',
            orientation: xOrY === 'x' ? 'v' : 'h',
            opacity: c.map.uniDensity.bar.opacity,
            marker: {
              color: color,
            },
          });
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
        dfs(nestedData, leafData => traces.push(getUniTrace(leafData, xOrY, modelOrData, fu2idx)), splits.length);
        return traces;
      }

      let traces = [];
      let nestByMvd = d3c.nest().key(v => v[0]); // nest by value of first column, which is by convention the 'model vs data' column.
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
     *
     * The created trace depends on the data type of the fields on rows and cols:
     *   * both numerical: greyscale contour map
     *   * both discrete: greyscale heatmap
     *   * mixed: no trace
     *
     * @param rt
     * @param query
     * @return {Array}
     */
    tracer.bi = function (rt, query, mapper) {
      let traces = [];
      if (rt !== undefined) {

        // note: the indexes are by convention!
        let xfu = rt.idx2fu[0],
         yfu = rt.idx2fu[1];

        let trace = {
          name: '2d density',
          // type: ,
          showlegend: false,
          showscale: false,
          x: selectColumn(rt, 0),
          y: selectColumn(rt, 1),
          z: selectColumn(rt, 2),
          opacity: 0.3,
          colorscale: c.map.biDensity.colorscale,
          reversescale: true
        };

        if (PQL.hasNumericYield(xfu) && PQL.hasNumericYield(yfu)) {
          trace.type = 'contour';
          // _.extend(trace, {
          //   type: 'contour',
          //   colorscale: c.map.biDensity.colorscale,
          //   reversescale: true
          // });
          // let contour_trace = {
            // name: '2d density',
            // showlegend: false,
            // showscale: false,
            // x: selectColumn(rt, 0),
            // y: selectColumn(rt, 1),
            // z: selectColumn(rt, 2),
            // opacity: 0.3,
            // colorscale: c.map.biDensity.colorscale,
            // reversescale: true
          // };
          traces.push(trace);
        }
        else if (PQL.hasDiscreteYield(xfu) && PQL.hasDiscreteYield(yfu)) {
          trace.type = 'heatmap';
          // let heatmap_trace = {
          //   name: '2d density',
          //   type: 'heatmap',
          //   x: selectColumn(data, 0),
          //   y: selectColumn(data, 1),
          //   z: selectColumn(data, 2), // TODO: how to handle discrete z data??
          //   opacity: 0.3,
          //   showscale: false,
          //   autocolorscale: false,
          //   colorscale: c.map.biDensity.colorscale,
          //   zauto: false,
          //   zmin: colorDomain[0],
          //   zmax: colorDomain[colorDomain.length-1],
          // }
          traces.push(trace);
        }
      }
      return traces;
    };

    /**
     * samples trace builder.
     * @param data
     * @param query
     * @return {Array}
     */
    tracer.samples = function (data, query, mapper) {
      let fu2idx = data.fu2idx,
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [];

      if (data !== undefined) {
        let xIdx = fu2idx.get(xfu),
          yIdx = fu2idx.get(yfu);
        let trace = {
          name: 'samples',
          type: 'scatter',
          mode: 'markers',
          showlegend: false,
          marker: {
            symbol: "circle-open"
          },
          x: selectColumn(data, xIdx),
          y: selectColumn(data, yIdx),
          opacity: 0.6,
          // TODO: support color, size and shape
        };

        // marker color, size and shape
        trace.marker.color = applyMap(data, mapper.markersFillColor, aest.color.fu, fu2idx);
        trace.marker.size = applyMap(data, mapper.markersSize, aest.size.fu, fu2idx);
        trace.marker.symbol = applyMap(data, mapper.samplesShape, aest.shape.fu, fu2idx);
        // TODO:
        // trace.marker.symbol = mapApply(data, mapper.shape, aest.shape.fu, fu2idx);

        traces.push(trace);
      }
      return traces;
    };

    return tracer;

  });