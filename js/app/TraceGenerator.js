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

define(['lib/logger', 'lib/d3-collection', './PQL', './VisMEL', './ScaleGenerator', './ViewSettings'],
  function (Logger, d3c, PQL, VisMEL, ScaleGen, c) {
    "use strict";

    let logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);


    const numFormatter3f = d3.format(".3f");
    const numFormatter2f = d3.format(".2f");
    const numFormatter1f = d3.format(".1f");

    function makeOpaque(hexColorString, opacity) {
      let clr = d3.rgb(hexColorString);
      return "rgba(" + clr.r + "," + clr.g + "," + clr.b + "," + opacity + ")"
    }

    /**
     * Returns the color for a uniDensity trace for the case that the color channel is not explicitely used to encode any result table dimension.
     * @param vismel
     * @param config
     * @return {*}
     */
    function colorOfUniDensityTrace(vismel, xy, config) {
      // uniTraces are always using the primary color. Unless there is no biDensity-Trace and adapt_to_color_usage is set:
      // in this case the uniTrace becomes the 'full' density representation and hence uses the secondary color (just like the biDensityTrace would)
      let yx = (xy === 'x'?'y':'x');
      if (config.colors.density.adapt_to_color_usage && !vismel.used[yx])
        return config.colors.density.secondary_single;
      else
        return config.colors.density.primary_single;
    }

    /**
     * Converts an array of string values into an array of integer values, using the extent array as conversion array.
     * @param arr
     * @param extent
     */
    function toIntegerLevels(arr, extent) {
      let str2int = d3c.map();
      extent.forEach((str, idx) => str2int.set(str, idx));
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
     *
     * This is originally written for tracer.aggr
     * @param vismel A vismel query.
     * @param rt A result Table.
     */
    function splitRTIntoTraceData(rt, vismel) {
      // split into more traces by all remaining splits on discrete field
      // i.e.: possibly details, color, shape, size
      let fu = {
          x: vismel.layout.cols[0],
          y: vismel.layout.rows[0],
        },
        splits = vismel.fieldUsages(['layout'], 'exclude')
          .filter(PQL.isSplit); // TODO: should be: isOrdered()

      let num_splits = splits.filter(s => PQL.hasNumericYield(s)),
        cat_splits = splits.filter(s => PQL.hasDiscreteYield(s));
      splits = []; // reset. splits are kepts in num_spits and cat_splits.

      let isSplit = {
        x: PQL.isSplit(fu.x),
        y: PQL.isSplit(fu.y),
      };

      // if three is a split on both (rows and cols), split on both
      if (isSplit.x && isSplit.y) {
        splits.push(fu.x, fu.y);
      } else if (isSplit.x || isSplit.y) {
        let xy = isSplit.x ? 'x' : 'y';
        // we can make a line out of _one_ split (made of the points for the implicit conditions of that split).
        // If a layout split is a numerical split, we should make a line out of that layout split rather out of color, shape, size or detail splits. i.e. do not add  the numerical split to splits, but all other
        if (PQL.hasNumericYield(fu[xy])) { // should be  isOrdered())
          // splits.push(...cat_splits, ...num_splits); // done below
        }
        // however, if the layout split is a categorical split, we should rather make a line out of a color, shape, size or detail splits. i.e. add the discrete split to splits, but remove one other numerical
        else {
          splits.push(fu[xy]);
          // splits.push(...cat_splits, ...num_splits); // done below
        }
      } else {
        // we can keep one numerical split!
        num_splits = num_splits.slice(1); // and simply remove first split in list of splits
        // splits.push(...cat_splits, ...num_splits); // done below
      }
      splits.push(...cat_splits, ...num_splits);

      let split_idxs = _.uniq(splits.map(split => rt.fu2idx.get(split)));

      // build nesting function
      let nester = d3c.nest();
      for (let idx of split_idxs)
        nester.key(e => e[idx]);

      // nest it!
      return [nester.map(rt), splits.length,];
    }


    /**
     * Nests given data table by the field usage on aestetics and details of the given vismel query using the index look up map fu2idx.
     *
     * This is originally written for tracer.biQC.
     * @param data
     * @param fu2idx
     * @param vismel
     * @param nester [Optional] You may give a nester that is used and extended. Otherwise just pass nothing or undefined.
     * @return Array: 2-element array of nested data and depth of applied nester.
     */
    function nestBySplits (data, fu2idx, vismel, nester=undefined, nesterlength=0) {
      // collect splits
      let splitIdxs = vismel.fieldUsages(['aesthetics', 'details'], 'include')
        .filter(PQL.isSplit)
        .map(split => fu2idx.get(split));

      if (_.uniq(splitIdxs).length != splitIdxs.length)
        throw "AssertionError: this should not happen.";

      let l = splitIdxs.length;

      // build nester
      if (nester === undefined)
        nester = d3c.nest();
      for (let idx of splitIdxs)
        nester.key(e => e[idx]);

      // nest it
      return [nester.map(data), l + nesterlength];
    }


    let tracer = {};

    tracer.aggrHeatmap = function (rt, mapper, axisId = {x: 'x', y: 'y'}) {
      if (!axisId) throw RangeError("invalid axisId");

      if (rt === undefined)  // means 'disable this trace type'
        return [];

      let vismel = rt.vismel,
        fu2idx = rt.fu2idx,
        aest = vismel.layers[0].aesthetics,
        xfu = vismel.layout.cols[0],
        yfu = vismel.layout.rows[0],
        traces = [];

      // this may not be used if any mapping on shape or size is present in query!
      if (aest.shape instanceof VisMEL.ShapeMap) throw RangeError("Cannot use aggrHeatmap if shape is in use!");
      if (aest.size instanceof VisMEL.SizeMap) throw RangeError("Cannot use aggrHeatmap if size is in use!");
      if (!(aest.color instanceof VisMEL.ColorMap)) throw RangeError("Cannot use aggrHeatmap if color is _not_ in use!");

      // in fact no split, other than on rows and cols may be present, since we wouldn't know how to visualize the split within one heatmap tile
      if (rt) {
        if (!_.isFunction(mapper.modelAggrFillColor)) throw TypeError("Didn't expect that. Implement this case!");

        let colorFu = aest.color.fu,
          colorIdx = fu2idx.get(colorFu),
          colorTable, colorDomain, colorData;
        // plotly heatmaps require to use a colorscale. It's impossible to directly use a manual color specification

        if (PQL.hasDiscreteYield(colorFu)) {
          // create step-wise continuous color table
          colorTable = [];
          let colorMapper = mapper.modelAggrFillColor,
            len = colorFu.extent.length;
          let convertMap = d3c.map();
          colorFu.extent.forEach((v, idx) => {
            // TODO: this handles undefined values in the result table and maps them to white. make this more generic. you need to think about how to handle them in a general case
            let color = (v === undefined ?  '#FFFFFF' : colorMapper(v));  
            colorTable.push([idx / len, color], [(idx + 1) / len, color]);
            convertMap.set(v, idx)
          });

          // convert categorial data to integer values
          colorData = selectColumn(rt, colorIdx).map(v => convertMap.get(v));
          colorDomain = [0, colorFu.extent.length - 1];
        } else {
          colorTable = ScaleGen.asTable(mapper.modelAggrFillColor.scale);
          colorDomain = colorFu.extent;
          colorData = selectColumn(rt, colorIdx);
        }

        // no nesting necessary (no further splitting present)
        let trace = {
          name: PQL.toString(rt.pql),
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
          xgap: c.map.heatmap.xgap,
          ygap: c.map.heatmap.ygap,
          text: rt.formatter(rt),
          hoverinfo: "text",
        };
        traces.push(trace);
      }

      return traces;
    };


    /**
     * Build and return traces for aggregation scatter plot, grouped by splits.
     * @param rt
     * @param vismel
     * @param opts {Object} Options such as the facet for which the trace is generated, optional.
     * @return {Array}
     */
    tracer.aggr = function (rt, mapper, axisId = {x: 'x', y: 'y'}, opts={}) {
      if (!axisId) throw RangeError("invalid axisId");

      if (rt === undefined)  // means 'disable this trace type'
        return [];

      let vismel = rt.vismel,
        fu2idx = rt.fu2idx,
        aest = vismel.layers[0].aesthetics,
        xfu = vismel.layout.cols[0],
        yfu = vismel.layout.rows[0],
        traces = [],
        cfg = c.map.aggrMarker,
        traceName = PQL.toString(rt.pql);

      let colorIdx = fu2idx.get(aest.color.fu);
      let [nestedData, depth] = splitRTIntoTraceData(rt, vismel);
      let trace_mode = (opts.facetName === 'predictionDataLocal' ? "" : "lines+") + "markers";

      // create and attach trace for each group, i.e. each leaf in the nested data
      let attach_aggr_trace = (data) => {

        let color_mapper = (opts.facetName === 'data aggregations' ? mapper.dataAggrFillColor : mapper.modelAggrFillColor);
        let trace = {
          name: traceName,
          type: 'scatter',
          mode: trace_mode,
          showlegend: false,
          cliponaxis: false,
          x: selectColumn(data, fu2idx.get(xfu)),
          y: selectColumn(data, fu2idx.get(yfu)),
          xaxis: axisId.x,
          yaxis: axisId.y,
          opacity: cfg.fill.opacity,
          marker: {
            color: applyMap(data, color_mapper , aest.color.fu, fu2idx),
            size: applyMap(data, mapper.aggrSize, aest.size.fu, fu2idx),
            symbol: applyMap(data, mapper.aggrShape, aest.shape.fu, fu2idx),
            line: { // configures the line bounding the marker points
              color: cfg.stroke["color prediction"],
              width: cfg.stroke.width
            },
            showscale: false,
            sizemode: 'diameter', // 'area' or 'diameter'
          },
          hoverinfo: "text",
          text: rt.formatter(data),
          line: {},
        };

        // TODO: workaround for bug: allow to hide aggregations, because we need the colors be computed to have correct colors in marginals
        if (c.tweaks.hideAggregations)
          trace.opacity = 0;

        let lcmap = mapper.lineColor;
        trace.line.color = _.isFunction(lcmap) ? lcmap(data[0][colorIdx]) : lcmap;
        // TODO: problem: I cannot (easily) draw lines with changing color.
        //trace.line.color = applyMap(data, mapper.lineColor, aest.color.fu, fu2idx);

        // TODO: changing line width is possible: https://plot.ly/javascript/filled-area-animation/#multiple-trace-filled-area
        // trace.line.width = applyMap(data, mapper.size, aest.size.fu, fu2idx);

        traces.push(trace);
      };

      dfs(nestedData, attach_aggr_trace, depth);

      return traces;
    };

    /**
     * marginal histogram / density traces
     * -> up to two traces per axis, one for a histogram of the data and one for a density line chart of the model
     * @param p1dRT
     * @return {Array}
     */
    tracer.uni = function (p1dRT, mapper, mainAxisId, marginalAxisId, opts={}) {
      if (!mainAxisId) throw RangeError("invalid mainAxisId");
      if (!marginalAxisId) throw RangeError("invalid marginalAxisId");

      if (p1dRT === undefined)  // means 'disable this trace type'
        return [];

      if (!opts.hasOwnProperty('facetName'))
        opts.facetName = 'uniDensity';

      if ( !['uniDensity', 'dataMarginals'].includes(opts.facetName))
        throw new RangeError(`invalid facet name: ${opts.facetName}`);

     let vismel = undefined,
       traceName = {"x": "setMe", "y": "setMe"};

      /**
       * Returns a trace for marginal histogram/density of x or y axis.
       * @param data Data for trace.
       * @param xy 'x' ('y') if the trace is for x (y) axis.
       * @param fu2idx
       * @return Object: A trace.
       */
      function getUniTrace(data, xy, fu2idx) {

        let xIdx = fu2idx.get(vismel.layout.cols[0]),
          yIdx = fu2idx.get(vismel.layout.rows[0]);

        // is axis field usage numeric or categorical, i.e. histogram or barchar?
        let axisFu = vismel.layout[xy === 'x' ? 'cols' : 'rows'][0];

        let xAxis = (xy === 'x' ? mainAxisId.x : marginalAxisId.x),
          yAxis = (xy === 'x' ? marginalAxisId.y : mainAxisId.y);

        let trace = {
          name: traceName[xy],
          showlegend: false,
          x: selectColumn(data, xIdx),
          y: selectColumn(data, yIdx),
          xaxis: xAxis,
          yaxis: yAxis,
          hoverinfo: "text",
          hovertext: p1dRT[xy].formatter(data),
        };

        let color = opts.facetName === 'dataMarginals' ? mapper.dataMarginalColor : mapper.modelMarginalColor;
        // if (color === undefined) {  // this indicates that color is unused (see MapperGenerator)
        //   color = colorOfUniDensityTrace(vismel, xy, c, opts);
        // }
        if (_.isFunction(color)) {
          // apply the color mapping that color represents
          let colorIdx = fu2idx.get(vismel.layers[0].aesthetics.color.fu);
          color = color(data[0][colorIdx]);
        } 
        //else color = color;

        if (PQL.hasNumericYield(axisFu)) {

          // line chart trace
          _.extendOwn(trace, {
            //type: PQL.hasNumericYield(axisFu) ? 'scatter' : 'bar',
            type: 'scatter',
            mode: 'lines',
            cliponaxis: false,
            line: {
              color: color,
              width: c.map.uniDensity.line.width,
              opacity: c.map.uniDensity.line.opacity,
              shape: c.map[opts.facetName].line['shape' + (opts.facetName === 'dataMarginals' ? xy : '')],
              smoothing: 0.75,
            },
            fill: c.map.uniDensity.line.fill ? ('tozero' + (xy === 'x' ? 'y' : 'x')) : 'none',
            fillcolor: makeOpaque(color, c.map.uniDensity.line.fillopacity)
          });
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
            text: (xy === 'x' ? trace.y : trace.x).map(numFormatter2f),
            textposition: 'inside',
            insidetextfont: {
              color: 'white',
            },
            marker: {
              color: color,
            },
          });
        }
        return trace;
      }

      /**
       * Splits given data into subgroups by all splits of the vismel query.
       * For each subgroup an appropriate trace is generated. The array of all traces is returned.
       * @param data The data to split further.
       * @param fu2idx A map of FieldUsages to column indices in the data.
       * @param xy 'x' ('y') if the trace is for x (y) axis.
       * @return {Array} or traces.
       */
      function getSplittedUniTraces(data, fu2idx, xy) {
        // split into more traces by all remaining splits
        let splits = vismel.fieldUsages(['layout'], 'exclude').filter(PQL.isSplit);
        let split_idxs = _.uniq( splits.map(split => fu2idx.get(split)) );

        // build nesting function
        let nester = d3c.nest();
        for (let idx of split_idxs)
          nester.key(e => e[idx]);

        // nest it!
        let nestedData = nester.map(data);

        let traces = [];
        dfs(nestedData, leafData => traces.push(getUniTrace(leafData, xy, fu2idx)), split_idxs.length);
        return traces;
      }

      /**
       * Aggregates the density values in data and thus calculates the true marginal density along the xOrY axis.
       *
       * @param datam
       */
      function getAccumulatedUniTrace(data, fu2idx, xy) {
        // TODO: merge this with getUniTrace again?
        if (data.length === 0)
          return [];

        // accumulate density values
        // TODO: this is buggy: we need to determine the index of the x and p(x) from the semantics of the field usage!
        // However, what we really should do is implemment this cleanly in a different way, namely querying for the accumulated density!
        let xIdx = fu2idx.get(vismel.layout.cols[0]),
          yIdx = fu2idx.get(vismel.layout.rows[0]);

        let x = [], // the value of which the density is computed
          px = [], // the density
          currentX = data[0][xIdx], // [1] is by convention the column of which the density is computed
          sumPX = 0;
        for (let item of data) {
          if (item[1] === currentX) {
            sumPX += item[yIdx];
          } else {
            // push sum for that x
            x.push(currentX);
            px.push(sumPX);
            // start sum of new x
            currentX = item[xIdx];
            sumPX = item[yIdx];
          }
        }
        x.push(currentX);
        px.push(sumPX);

        // hack for fast exit: if the accumulation actually does not accumulate, then don't draw another trace for it
        if (x.length === data.length)
          return [];

        // TODO: merge this with getUniTrace again?
        // return getUniTrace(xOrY, modelOrData, );

        // is axis field usage numeric or categorical, i.e. histogram or barchar?
        let axisFu = vismel.layout[xy === 'x' ? 'cols' : 'rows'][0];

        let xAxis = (xy === 'x' ? mainAxisId.x : marginalAxisId.x),
          yAxis = (xy === 'x' ? marginalAxisId.y : mainAxisId.y);

        let trace = {
          name: traceName[xy], // modelOrData + ' marginal on ' + xy,
          showlegend: false,
          x: xy === 'x' ? x : px,
          y: xy === 'x' ? px : x,
          xaxis: xAxis,
          yaxis: yAxis,
        };

        // this should always be the primary color, because this way we can distinghuish from the secondary color
        let color = c.colors.density.primary_single;

        if (PQL.hasNumericYield(axisFu)) {
          // line chart trace
          _.extendOwn(trace, {
            //type: PQL.hasNumericYield(axisFu) ? 'scatter' : 'bar',
            type: 'scatter',
            mode: 'lines',
            cliponaxis: false,
            line: {
              color: color,
              width: c.map.uniDensity.line.width,
            },
            fill: 'none', // never fill (easier to distinguish, maybe) TODO
            //fill: c.map.uniDensity.line.fill ? ('tozero' + (xy === 'x' ? 'y' : 'x')) : 'none',
            fillcolor: makeOpaque(color, c.map.uniDensity.line.fillopacity)
          });
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
        return [trace];
      }

      // code (not function defs) for tracer.uni starts here
      let traces = [];

      //let nestByMvd = d3c.nest().key(v => v[0]); // nest by value of first column, which is by convention the 'model vs data' column.
      for (let xOrY of ['x', 'y']) { // adds seperate traces for x and y uni-marginals
        let rt = p1dRT[xOrY];
        if (rt !== undefined) {
          vismel = rt.vismel;
          vismel.used = vismel.usages();

          //let rt = nestByMvd.map(rt); // FAIL HERE
          traceName[xOrY] = PQL.toString(rt.pql);
          // remove data trace.
          //for (let modelOrData of ['model', 'data']) { // adds separate traces for model and data
          //let data = rt.get(modelOrData);
          //if (data !== undefined) {
            //if (!c.tweaks.hideAccuMarginals)
            // if (c.views.accuMarginals.possible)
            // TODO: reenable: traces.push(...getAccumulatedUniTrace(rt, rt.fu2idx, xOrY));
            //data.query = rt.query; // attach query to data, beacuse we might need it later

          traces.push(...getSplittedUniTraces(rt, rt.fu2idx, xOrY));

          //}
          //}
        }
      }
      return traces;
    };

    /** 2d density plot trace builder.
     *
     * The created trace depends on the data type of the fields on rows and cols:
     *   * both numerical: lightness contour map
     *   * both discrete: lightness heatmap
     *   * mixed: no trace
     *
     * @param rt
     * @param mapper
     * @param axisId
     * @param opts
     * @return {Array}
     */
    tracer.bi = function (rt, mapper, axisId, opts=undefined) {

      if (!opts)
        opts = {};
      if (!axisId)
        throw RangeError("invalid axisId");
      if (!opts.facetName)
        opts.facetName = 'model density';
      if (!['model density', 'data density'].includes(opts.facetName))
        throw RangeError(`invalid facetName: ${opts.facetName}`);

      if (rt === undefined)  // means 'disable this trace type'
        return [];

      let vismel = rt.vismel;

      if (!vismel.used)
        vismel.used = vismel.usages();

      let xFu = vismel.layout.cols[0],
        yFu = vismel.layout.rows[0],
        colorFu = vismel.layers[0].aesthetics.color.fu;

      let xIdx = rt.fu2idx.get(xFu),
        yIdx = rt.fu2idx.get(yFu),
        colorIdx = rt.fu2idx.get(colorFu);

      let zdata = selectColumn(rt, colorIdx), //.map(Math.sqrt),
        ztext = zdata.map(c.map.biDensity.labelFormatter);
      
      let traces = [];

      // TODO: this is a bigger issue: sometimes we may not want to draw / or actually even query a particular trace from the server
      // e.g. because it makes not sense: density of independent variables.
      // WORKAROUND: detect "all undefined" query results      
      // abort
      if (zdata.every(e => e === undefined))
        return traces;

      // TODO: should we apply some heuristic to reduce the impact of few, very large density value
      // TODO: this cannot work consistently, because it sets the scale on a per trace basis...
      // let sortedZData = _.sortBy(zdata),
      //   l = sortedZData.length;
      // // ignore all values smaller max*0.01
      // let lowerIdx = _.sortedIndex(sortedZData, _.last(sortedZData)*0.001);
      // // of the remaining values get the .98 quantile and choose this as the upper value of the scale
      // let zmax = sortedZData[lowerIdx + Math.floor((l - lowerIdx)*0.98)];

      // let cd = c.colors.modelSamples.density_scale;
      // colorscale = (cd.adapt_to_color_usage && !vismel.used.color) ? cd.secondary_scale : cd.primary_scale;

      let colorscale = (opts.facetName === 'data density' ?
          c.colors['training data'].density_scale : c.colors.modelSamples.density_scale);

      // merge color split data into one
      let commonTrace = {
          name: PQL.toString(rt.pql),
          // name: '2d density',
          showlegend: false,
          showscale: false,
          x: selectColumn(rt, xIdx),
          y: selectColumn(rt, yIdx),
          xaxis: axisId.x,
          yaxis: axisId.y,
          hoverinfo: 'text',
          text: ztext,
        },

        commonHeatmapContour = {
          autocolorscale: false,
          colorscale: colorscale,
          z: zdata,
          zauto: false,
          zmin: 0,
          // zmax: zmax,
          zmax: colorFu.extent[1],
        };

      if (PQL.hasNumericYield(xFu) && PQL.hasNumericYield(yFu)) {
        traces.push(
          Object.assign(
            // contour plot trace
            {
              type: 'contour',
              autocontour: false,
              ncontours: c.map.biDensity.contour.levels,
              //opacity: c.map.biDensity.contour.opacity,
              contours: {
                coloring: c.map.biDensity.contour.coloring,   // valid values: "fill" | "heatmap" | "lines"
              },
              line: {
                width: c.map.biDensity.contour.width,
                color: c.map.biDensity.line.color, // the color of the contour lines (if contours.coloring is not line)
              }
            },
            commonTrace,
            commonHeatmapContour
          ));
      }
      else if (PQL.hasDiscreteYield(xFu) && PQL.hasDiscreteYield(yFu)) {

        // additional heatmap background trace
        if (c.map.biDensity.backgroundHeatMap) {
          traces.push(
            Object.assign(
              {
                type: 'heatmap',
                xgap: c.map.heatmap.xgap,
                ygap: c.map.heatmap.ygap,
                opacity: 0.7,
              },
              commonTrace,
              commonHeatmapContour
            ));
        }

        // compute maximum shape diameter
        let cellSize = opts.geometry.cellSizePx,
          maxShapeDiameter = Math.min(cellSize.x / xFu.extent.length, cellSize.y / yFu.extent.length)*0.45;

        let scatterTrace = {
          type: 'scatter',
          visible: true,
          // mode: 'markers+text',
          mode: 'markers',
          opacity: 1,
          marker: {
            //symbol: "circle",
            symbol: c.shapes.model,
            sizemin: 0,
            sizemode: 'area',
            size: zdata,
            color: zdata,
            colorscale: colorscale,
            cmin: 0,
            cmax: colorFu.extent[1],
            cauto: false,
            line: {
              color: c.map.sampleMarker.stroke.color, // todo: zdata.map(d => d * 1.1), // slightly darker
              width: c.map.sampleMarker.stroke.width,
            },
          },
        };
        scatterTrace.marker.sizeref = Math.pow(
          colorFu.extent[1] / maxShapeDiameter / 0.5,
          (scatterTrace.marker.sizemode === 'area' ? 2 : 1));

        traces.push(
          Object.assign(scatterTrace, commonTrace)
        );
      }

      return traces;
    };

    /**
     * 2d density plot trace builder for the case when one positional axis is quantitative and one is categorical.
     *
     * Creates a density line plot for each categorical value of the categorical dimension.
     *
     * @param rt
     * @param mapper
     * @param axisId
     * @param cqAxisIds
     * @return {{}}
     */
    tracer.biQC = function (rt, mapper, axisId, cqAxisIds) {

      if (rt === undefined)  // means 'disable this trace type'
        return [];

      let vismel = rt.vismel;

      if (!axisId) throw RangeError("invalid axisId");
      if (!cqAxisIds || cqAxisIds.length === 0) throw RangeError("invalid axisId");

      let xFu = vismel.layout.cols[0],
        yFu = vismel.layout.rows[0];

      let xYieldsCat = PQL.hasDiscreteYield(xFu), // flag: True iff x encodes a categorical dimension
        catXy = xYieldsCat ? 'x' : 'y'; // where the categorical dimension is: on 'x' or 'y' ?

      let xIdx = rt.fu2idx.get(xFu),
        yIdx = rt.fu2idx.get(yFu),
        pIdx = rt.fu2idx.get(vismel.layout[xYieldsCat ? 'cols' : 'rows'][1]); // density is encoded here

      let [catIdx, numIdx] = (xYieldsCat ? [xIdx, yIdx] : [yIdx, xIdx]); // index of the categorical and numerical dimension in the result table

      // nest by values of categorical dimension, and then all remaining splits
      let nesterCatAxis = d3c.nest().key(e => e[catIdx]);
      let [groupedData2, depth] = nestBySplits(rt, rt.fu2idx, vismel, nesterCatAxis, 1);

      let colorFu = vismel.layers[0].aesthetics.color.fu,
        colorIdx = rt.fu2idx.get(colorFu);

      /**
       * generator for traces of line plots
       * @param data a data table
       * @param i index along the categorical axis' extent
       */
      function uniTrace4biQC(data, i) {

        let color = mapper.modelMarginalColor;
        // if (color === undefined) {  // this indicates that color is unused (see MapperGenerator)
        //   // determine uniform fallback color
        //   color = c.colors.density.adapt_to_color_usage ?  c.colors.density.secondary_single :  c.colors.density.primary_single;

        if (_.isFunction(color))
          color = color(data[0][colorIdx]);

        // } else {
        //   apply the color mapping that color represents. colorIdx is precomputed in the outer scope.
          // color = color(data[0][colorIdx]);  // data[0] because we simply need any data point of the trace, so the first one is good enough
        // }

        let trace = {
          name: PQL.toString(rt.pql),
          type: 'scatter',
          mode: 'lines',
          showlegend: false,
          [catXy]: selectColumn(data, pIdx), // the axis that encodes the categorical dimension, encodes the density on the new axis.
          [catXy === 'x' ? 'y' : 'x']: selectColumn(data, numIdx), // the axis that encodes the quantitative dimension, encodes the quantitative dimension ...
          xaxis: xYieldsCat ? cqAxisIds[i] : axisId.x,
          yaxis: xYieldsCat ? axisId.y : cqAxisIds[i],
          line: {
            width: c.map.biDensity.line.width,
            shape: c.map.biDensity.line.shape,
            color: color,
          },
          fill: c.map.biDensity.line.fill ? ('tozero' + catXy) : 'none',
          //fill: 'none',
          fillcolor: makeOpaque(color, c.map.biDensity.line.fillopacity),
        };
        return trace;
      }

      // iterate over groups in same order like given in extent
      let catExtent = rt.extent[catIdx];
      if (catExtent.length !== cqAxisIds.length)
        throw RangeError("this should not happen. See trace.biQC.");
      let traces = [];
      for (let i = 0; i < cqAxisIds.length; ++i) {
        let data = groupedData2["$" + catExtent[i]];
        // TODO: this is a hack. If a filter is applied on the categorical dimension, the above access to groupedData fails because the fields extent wasn't updated
        if (data !== undefined)
          // create trace for each leave in the map for the grouped data:
          dfs(data, leafData => traces.push(uniTrace4biQC(leafData, i)), depth-1);  // -1 because we already iterate over the first level
      }
      return traces;
    };

    /**
     * samples trace builder.
     * @param rt
     * @param vismel
     * @param mapper: A dictionary of mapper for the keys (and visual channels): fillColor, size, shape
     * @return {Array}
     */
    tracer.samples = function (rt, mapper, mode, axisId) {
      if (!axisId) throw RangeError("invalid axisId");

      if (rt === undefined)  // means 'disable this trace type'
        return [];

      let vismel = rt.vismel,
        fu2idx = rt.fu2idx,
        aest = vismel.layers[0].aesthetics,
        xfu = vismel.layout.cols[0],
        yfu = vismel.layout.rows[0],
        cfg;

      if (mode === 'training data') {
        cfg = c.map.sampleMarker;
        mapper = {
          fillColor: mapper.dataFillColor,
          shape: mapper.dataShape,
          size: mapper.samplesSize,
        };
      } else if (mode === 'test data') {
        cfg = c.map.testDataMarker;
        mapper = {
          fillColor: mapper.testDataFillColor,
          shape: mapper.testDataShape,
          size: mapper.samplesSize
        };
      } else if (mode === 'model samples') {
        cfg = c.map.modelSampleMarker;
        mapper = {
          fillColor: mapper.modelSampleFillColor,
          shape: mapper.modelSampleShape,
          size: mapper.modelSampleSize
        };
      } else {
        throw RangeError("invalid mode: " + mode.toString());
      }

      let xIdx = fu2idx.get(xfu),
        yIdx = fu2idx.get(yfu);
      let trace = {
        name: mode,
        type: 'scatter',
        mode: 'markers',
        showlegend: false,
        x: selectColumn(rt, xIdx),
        y: selectColumn(rt, yIdx),
        xaxis: axisId.x,
        yaxis: axisId.y,
        // opacity: cfg.fill.opacity,
        hoverinfo: "text",
        text: rt.formatter(rt),
      };
      trace.marker = {
        color: applyMap(rt, mapper.fillColor, aest.color.fu, fu2idx),
        opacity: cfg.fill.opacity,
        size: applyMap(rt, mapper.size, aest.size.fu, fu2idx),
        sizemode: 'diameter', // 'area' or 'diameter'
        symbol: applyMap(rt, mapper.shape, aest.shape.fu, fu2idx),
        line: {
          color: cfg.stroke.color,
          width: cfg.stroke.width,
        },
        maxDisplayed: cfg.maxDisplayed
      };
      return [trace];
    };

    /**
     * Builds and returns a trace for line segments that connect the points given in testDataRT and predRT.
     * It highlights their difference.
     * @param predRT
     * @param testDataRT
     * @param vismel
     * @param mapper
     * @param axisId
     * @return {*}
     */
    tracer.predictionOffset = function (predRT, testDataRT, mapper, axisId, facets) {

      // TODO / ATTENTION: THIS FACET IS NOT FUNCTIONAL!
      return [];
      
      if (!facets.predictionOffset.active || testDataRT === undefined || predRT === undefined)
        return [];

      // let aest = query.layers[0].aesthetics;
      let vismel = predRT.vismel,
        fus = {
            x: vismel.layout.cols[0],
            y: vismel.layout.rows[0]
        };

      let pIdx = {},
        tIdx = {},
        data = {},
        len = testDataRT.length,
        undefArray = Array(len).fill(undefined);
      for (let xy of ['x', 'y']) {
        pIdx[xy] = predRT.fu2idx.get(fus[xy]);
        tIdx[xy] = testDataRT.fu2idx.get(fus[xy]);
      }

      // sort both by same index (xIdx would have been likewise ok). It's not inplace.
      // TODO: not its not that easy, I need to sort by the correct positional index!
      for (let xy of ['x', 'y'])
        if (PQL.isSplit(fus[xy])) {
          predRT = _.sortBy(predRT, e => e[pIdx[xy]]);
          testDataRT = _.sortBy(testDataRT, e => e[tIdx[xy]]);
        }
      for (let xy of ['x', 'y'])
        data[xy] = _.flatten(_.zip(selectColumn(testDataRT, tIdx[xy]), selectColumn(predRT, pIdx[xy]), undefArray))

      let cfg = c.map.predictionOffset.line;
      let trace = {
        name: 'offset',
        type: 'scatter',
        mode: 'lines',
        showlegend: false,
        x: data.x,
        y: data.y,
        xaxis: axisId.x,
        yaxis: axisId.y,
        opacity: 1.0,
        connectgaps: false,
        line: {
          color: cfg.color,
          width: cfg.width,
          opacity: cfg.opacity,
          fill: cfg.fill,
        }
      };

      return [trace];
    };

    return tracer;

  });