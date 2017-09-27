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
 *  todo: speed optimize by providing much more information to axis? is that premature opt? probably...
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3-collection', './PQL', './VisMEL', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3c, PQL, VisMEL, ScaleGen, c) {
    "use strict";

    let logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    /**
     * Converts an array of string values into an array of integer values, using the extent array as conversion array.
     * @param arr
     * @param extent
     */
    function toIntegerLevels (arr, extent) {
      let str2int = d3c.map();
      extent.forEach( (str, idx) => str2int.set(str, idx) );
      return arr.map(val => str2int.get(val));
    }

    /**
     * Returns column with index col_idx of row-major data table data.
     *
     * If colIdx is undefined or null then it returns an array length data.length with all values equal to deflt.
     */
    function selectColumn(data, colIdx, deflt = 0) {
      return (colIdx == null ?
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
    function dfs(tree, fct, max_depth, depth = 0, msg = "") {
      if (depth >= max_depth)
      // apply function on leave level (tree is a leave now!)
        fct(tree);
      else
      // recurse down, i.e. tree is a map
        tree.each((value, key) => dfs(value, fct, max_depth, depth + 1, msg + "+"));
    }

    /**
     * Utility function. Splits the result table rt into hierarchical data for traces and returns this nested data.
     * @param query A vismel query.
     * @param rt A result Table.
     */
    function splitRTIntoTraceData(rt, query) {
      // split into more traces by all remaining splits on discrete field
      // i.e.: possibly details, color, shape, size
      let xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        splits = query.fieldUsages(['layout'], 'exclude')
          .filter(PQL.isSplit).filter(split => split.field.isDiscrete());

      // if there is a cont. split on both, rows and cols, then split by both!
      if (PQL.isSplit(xfu) && PQL.hasNumericYield(xfu) && PQL.isSplit(yfu) && PQL.hasNumericYield(yfu))
        splits.push(xfu, yfu);

      let split_idxs = _.uniq(splits.map(split => rt.fu2idx.get(split)));

      // build nesting function
      let nester = d3c.nest();
      for (let idx of split_idxs)
        nester.key(e => e[idx]);

      // nest it!
      return [nester.map(rt), splits.length,];
    }


    let tracer = {};

    tracer.aggrHeatmap = function (rt, query, mapper, axisId={x:'x', y:'y'}) {
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
      if (rt !== undefined) {
        if (!_.isFunction(mapper.aggrFillColor)) throw TypeError("Didn't expect that. Implement this case!");

        let colorFu = aest.color.fu,
          colorIdx = fu2idx.get(colorFu),
          colorTable, colorDomain, colorData;
        // plotly heatmaps require to use a colorscale. It's impossible to ise a manual color specification

        if (PQL.hasDiscreteYield(colorFu)) {
          // create step-wise continuous color table
          colorTable = [];
          let colorMapper = mapper.aggrFillColor,
            len = colorFu.extent.length;

          let convertMap = d3c.map();
          colorFu.extent.forEach((v, idx) => {
            let color = colorMapper(v);
            colorTable.push([idx/len,color], [(idx+1)/len,color]);
            convertMap.set(v, idx)
          });

          // convert categorial data to integer values
          colorData = selectColumn(rt, colorIdx).map(v => convertMap.get(v));
          colorDomain = [0, colorFu.extent.length-1];
        } else {
          colorTable = ScaleGen.asTable(mapper.aggrFillColor.scale);
          colorDomain = colorFu.extent;
          colorData = selectColumn(rt, colorIdx);
        }

        // no nesting necessary (no further splitting present)
        let trace = {
          name: 'aggregations',
          type: 'heatmap',
          x: selectColumn(rt, fu2idx.get(xfu)),
          y: selectColumn(rt, fu2idx.get(yfu)),
          z: colorData,
          xaxis: axisId.x,
          yaxis: axisId.y,
          showscale: false,
          autocolorscale: false,
          colorscale: colorTable,
          zauto: false,
          zmin: colorDomain[0],
          zmax: colorDomain[1],
          opacity: c.map.heatmap.opacity[PQL.hasDiscreteYield(colorFu) ? "discrete" : "continuous"],
        };
        traces.push(trace);
      }

      return traces;
    };

    /**
     * Build and return traces for aggregation scatter plot, grouped by splits.
     * @param rt
     * @param query
     * @return {Array}
     */
    tracer.aggr = function (rt, query, mapper, axisId={x:'x', y:'y'}) {
      let fu2idx = rt.fu2idx,
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [],
        cfg = c.map.aggrMarker;

      if (rt !== undefined) {
        let [nestedData, depth] = splitRTIntoTraceData(rt, query);

        // create and attach trace for each group, i.e. each leave in the nested data
        let attach_aggr_trace = (data) => {
          let trace = {
            name: 'aggregations',
            type: 'scatter',
            showlegend: false,
            cliponaxis: false,
            x: selectColumn(data, fu2idx.get(xfu)),
            y: selectColumn(data, fu2idx.get(yfu)),
            xaxis: axisId.x,
            yaxis: axisId.y,
            opacity: cfg.fill.opacity,
            marker: {
              color : applyMap(data, mapper.aggrFillColor, aest.color.fu, fu2idx),
              size : applyMap(data, mapper.aggrSize, aest.size.fu, fu2idx),
              symbol : applyMap(data, mapper.aggrShape, aest.shape.fu, fu2idx),
              line : {
                color: cfg.stroke.color,
                width: cfg.stroke.width
              },
              showscale: false,
              // sizemode: 'area',
            },
            line: {},
          };

          let lcmap = mapper.lineColor;
          trace.line.color = _.isFunction(lcmap) ? lcmap(data[0][fu2idx.get(aest.color.fu)]) : lcmap;
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
    tracer.uni = function (p1dRT, query, mapper, mainAxisId={x:'x', y:'y'}, marginalAxisId={x:'x2', y:'y2'}) {

      let aest = query.layers[0].aesthetics;

      /**
       * Returns a trace for marginal histogram/density of x or y axis.
       * @param data Data for trace.
       * @param xy 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @param fu2idx
       * @return Object: A trace.
       */
      function getUniTrace(data, xy, modelOrData, fu2idx) {
        let xIdx = (xy === 'x' ? 1 : 2),
          yIdx = (xy === 'x' ? 2 : 1);

        // is axis field usage numeric or categorical, i.e. histogram or barchar?
        let axisFu = query.layout[xy === 'x' ? 'cols' : 'rows'][0];

        let xAxis = (xy === 'x' ? mainAxisId.x : marginalAxisId.x),
          yAxis = (xy === 'x' ? marginalAxisId.y : mainAxisId.y);
        // let xAxis = (xy === 'x' ? 'x' : 'x2'),
        //   yAxis = (xy === 'x' ? 'y2' : 'y');

        let trace = {
          name: modelOrData + ' marginal on ' + xy,
          showlegend: false,
          x: selectColumn(data, xIdx),
          y: selectColumn(data, yIdx),
          xaxis: xAxis,
          yaxis: yAxis,
        };

        let lcmap = mapper.marginalColor;
        // whole line gets same color, or all lines has uniform color anyway
        let color = _.isFunction(lcmap) ? lcmap(data[0][fu2idx.get(aest.color.fu)]) : lcmap;

        if (PQL.hasNumericYield(axisFu)) {
          // line chart trace
          _.extendOwn(trace, {
            //type: modelOrData === 'model' ? 'scatter' : 'bar',
            //type: PQL.hasNumericYield(axisFu) ? 'scatter' : 'bar',
            type: 'scatter',
            mode: 'lines',
            cliponaxis: false,
            line: {
              color: color,
              width: 2, // TODO
            },
          });
          if (modelOrData === 'data') {
            trace.line.shape = (xy === 'x' ? 'hvh' : 'vhv');
          }
          // TODO: add trace annotations for shape support and other?
          // see: https://plot.ly/javascript/line-charts/#labelling-lines-with-annotations
        }
        else {
          // bar chart trace
          _.extendOwn(trace, {
            //type: modelOrData === 'model' ? 'scatter' : 'bar',
            type: 'bar',
            orientation: xy === 'x' ? 'v' : 'h',
            opacity: c.map.uniDensity.bar.opacity,
            marker: {
              color: color,
            },
          });
        }
        return trace;
      }

      /**
       * Splits given data into subgroups by all splits of the vismel query (but not model vs data splits).
       * For each subgroup an appropriate trace is generated. The array of all traces is returned.
       * @param data The data to split further.
       * @param fu2idx A map of FieldUsages to column indices in the data.
       * @param xOrY 'x' ('y') if the trace is for x (y) axis.
       * @param modelOrData 'model' ('data') if the trace is for data (step-wise line chart) or model (smooth curve).
       * @return {Array} or traces.
       */
      function getSplittedUniTraces(data, fu2idx, xOrY, modelOrData) {
        // split into more traces by all remaining splits (but not model vs data splits)
        let splits = query.fieldUsages(['layout'], 'exclude')
          .filter(PQL.isSplit)
          .filter(split => (split.name !== 'model vs data' && split.field.isDiscrete()));
        let split_idxs = splits.map(split => fu2idx.get(split));

        // TODO: this is a larger piece of work. We should create a VisMEL uni trace query and then turn in to PQL ...
        // split into more traces by all remaining discrete yield fields (but not model vs data splits)
        // let splits = query.fieldUsages(['layout'], 'exclude')
        //   .filter(PQL.hasDiscreteYield)
        //   .filter(split => (split.name !== 'model vs data'));// && split.field.isDiscrete()));
        // let split_idxs = _.uniq( splits.map(split => fu2idx.get(split)) );

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
    tracer.bi = function (rt, query, mapper, axisId={x:'x', y:'y'}) {
      let traces = [];
      if (rt !== undefined) {

        // note: the indexes are by convention!
        let xfu = rt.idx2fu[0],
          yfu = rt.idx2fu[1];

        let trace = {
          name: '2d density',
          showlegend: false,
          showscale: false,
          x: selectColumn(rt, 0),
          y: selectColumn(rt, 1),
          z: selectColumn(rt, 2),
          xaxis: axisId.x,
          yaxis: axisId.y,
          opacity: c.map.biDensity.opacity,
          autocolorscale: false,
          colorscale: c.map.biDensity.colorscale,
          zmin: 0,
          zmax: rt.extent[1],
        };

        if (PQL.hasNumericYield(xfu) && PQL.hasNumericYield(yfu)) {
          trace.type = 'contour';
          traces.push(trace);
        }
        else if (PQL.hasDiscreteYield(xfu) && PQL.hasDiscreteYield(yfu)) {
          trace.type = 'heatmap';
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
    tracer.samples = function (data, query, mapper, axisId) {
      let fu2idx = data.fu2idx,
        aest = query.layers[0].aesthetics,
        xfu = query.layout.cols[0],
        yfu = query.layout.rows[0],
        traces = [],
        cfg = c.map.sampleMarker;

      if (data !== undefined) {
        let xIdx = fu2idx.get(xfu),
          yIdx = fu2idx.get(yfu);
        let trace = {
          name: 'samples',
          type: 'scatter',
          mode: 'markers',
          showlegend: false,
          x: selectColumn(data, xIdx),
          y: selectColumn(data, yIdx),
          xaxis: axisId.x,
          yaxis: axisId.y,
          opacity: cfg.fill.opacity,
        };
        trace.marker = {
          color: applyMap(data, mapper.aggrFillColor, aest.color.fu, fu2idx),
          size: applyMap(data, mapper.samplesSize, aest.size.fu, fu2idx),
          symbol: applyMap(data, mapper.samplesShape, aest.shape.fu, fu2idx),
          line: {
            color: cfg.stroke.color,
            width: cfg.stroke.width,
          },
          maxDisplayed: cfg.maxDisplayed
        };
        traces.push(trace);
      }
      return traces;
    };

    return tracer;

  });