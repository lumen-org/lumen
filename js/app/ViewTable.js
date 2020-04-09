/**
 /**
 * Nomenclature
 *   .*D3 : a variable that is a D3 selection
 *   .*DOM : a variable that is a DOM element
 *
 *   pane : the entire space take by a visualization
 *   canvas : the actual drawing area of a pane, i.e. without margin and boarder
 *
 * Axis coupling / anchoring:
 *   Certain axes should zoom together, such that the visualization stays comparable at all times. Here, we apply the following schema:
 *     * marginal axes have fixed ranges: there is no need to zoom into them. In contrary, doing so accidentally distracts the user.
 *     * all main axis that encode the same dimension (i.e. the corresponding FieldUsage has the same yield) are anchored.
 *
 *   Note: this is just about spatial axis anchoring.
 *
 * Axis drawing:
 *
 *   Axes serve several purposes:
 *     * read off a value
 *     * bounding box of a atomic vis
 *     * hierarchy indication (templating axes)
 *     *
 *
 * Extents:
 *
 *   For visualization the extents over _all_ result tables are required, as we need uniform
 *   extents over all atomic panes for a visually uniform visualization. More specifically, we want the global
 *   extent with respect to a particular 'yield'. Here 'yield' means the dimension that a FieldUsage (or BaseMap)
 *   yields when a query is processed.
 *
 *   We attach extents to the FieldUsages of the queries under the attribute .extent.
 *
 *   As FieldUsages of atomic queries are
 *   inherited from templated query, extents are also available at the atomic query.
 *
 *   Note that extents may take different forms:
 *    - single value (discrete FU)
 *    - interval (continuous FU), or
 *    - set of single values (discrete FU, where the splitting functions splits not into single values but sets of values).
 *
 *   For discrete {@link FieldUsage}s the extent is the set of unique values / tuple of values that occurred in the results for this particular {@link FieldUsage}. Tuple are not reduced to their individual values.
 *
 *   For continuous {@link FieldUsage}s the extent is the minimum and maximum value that occurred in the results of this particular {@link FieldUsage}, wrapped as an 2-element array. Intervals are reduced to their bounding values.
 *
 *   Note: you cannot use the .extent or .domain of any FIELD (not field usage) of any field usage that the vismel queries consists of. The reason is two fold:
 *     (1) they have a different semantic, namely .extent stores a 'meaningful' range of values where the density function is considerably larger than 0, and .domain stores the allowed domain of the dimension of that model.
 *     (2) these values are not updated as a result of query answering. That is because the queries all refer to Fields of some model instance. And that model instance is never actually changed. Instead new models are created on both the remote and local side.
 *
 * @module ViewTable
 * @author Philipp Lucas
 * @copyright © 2017-2019 Philipp Lucas (philipp.lucas@uni-jena.de, philipp.lucas@dlr.de)
 */

define(['lib/logger', 'lib/emitter', 'd3', 'd3legend', './ResultTable', './plotly-shapes', './PQL', './VisMEL', './ScaleGenerator', './MapperGenerator', './ViewSettings', './TraceGenerator', './VisualizationLegend', './AxesSynchronization', './utils', 'lib/deepmerge'],
  function (Logger, Emitter, d3, d3legend, RT, plotlyShapes, PQL, VisMEL, ScaleGen, MapperGen, config, TraceGen, VisLegend, AxesSync, utils, merge) {
    "use strict";

    var logger = Logger.get('pl-ViewTable');
    logger.setLevel(Logger.DEBUG);

    function _invXY(xy) {
      return (xy === 'x' ? 'y' : 'x');
    }

    /**
     * Normalize the density values of given results tables such that they are on a common scale. Works in place.
     * @param pRT: ResultTable
     *   Density result table
     * @param dataRT:ResultTable
     *   Data result table
     * @private
     */
    function _normalizeDensityOfRT(pRT, dataRT) {
      if (pRT != undefined) {
        // normalize pRT to 1 if no data marginals are given
        let targetWeight = 1,
            pIdx = pRT.idx2fu.findIndex(fu => PQL.isDensity(fu));
        if (dataRT != undefined) {
          // normalize pRT such that it sums to the sum of data1dRT
          targetWeight = d3.sum(dataRT, row => row[pIdx]);
        }
        if (!PQL.isDensity(pRT.idx2fu[pIdx]))
          throw RangeError("index of marginal density in result table do not match for data and model.")
        // normalize to target
        RT.normalizeRT(pRT, pIdx, targetWeight);
      }
    }

    /**
     * Like _normalizeDensityOfRT but does it for the marignal and non-marignal density result tables.
     * @private
     */
    function _normalizeDensities(p1dRT, data1dRT, p2dRT, data2dRT) {
      // marginals
      if (p1dRT === undefined)
        p1dRT = {};
      if (data1dRT === undefined)
        data1dRT = {};
      for (const xy of ['x', 'y']) {
        _normalizeDensityOfRT(p1dRT[xy], data1dRT[xy]);
      }
      // 2d densities
      _normalizeDensityOfRT(p2dRT, data2dRT);
    }

    /**
     * Normalize the density values of given facets such that they are on a common scale. Works in place.
     * @param pFacet
     * @param dataFacet
     * @param xy string. optional. defaults to undefined.
     *   If provided the string is used to access actual result tables within the collection.
     */
    function _normalizeDensityOfFacets(pFacet, dataFacet, xy=undefined) {
      if (!pFacet.active)
        return;
      let pColl = pFacet.data,
          dataColl = dataFacet.data;
      let pSize = pColl.size,
          dataSize = dataColl.size;
      if (pSize.rows != dataSize.rows || pSize.cols != dataSize.cols)
        throw RangeError("size of data and model result table do not match.");
      if (pColl[0][0] === undefined || pColl[0][0][xy] === undefined)
        return;

      // index of density column. identical across all
      let pIdx = (xy === undefined ? pColl[0][0] : pColl[0][0][xy])
          .idx2fu.findIndex(fu => PQL.isDensity(fu));

      /// get target weight. Its 1 if no data coll is given. else its the weight of the data coll.
      let targetWeight = 1;
      if (dataFacet.active) {
        targetWeight = 0;
        for (let rIdx = 0; rIdx < pSize.rows; ++rIdx)
          for (let cIdx = 0; cIdx < pSize.cols; ++cIdx) {
            let rt = dataColl[rIdx][cIdx];
            rt = (xy === undefined ? rt : rt[xy]);
            targetWeight += d3.sum(rt, row => row[pIdx]);
          }
      }

      /// get current weight
      let currentWeight = 0;
      for (let rIdx = 0; rIdx < pSize.rows; ++rIdx)
        for (let cIdx = 0; cIdx < pSize.cols; ++cIdx) {
          let rt = pColl[rIdx][cIdx];
          rt = (xy === undefined ? rt : rt[xy]);
          currentWeight += d3.sum(rt, row => row[pIdx]);
        }

      /// apply normalization to density collection
      let normalizationFactor = targetWeight/currentWeight;
      for (let rIdx = 0; rIdx < pSize.rows; ++rIdx)
        for (let cIdx = 0; cIdx < pSize.cols; ++cIdx) {
          let rt = pColl[rIdx][cIdx];
          rt = (xy === undefined ? rt : rt[xy]);
          RT.normalizeRT(rt, pIdx, undefined, normalizationFactor);
          //if (dataColl) console.log(d3.sum(dataColl, row => row[pIdx]));
          //if (pColl) console.log(d3.sum(pColl, row => row[pIdx]));
        }
    }

    /**
     * Like _normalizeDensityOfFacets but does it for all of the four marignal and non-marignal density collections.
     * @private
     */
    function _normalizeDensitiesGlobally(p1dColl, data1dColl, p2dColl, data2dColl) {
      // marginals
      for (const xy of ['x', 'y'] ) {
        _normalizeDensityOfFacets(p1dColl, data1dColl, xy);
      }
      // 2d densities
      _normalizeDensityOfFacets(p2dColl, data2dColl);
    }

    /**
     * Builds and returns a formatter for this result table.
     * You can format any likewise structured data by passing it as the single argument to the returned formatter.
     *
     * @param rt
     * @return
     */
    function resultTableFormatter(rt) {

      let rtNames = rt.idx2fu.map(fu => fu.yields);

      let formatter = rt.idx2fu.map(fu => {
        if (PQL.hasDiscreteYield(fu)) {
          return o => o === undefined ? '-none-' : o.toString();  // no need for any special formatting
        } else if (PQL.hasNumericYield(fu)) {
          return d3.format(".3f");
        } else {
          throw RangeError("invalid yield type");
        }
      });

      return (data) =>
        data.map(item =>
          d3.range(item.length).map(
            i => rtNames[i] + ": " + formatter[i](item[i])
          ).join('<br>')
        );
    }


    /**
     * Given a split returns a nicely formatted string representation of the splits extent, i.e. a string for each element of the extent array.
     *
     * TODO: actually, this is more general: we need a formatter for each data type, and there is essentially these types: string, number, array of string, interval of numbers, and in the future: data, ...
     */
    function splitExtentToString(split) {

      if (split.extent === undefined)
        throw RangeError("you must set the extent of a split before calling this function.");

      // setup formatter
      let numFormatter = d3.format(".1f"),
        formatter = undefined;
      if (PQL.hasDiscreteYield(split))
        formatter = v => v.toString();
      else if (PQL.hasNumericYield(split))
        if (split.method === PQL.SplitMethod.equiinterval)
          formatter = (v) => "[" + v.map(numFormatter).join(", ") + "]";
        else
          formatter = numFormatter;

      // apply
      return split.extent.map(formatter);
    }

    /**
     * Utility function. Generates an object with attribtues .range, .tickmode and .tickvals, essentially being a
     * template for an plotly axis.
     * This generated only two tick lines, one at 0% and one at linePrct of the axis.
     * However, it only labels one, the higher tick.
     * @param extent
     * @param xy
     * @param cfg
     * @returns {{}}
     */
    function getRangeAndTickMarks(extent, xy, cfg = {linePrct: 0.61, maxPrct: 1.2}) {
      let axis = {};
      axis.range = [0, extent[1] * cfg.maxPrct];
      if (config.plots.marginal.position[_invXY(xy)] === 'bottomleft') // reverse range if necessary reversed range
        axis.range = axis.range.reverse();
      axis.tickmode = "array"; // use exactly 2 ticks as I want:
      axis.tickvals = ["", (extent[1] * cfg.linePrct).toPrecision(1)]; // draw a line at 0 and ~maxPrct%
      return axis
    }


    function atomicPlotlyTraces(geometry, aggrRT, dataAggrRT, dataLocalPredRT, dataRT, testDataRT, samplesRT, p1dRT,
                                data1dRT, p2dRT, data2dRT, vismel, mainAxis, marginalAxis, catQuantAxisIds, facets) {
      // attach formatter, i.e. something that pretty prints the contents of a result table
      for (let rt of [aggrRT, dataAggrRT, dataLocalPredRT, dataRT, testDataRT, samplesRT, p2dRT, data2dRT]
          .concat(p1dRT === undefined ? [] : [p1dRT.x, p1dRT.y])
          .concat(data1dRT === undefined ? [] : [data1dRT.x, data1dRT.y]))
        if (rt !== undefined)
          rt.formatter = resultTableFormatter(rt);

      let traces = [],
        aest = vismel.layers[0].aesthetics,
        xfu = vismel.layout.cols[0],
        yfu = vismel.layout.rows[0];

      // attach to query object, so we can reuse it internally
      let used = vismel.usages();
      vismel.used = used;

      // build all mappers
      let mapper = {};
      if (aggrRT !== undefined || dataAggrRT !== undefined || dataLocalPredRT !== undefined) {
        let aggrVismel = [aggrRT, dataAggrRT, dataLocalPredRT].find(e => e !== undefined).vismel;        
        mapper.aggrSize = MapperGen.markersSize(aggrVismel, config.map.aggrMarker.size);
        mapper.aggrShape = MapperGen.markersShape(aggrVismel, 'model samples');
        mapper.lineColor = MapperGen.lineColor(aggrVismel);

        if (aggrRT !== undefined)
          mapper.modelAggrFillColor = MapperGen.markersFillColor(aggrRT.vismel, 'aggr');
        else if (dataLocalPredRT !== undefined)
          mapper.modelAggrFillColor = MapperGen.markersFillColor(dataLocalPredRT.vismel, 'aggr');
        if (dataAggrRT !== undefined)
          // TODO: this should depend on whether we query the training or test data empirical model
          mapper.dataAggrFillColor = MapperGen.markersFillColor(dataAggrRT.vismel, 'training data');
      }

      if (dataRT !== undefined || testDataRT !== undefined || samplesRT !== undefined) {
        let dataVismel;
        if (dataRT !== undefined)
          dataVismel =  dataRT.vismel;
        else if (testDataRT !== undefined)
          dataVismel =  testDataRT.vismel;
        else
          dataVismel =  samplesRT.vismel;

        mapper.samplesSize = MapperGen.markersSize(dataVismel, config.map.sampleMarker.size);

        if (dataRT !== undefined || samplesRT !== undefined) {
          mapper.dataFillColor = MapperGen.markersFillColor(dataVismel, 'training data');
          mapper.dataShape = MapperGen.markersShape(dataVismel, 'training data');
          mapper.dataSize = MapperGen.markersSize(dataVismel, config.map.sampleMarker.size);
        }
        if (testDataRT !== undefined) {
          mapper.testDataFillColor = MapperGen.markersFillColor(dataVismel, 'test data');
          mapper.testDataShape = MapperGen.markersShape(dataVismel, 'test data');
          mapper.testDataSize = MapperGen.markersSize(dataVismel, config.map.testDataMarker.size);
        }
        if (samplesRT !== undefined) {
          mapper.modelSampleFillColor = MapperGen.markersFillColor(dataVismel, 'model samples');
          mapper.modelSampleShape = MapperGen.markersShape(dataVismel, 'model samples');
          mapper.modelSampleSize = MapperGen.markersSize(dataVismel, config.map.modelSampleMarker.size);
        }
      }

      if (p1dRT !== undefined) {
          let pvismel = ('x' in p1dRT ? p1dRT.x : p1dRT.y).vismel;
          mapper.modelMarginalColor = MapperGen.marginalColor(pvismel, 'model marginal');
      }

      if (data1dRT !== undefined) {
        let pvismel = ('x' in data1dRT ? data1dRT.x : data1dRT.y).vismel;
        mapper.dataMarginalColor = MapperGen.marginalColor(pvismel, 'training data');
      }

      // if (testData1dRT !== undefined) {
      //   let pvismel = ('x' in testData1dRT ? testData1dRT.x : testData1dRT.y).vismel;
      //   mapper.testDataMarginalColor = MapperGen.marginalColor(pvismel, 'test data');
      // }

      // TODO: we will have color for p2dRT and data2dRT in the future - maybe.
      // if (p2dRT != undefined) { ... }
      // if (data2dRT != undefined) { ... }

      // TODO:
      // if there is an aggregation on color in the original vismel query:
      // this aggr is turned to a split for p1drt and p2drt, but both result in a value of the same dimension
      // we should really have an extent per yield dimension!

      // choose a neat chart type depending on data types

      // both, x and y axis are in use
      if (used.x && used.y) {

        let xDiscrete = PQL.hasDiscreteYield(xfu),
          yDiscrete = PQL.hasDiscreteYield(yfu),
          xSplit = PQL.isSplit(xfu),
          ySplit = PQL.isSplit(yfu);

        // x and y are numerical
        if (!xDiscrete && !yDiscrete) {

          // x and y are independent
          if (xSplit && ySplit) {

            if (used.color & !PQL.isSplit(aest.color.fu) && !used.shape && !used.size && !used.details) {
              //&& PQL.hasNumericYield(aest.color.fu)) {
              // -> heatmap
              traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
              traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));
              // traces.push(...TraceGen.bi(p2dRT, query, mapper, {axisId: mainAxis}));
              traces.push(...TraceGen.aggrHeatmap(aggrRT, mapper, mainAxis));
              traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
              traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
              traces.push(...TraceGen.samples(samplesRT, mapper, 'model samples', mainAxis));
              //traces.push(...TraceGen.aggr(aggrRT, query, mapper, mainAxis));
            }
            else { // if (used.shape) {
              // scatter plot
              // TODO: unterscheide weiter ob use.size? siehe http://wiki.inf-i2.uni-jena.de/doku.php?id=emv:visualization:default_chart_types
              traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
              traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));
              traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis));
              traces.push(...TraceGen.bi(data2dRT, mapper, mainAxis, {'facetName': 'data density'}));
              traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, facets));
              traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
              traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
              traces.push(...TraceGen.samples(samplesRT, mapper, 'model samples', mainAxis));
              traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
              traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
            }
          }
          // at least on is dependent
          else {
            traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
            traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));
            traces.push(...TraceGen.bi(data2dRT, mapper, mainAxis, {'facetName': 'data density'}));
            traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis));
            traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, facets));
            traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
            traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
            traces.push(...TraceGen.samples(samplesRT, mapper, 'model samples', mainAxis));
            traces.push(...TraceGen.aggr(dataLocalPredRT, mapper, mainAxis, {'facetName': 'predictionDataLocal'}));
            traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis, {'facetName': 'aggregation'}));
            traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
          }
        }

        //  x and y are discrete
        else if (xDiscrete && yDiscrete) {
          traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis/*, config.marginalColor.single*/));
          traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));

          // hard to show splits of more than rows and cols: overlap in visualization
          // TODO: solve by creating a bubble plot/jittered plot

          // hard to show samples in this case: major overlap in visualization.
          // TODO: solve by creating a bubble plot/jittered plot

          // non-discrete yield on color?
          if (used.color && !PQL.hasDiscreteYield(aest.color.fu)
            // TODO: the next line is new, test it! should disallow other splits
            && !PQL.isSplit(aest.color.fu) && !used.shape && !used.size && !used.details) {
            // don't show bi density in this case
            traces.push(...TraceGen.aggrHeatmap(aggrRT, mapper, mainAxis));
          }
          else {
            // TODO: make it a jittered plot?
            traces.push(...TraceGen.bi(p2dRT, mapper, mainAxis, {'geometry': geometry}));
            traces.push(...TraceGen.bi(data2dRT, mapper, mainAxis, {'facetName': 'data density', 'geometry': geometry}));
            traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
            traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
          }
        }

        // one is discrete, the other numerical
        else {
          traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis/*, config.marginalColor.single*/));
          traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));
          traces.push(...TraceGen.biQC(p2dRT, mapper, mainAxis, catQuantAxisIds));
          traces.push(...TraceGen.biQC(data2dRT, mapper, mainAxis, catQuantAxisIds, {'facetName': 'data density'}));
          traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, facets));
          traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
          traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
          traces.push(...TraceGen.samples(samplesRT, mapper, 'model samples', mainAxis));
          traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
          traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
        }
      }

      // only one of x-axis and y-axis is in use
      else if (used.x && !used.y || !used.x && used.y) {
        let [xOrY, axisFu] = used.x ? ['x', xfu] : ['y', yfu];
        traces.push(...TraceGen.uni(p1dRT, mapper, mainAxis, marginalAxis));
        traces.push(...TraceGen.uni(data1dRT, mapper, mainAxis, marginalAxis, {'facetName': 'dataMarginals'}));
        // the one in use is categorical
        if (PQL.hasDiscreteYield(axisFu)) {
          // anything special here to do?
        }
        // the one in use is numeric
        else if (PQL.hasNumericYield(axisFu)) {
          traces.push(...TraceGen.predictionOffset(aggrRT, testDataRT, mapper, mainAxis, facets));
        } else
          throw RangeError("axisFU has invalid yield type: " + axisFu.yieldDataType);
        traces.push(...TraceGen.samples(dataRT, mapper, 'training data', mainAxis));
        traces.push(...TraceGen.samples(testDataRT, mapper, 'test data', mainAxis));
        traces.push(...TraceGen.samples(samplesRT, mapper, 'model samples', mainAxis));
        traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
        traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
      } else {
        traces.push(...TraceGen.aggr(aggrRT, mapper, mainAxis));
        traces.push(...TraceGen.aggr(dataAggrRT, mapper, mainAxis, {'facetName': 'data aggregations'}));
      }

      return traces;
    }

    /**
     * Utility function. Takes the "so-far extent", new data to update the extent for and a flag that informs about the kind of data: discrete or continuous.
     * Note: it gracefully forgives undefined arguments in extent and newData
     * @returns The updated extent
     */
    function _extentUnion(extent, data, discreteFlag) {
      if (extent === undefined) extent = [];
      if (data === undefined) data = [];
      if (discreteFlag === true)
        return _.union(extent, data);
      else if (discreteFlag === false)
        return d3.extent([...extent, ...data]);
      throw RangeError("discreteFlag must be true or false, but is: " + discreteFlag.toString());
    }

    /**
     * Adds the extent of a result tables <rt> to the global extent. By construction all pql queries
     * share object-identical field usages, whenever appropriate.
     * @param rt A result tables. See ResultTable.js to understand result tables.
     * @param globalExtent A map of field usages to their global extents.
     * @return {Map} The modified global extent maps.
     */
    function addResultTableExtents(rt, globalExtent) {
      if (rt === undefined)
        return globalExtent;
      for (let [fu, idx] of rt.fu2idx.entries()) {
        let discreteFlag = PQL.hasDiscreteYield(fu);
        globalExtent.set(fu, _extentUnion(globalExtent.get(fu), rt.extent[idx], discreteFlag))
      }
      return globalExtent;
    }

    /**
     * Adds the extent of the result tables in collection <coll> to the global extent. By construction all pql queries
     * share object-identical field usages, whenever appropriate.
     * @param coll A collection of result tables. See ResultTable.js to understand result tables.
     * @param globalExtent A map of field usages to their global extents.
     * @param attr The attribute of each entry in the collection where to attach the globelExtent.
     * @return {Map} The modified global extent maps.
     */
    function addCollectionExtents(coll, globalExtent, attr = undefined) {
      let size = coll.size;
      for (let rIdx = 0; rIdx < size.rows; ++rIdx)
        for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
          let rt = coll[rIdx][cIdx];
          if (attr === undefined)
            addResultTableExtents(rt, globalExtent);
          else {
            if (rt === undefined)
              continue;  // rt is undefined if neither of the marginals are in use
            addResultTableExtents(rt[attr], globalExtent);
          }
        }

      return globalExtent;
    }

    /**
     * For each key in <globalExtent> (i.e. a FieldUsage) add its value (i.e. the global extent of that FieldUsage) to the key as the attribute .extent.
     * @param fuExtent A Map of FieldUsages to their global extents.
     */
    function attachToFieldUsages(fuExtent) {
      for (let [fu, extent] of fuExtent.entries())
        fu.extent = extent;
    }

    /**
     * Normalize the extents, i.e.
     *  * categorical extents: remove undefined if present (undefined may occur if no result could be generated for a particular query.)
     *  * quantitative extents: make the range bit lager.
     *  *
     * @param fuExtent
     */
    function normalizeExtents(fuExtent) {
      for (let [fu, extent] of fuExtent.entries())
        if (PQL.hasNumericYield(fu))
          fuExtent.set(fu, normalizeContinuousExtent(extent));
        else if (PQL.hasDiscreteYield(fu))
          fuExtent.set(fu, _.without(extent, undefined));
    }


    function getGlobalExtent(facets) {
      let globalExtent = new Map();
      for (let facetName in facets) {
          let facetColl = facets[facetName].data;
          if (facetName === 'marginals' || facetName === 'dataMarginals') {
              for (let xy of ['x', 'y'])
                addCollectionExtents(facetColl, globalExtent, xy);
          } else {
               addCollectionExtents(facetColl, globalExtent);
          }
      }
      return globalExtent;
    }


    /**
     * Converts a Map of FieldUsages to their extents to a Map of their yields to their extents.
     * @param fuExtent
     * @returns {Map<any, any>}
     */
    function getYieldExtent(fuExtent) {
      let yieldExtent = new Map();
      for (let [fu, extent] of fuExtent.entries()) {
        let name = fu.yields;
        let soFarExtent = yieldExtent.get(name);
        let updatedExtent = _extentUnion(soFarExtent, extent, PQL.hasDiscreteYield(fu));
        yieldExtent.set(name, updatedExtent);
      }
      return yieldExtent;
    }

    /**
     * Updates the mapping of FieldUsages to their extents based on the yieldExtents (which are based on yield dimensions)
     * @param fuExtent
     * @param yieldExtent
     * @returns {*}
     */
    function updateWithYieldExtent(fuExtent, yieldExtent) {
      for (let fu of fuExtent.keys())
        fuExtent.set(fu, yieldExtent.get(fu.yields))
      return fuExtent;
    }

    /**
     * Tweaks the given (continuous) extents of a given FieldUsage (for nicer displaying).  Note that it modifies the provided extent _and_ returns the modfied extent!
     * (1) non-singular extent: add pct*extent to upper and lower bound of extent
     * (2) singular extent and singular !== 0: upper = singular+pct*singular, lower = singular-pct*singular
     * (3) singular extent and singular === 0: upper = 1 , lower = -1
     * @param extent
     * @param pct percentage to add/substract. See above.
     */
    function normalizeContinuousExtent(extent, pct = 0.0) {
      if (extent[0] === extent[1]) { // if singular
        let singular = extent[0];
        if (singular === 0) {
          extent[0] = -1;
          extent[1] = 1;
        }
        else {
          extent[0] = singular - pct * singular;
          extent[1] = singular + pct * singular;
        }
      } else {
        let relOff = pct * (extent[1] - extent[0]);
        extent[0] -= relOff;
        extent[1] += relOff;
      }
      return extent;
    }

    /**
     * Returns the split usages that make up templating axis level splits, from outermost to innermost templating axis split.
     * @fus the stack of field usages that make up the templating axes
     */
    function getLevelSplits(fus) {
      let levelSplits = fus.filter(PQL.isSplit);
      if (!fus.some(PQL.isAggregationOrDensity))
        levelSplits.pop();
      return levelSplits;
    }

    function createEmptyTrace(xId, yId) {
      let trace = {};
      trace[xId[0] + "axis"] = xId;
      trace[yId[0] + "axis"] = yId;
      return trace;
    }


    /**
     * @xy 'x' ('y') if its an x-axis (y-axis)
     * @offset: .x (.y) is the offset in normalized coordinates for the templating axes
     * @size: .x (.y) is the size in normalized coordinates for the templating axes
     * @fus the stack of field usages that make up the templating axes
     * @id .x (.y) is the first free axis integer index for x (y) axis
     * @returns {} An array of axis objects for the layout part of a plotly plot configuration.
     */
    function createTemplatingAxis(xy, offset, size, fus, id) {
      let yx = _invXY(xy);

      // the number of stacked axis equals the number of splits in fus, reduced by one if there is no aggregation/density (since the last split then is part of an atomic plots axes)
      let levelSplits = getLevelSplits(fus);

      // available height (if xy === x) (width if xy === y) per axis level
      let levelSize = size[yx] / levelSplits.length;
      let axes = {}; // object of plotly axes objects
      let emtpyTraces = [];
      let annotations = []; // annotations for level titles
      let repeat = 1;

      levelSplits.forEach((split, d) => {
        let stackOffset = offset[yx] + levelSize * d; // the y (x) offset of axes in this level (this is identical for all axis of this level)
        let majorLength = size[xy] / repeat; // the width (height) of (a single) major axes in this level
        let minorId = id[yx]++;

        // only one minor axis per stack level is needed
        let anchor = xy + id[xy]; // anchor with the first major of this level (to be generated)
        let minor = config.axisGenerator.templating_minor(stackOffset, levelSize, anchor);

        // multiple major axis are needed
        let ticks = split.extent;
        for (let r = 0; r < repeat; ++r) {

          let majorId = id[xy]++,
            majorOffset = offset[xy] + majorLength * r;

          // new major axis (i.e. x axis for xy === x)
          axes[xy + 'axis' + majorId] = config.axisGenerator.templating_major(majorOffset, majorLength, splitExtentToString(split), yx + minorId);

          // create empty trace (axis is not shown, if it has no trace that uses it)
          emtpyTraces.push(createEmptyTrace(xy+majorId, yx+minorId));
        }

        repeat *= ticks.length;
        axes[yx + 'axis' + minorId] = minor;

        // add title once per level
        let annotation = config.annotationGenerator.axis_title(split.yields, xy, offset[xy], size[xy], stackOffset);
        //let annotation = config.annotationGenerator.axis_title(split.yields, xy, offset[xy], size[xy], 0);
        annotations.push(annotation);
      });

      return [axes, annotations, emtpyTraces];
    }

    function makeCategoricalQuantitativeAxis(rt, axisLength, mainOffset, idgen, mainAxesIds, idx, catQuantAxisIds, layout) {
      // build up helper variables needed later and to check if we are in the quant-categorical case     
     if (rt === undefined)
        return

      let fu = {x: rt.vismel.layout.cols[0], y: rt.vismel.layout.rows[0]},
        catXY = PQL.hasDiscreteYield(fu.x) ? 'x' : (PQL.hasDiscreteYield(fu.y) ? 'y' : undefined),
        quantXY = PQL.hasNumericYield(fu.x) ? 'x' : (PQL.hasNumericYield(fu.y) ? 'y' : undefined);

      if (catXY && quantXY) {
        let catFu = fu[catXY],
          catIdx = rt.fu2idx.get(catFu);

        // disable zooming on cat axis 
        let catAxisId = mainAxesIds[catXY][idx[catXY]];
        layout[catAxisId[0] + 'axis' + catAxisId.slice(1)].fixedrange = true;

        // available length per category in categorical dimension along categorical axis of main plot [in norm. coord]
        let catExtent = rt.extent[catIdx],
          n = catExtent.length,
          d = axisLength.main[catXY] / n;

        let pFu = rt.vismel.layout[PQL.hasDiscreteYield(fu.x) ? 'cols' : 'rows'][1],
          pIdx = rt.fu2idx.get(pFu),
          pExtent = rt.extent[pIdx];

        // build additional axes along categorial dimension, i.e. the axes that will encode density
        // need as many axis as there is categories!
        for (let i = 0; i < n; ++i) {
          const r = 2.0; // sets position of axis
          // offset of axis (i.e. along the categorical dimension)
          let o = mainOffset[catXY] + i * d + d / r,
            id_ = idgen.bicatquant[catXY]++,
            axis = config.axisGenerator.marginal(o, d * (r - 1) / r, mainOffset[quantXY], catXY);
          axis.anchor = mainAxesIds[quantXY][idx[quantXY]];

          // set axis labels and tick marks
          Object.assign(axis, getRangeAndTickMarks(pExtent, catXY));
          //axis.showticklabels = false;
          //axis.tickcolor
          //axis.ticklen = -210;
          let cd = config.colors.density;
          axis.color = cd.primary_single;
          axis.tickfont = {
            color: cd.adapt_to_color_usage ? cd.secondary_single : cd.primary_single
          };

          // hack to shorten inside axis // doesn't really work, because the tick at 0 is special...
          axis.ticks = "inside";
          axis.ticklen = 12;
          axis.tickwidth = 2;
          axis.tickcolor = "#FFFFFF";
          axis.mirror = "ticks";
          axis.zerolinecolor = "#878787";
          //axis.tickcolor = "#FF0000";
          //axis.side  = (catXY === 'y' ? "left" : "bottom");

          catQuantAxisIds.push(catXY + id_); // store for later reuse
          layout[catXY + "axis" + id_] = axis; // add to layout
        }
      }
    }

    function makeTraces(size, geometry, facets, vismelColl, mainAxesIds, marginalAxesIds, catQuantAxesIds, templAxesIds) {
      let traces = [];
      for (let y of _.range(size.y)) {
        for (let x of _.range(size.x)) {
          // create traces for one atomic plot
          let atomicTraces = atomicPlotlyTraces(geometry,
              facets.aggregations.data[y][x], facets['data aggregations'].data[y][x], facets.predictionDataLocal.data[y][x],
              facets.data.data[y][x], facets.testData.data[y][x], facets['model samples'].data[y][x],
              facets.marginals.data[y][x], facets.dataMarginals.data[y][x],
              facets.contour.data[y][x], facets['data density'].data[y][x],
              vismelColl.at[y][x],
              {
                x: mainAxesIds.x[x],
                y: mainAxesIds.y[y],
              }, marginalAxesIds[y][x], catQuantAxesIds[y][x], facets);

          traces.push(...atomicTraces);
        }
      }

      // axes that are not used by traces are not shown (https://community.plot.ly/t/unused-axis-not-drawn-in-plot/12215/2). Hence, we add empty traces for these
      for (let axis of templAxesIds) {
          
      }

      return traces;
    }

    /**
     * Using annotations to title templating axis:
     *
     * Templating axis need only one title per level, however the axes themselves may be duplicated several times within one level. Moreover we cannot control where exactly normal titles are shown. Hence we use annotations to generate proper per-level-titles for them.
     *
     * For a x-axis (analogous for y-axis):
     *
     *  * horizontal position: relative to canvas and 100% to the right (whatever width the templating level has)
     *  * vertical position: relative to y-axis of that level and at position 0 (it has range [0,1])
     */


    function makeMarginalAxes(marginal, paneOffset, axisLength, templAxisSize, mainAxesIds, idx, uniColl, idgen, layout, size) {
      let marginalAxisId = {};
      for (let [xy, yx] of [['x', 'y'], ['y', 'x']]) {
        if (marginal[xy]) { // marginal activate?

          let axisOffset = paneOffset[xy] + (config.plots.marginal.position[yx] === 'bottomleft' ? 0 : axisLength.main[xy]),
            axis = config.axisGenerator.marginal(axisOffset, axisLength.marginal[xy], templAxisSize[yx], xy);

          axis.anchor = mainAxesIds[yx][idx[yx]];  // anchor marginal axis to opposite letter main axis of the same atomic plot. This will position them correctly.

          //TODO find out when to show them and when not
          // axis.showticklabels = false;
          // never show these labels - they are not helpful, because the absolute value does not add valuable information
          if (xy === 'x')
            axis.showticklabels = idx[yx] === size[yx] - 1; // disables tick labels for all but one of the marginal axis of one row / col
          else
            axis.showticklabels = idx[yx] === 0; // disables tick labels for all but one of the marginal

          if (axis.side === 'right')
            axis.side = 'left';

          // [xy] is x or y axis; idx[xy] is index in view table
          let rc = (xy === 'x' ? 'cols' : 'rows');
          let uniVismel = uniColl[idx.y][idx.x][yx].vismel,
            xyFu = uniVismel.layout[rc][0];
          Object.assign(axis, getRangeAndTickMarks(xyFu.extent, xy));

          marginalAxisId[xy] = idgen.marginal[xy]++;
          layout[xy + "axis" + marginalAxisId[xy]] = axis;
          marginalAxisId[xy] = xy + marginalAxisId[xy];
        }
      }
      return marginalAxisId;
    }


    function makeLayout(vismel, vismelColl, facets, pane, size, axesSyncManager) {
      /*
       * Shortcut to the layout attributes of a vismel query table.
       * I.e. it is accessor to the layout fields usage for a certain row(y)/col(x) in the view table.
       */
      let getFieldUsage = (idx, xy, vismelQT) => {
        return xy === 'x' ? vismelQT.at[0][idx].layout.cols[0] : vismelQT.at[idx][0].layout.rows[0];
      };

      let qx = vismel.layout.cols,
        qy = vismel.layout.rows;

      // flag whether or not in an atomic plot the x axis (.x) (y axis (.y)) is in use, i.e. encodes some fieldusage of the model
      let used = {
        x: qx[0] !== undefined,
        y: qy[0] !== undefined,
      };

      // flag whether or not in an atomic plot a marginal axis will be drawn. .x (.y) is the flag for the marginal x axis (y axis)
      //  * we need a marginal plot, iff the opposite letter axis is used
      //  * but only if it is generally enabled in the config
      //  * and if there was any data passed in for marginals
      //  * and if the variable encoded by the axis is distributed
      let marginal = {
        // the stuff after "//" detect if we do not want marginal distribution plots. but detecting it here, comes with many
        // issues, e.g. data histograms may anyway be drawn
        x: (facets.marginals.active || facets.dataMarginals.active) && used.y, // && (!used.x || (used.x && qx.last().fields[0].varType === 'distributed')),
        y: (facets.marginals.active || facets.dataMarginals.active) && used.x, // && (!used.y || (used.y && qy.last().fields[0].varType === 'distributed')),
      };

      // get absolute pane size [in px]
      let paneSizePx = {
        x: pane.clientWidth,
        y: pane.clientHeight,
      };

      // size of templating axis to plots area [in normalized coordinates]
      let templAxisSize = {};
      {
        // TODO: new mode: infer from label length
        let fixedAxisWidth = true, // TODO: set as configuration value
          xlen = getLevelSplits(qx).length,
          ylen = getLevelSplits(qy).length;
        if (fixedAxisWidth) {
          templAxisSize.x = ylen === 0 ? 0 : (ylen * config.plots.layout.templ_axis_level_width.y / paneSizePx.x);
          templAxisSize.y = xlen === 0 ? 0 : (xlen * config.plots.layout.templ_axis_level_width.x / paneSizePx.y);
        } else {
          templAxisSize.x = getLevelSplits(qy).length * config.plots.layout.templ_axis_level_ratio.y;
          templAxisSize.y = getLevelSplits(qx).length * config.plots.layout.templ_axis_level_ratio.x;
        }
      }

      let paneSize = {
        x: 1 - templAxisSize.x,
        y: 1 - templAxisSize.y,
      };

      // width and heights of a single view cell in normalized coordinates
      let cellSize = {
        x: (1 - templAxisSize.x) / size.cols,
        y: (1 - templAxisSize.y) / size.rows,
      };

      // part of pane width (height) used for main x (y) axis in an atomic plot
      // size of main plot [in normalized coordinates]
      let mainPlotRatio = {
        x: marginal.x ? config.plots.layout.ratio_marginal(used.x) : 1,
        y: marginal.y ? config.plots.layout.ratio_marginal(used.y) : 1,
      };

      // length of the main x axis (y axis) of an atomic plot [in normalized coordinates]
      // includes padding!
      let axisLength = {
        main: {
          x: cellSize.x * mainPlotRatio.x,
          y: cellSize.y * mainPlotRatio.y,
        },
        marginal: {
          x: cellSize.x * (1 - mainPlotRatio.x),
          y: cellSize.y * (1 - mainPlotRatio.y),
        }
      };

      // padding between neighboring main axes in relative coordiantes
      // padding is always applied on the right/up side of an axis.
      // TODO: axis padding is applied equally to both sides of an axis
      // we don't need padding if we have marginal plots, as they separate the main axis anyway...
      // we also don't need padding if therer is only one plot anyway along that direction
      // TODO: do we rather want it in fixed pixel?
      axisLength.padding = {
        x: axisLength.main.x * config.plots.layout.main.axis_padding * !marginal.x * (qx.length > 1 ? 1 : 0),
        y: axisLength.main.y * config.plots.layout.main.axis_padding * !marginal.y * (qy.length > 1 ? 1 : 0),
      };

      // starting ids for the axis of different types. id determines z-order!
      let idgen = {
        templating: {x: 2, y: 1000},
        bicatquant: {x: 2000, y: 3000},
        main: {x: 4000, y: 5000},
        marginal: {x: 6000, y: 7000},
      };

      // init layout of plotly plotting specification
      let layout = {}, shapes = [];
      // array of main axis along view cell of view table, for both, x and y axis. The values are axis ids. (e.g. 'x6000')
      let mainAxesIds = {x: [], y: []};
      // array of marginal axis for each cell of view table, for both x and y axis. The values are axis ids.
      let marginalAxesIds = []; // each will have property .x and .y
      // array of categorical quantitative axes ids for each cell of view table, for both x and y axis. The values are axis id
      let catQuantAxesIds = [];
      // array of empty traces of atomic plots. This is required, as otherwise axes will not be drawn.
      let emptyMainTraces = [];

      // custom titles for axis
      let axisTitles = [];
      // indexing over x and y
      let idx = {x: 0, y: 0};
      // Mapping of yields to spatial axis. This is for anchoring all axis with the same yield together.
      let yield2axis = new Map();

      function getSetYield2Axis(yield_, yieldAxisId) {
        let axis = yield2axis.get(yield_);
        if (axis === undefined) { // never overwrite existing mappings. This maybe makes it easier to debug...
          yield2axis.set(yield_, yieldAxisId);
          axis = yieldAxisId; // TODO is that right?
        }
        return axis;
      }

      /*
       * loops over view cells:
       * * draw axis as required
       * * get trace for atomic plot of each cell
       */
      let at = new Array(size.rows);
      for (idx.y = 0; idx.y < size.y; ++idx.y) {
        at[idx.y] = new Array(size.x);
        marginalAxesIds.push([]);
        catQuantAxesIds.push([]);

        // current ids for x axis and y axis - for looping
        let id = {x: undefined, y: undefined};
        // current x axis and y axis - for looping
        let axis = {x: undefined, y: undefined};
        // current offset to origin of a view cell
        let paneOffset = {x: undefined, y: undefined};
        // current offset of main plot relative to view cell origin
        let mainOffset = {x: undefined, y: undefined};

        paneOffset.y = templAxisSize.y + cellSize.y * idx.y;
        mainOffset.y = paneOffset.y + (config.plots.marginal.position.x === 'bottomleft' ? axisLength.marginal.y : 0);

        for (idx.x = 0; idx.x < size.x; ++idx.x) {
          marginalAxesIds[idx.y].push([]);
          catQuantAxesIds[idx.y].push([]);
          paneOffset.x = templAxisSize.x + cellSize.x * idx.x;
          mainOffset.x = paneOffset.x + (config.plots.marginal.position.y === 'bottomleft' ? axisLength.marginal.x : 0);

          // make main axis
          for (let [xy, yx] of [['y', 'x'], ['x', 'y']]) {
            axis[xy] = config.axisGenerator.main(
              mainOffset[xy] + 0.5 * axisLength.padding[xy],
              axisLength.main[xy] - 0.5 * axisLength.padding[xy],
              paneOffset[yx] + 0.5 * axisLength.padding[yx],
              used[xy]);
            id[xy] = idgen.main[xy]++;  // id of the current main y-axis

            if (used[xy]) {                
              let xyFU = getFieldUsage(idx[xy], xy, vismelColl),
                xyField = xyFU.yieldField,
                xyYield = xyFU.yields;
              // store the mapping of yield-to-axis for later reuse
              let refAxis = getSetYield2Axis(xyYield, xy + id[xy]);
              axesSyncManager.linkAdd(xy + id[xy], refAxis);

              // tick labels and title only for the first axis (tickmarks are always enabled anyway)
              if (idx[yx] === 0) {
                let axisTitleAnno = config.annotationGenerator.axis_title(
                  xyYield, xy,
                  mainOffset[xy] + 0.5 * axisLength.padding[xy],
                  axisLength.main[xy] - 0.5 * axisLength.padding[xy],
                  paneOffset[yx]);
                axisTitles.push(axisTitleAnno);
              } else {
                axis[xy].showticklabels = false;
              }

              // use categorical ordering of the variable
              if (xyField.isDiscrete()) {
                axis[xy].categoryorder = 'array';
                axis[xy].categoryarray = xyField.extent.values;
              }
            }

            // add to plotly layout
            layout[xy + "axis" + id[xy]] = axis[xy];
            id[xy] = xy + id[xy];
            if (!used[xy] || idx[yx] === 0) {
              // we only push the first of all axis for one row/column
              mainAxesIds[xy].push(id[xy]);
            }
          }

          // add empty trace
          // TODO: fix it? problem is that the empty trace hides the underlying plotted data ...
          //emptyMainTraces.push(createEmptyTrace(id.x, id.y));

          // make bounding box - iff it is not just a marginal plot
          if (used.x && used.y) {
            shapes.push(config.annotationGenerator.bounding_rect(axis.x, axis.y));
          }

          // create marginal axes as needed
          let marginalFacetData = (facets.marginals.active ? facets.marginals.data : facets.dataMarginals.data);
          marginalAxesIds[idx.y][idx.x] = makeMarginalAxes(marginal, paneOffset, axisLength, templAxisSize, mainAxesIds, idx, marginalFacetData, idgen, layout, size);

          // special case: quantitative-categorical: create additional axis for that.
          // it's an array of axes (along cat dimension): one for each possible value of that categorical dimension
          let catQuantAxisIds = [];
          if (used.x && used.y && facets.contour.active /*biColl[0][0] !== undefined*/)
            makeCategoricalQuantitativeAxis(facets.contour.data[idx.y][idx.x], axisLength, mainOffset, idgen, mainAxesIds, idx, catQuantAxisIds, layout);
          catQuantAxesIds[idx.y][idx.x] = catQuantAxisIds;
        }
      }

      // add templating axis
      let [templx, annotationsx, templEmptyTracesX] = createTemplatingAxis('x', {x: templAxisSize.x, y: 0}, {
        x: 1 - templAxisSize.x,
        y: templAxisSize.y
      }, qx, idgen.templating);
      let [temply, annotationsy, templEmptyTracesY] = createTemplatingAxis('y', {x: 0, y: templAxisSize.y}, {
        x: templAxisSize.x,
        y: 1 - templAxisSize.y
      }, qy, idgen.templating);
      Object.assign(layout, templx, temply);
      let templAxesIds = [...Object.keys(templx), ...Object.keys(temply)].map( k => k[0] + k.slice(5)); // it's always of shape [xy]axis[1-9]*

      // add 'global' layout options
      Object.assign(layout, {
        //title: "",
        title: vismel.sources[0].name,
        barmode: 'group',
        bargroupgap: 0.05,
        margin: config.plots.layout.margin,
        annotations: [...axisTitles, ...annotationsx, ...annotationsy],
        shapes: shapes,
        editable: true,
        hovermode: 'closest',
        paper_bgcolor: "rgba(255,255,255,0.9)",
        plot_bgcolor: 'rgba(255,255,255,0)',
      });

      let geometry = {
        paneSizePx,
        cellSize,
        cellSizePx : {
          x : cellSize.x * paneSizePx.x,
          y : cellSize.y * paneSizePx.y,
        },
        axisLength,
        mainPlotRatio,
        templAxisSize,
      };

      return [at, geometry, layout, {mainAxesIds, marginalAxesIds, catQuantAxesIds, templAxesIds}, [...emptyMainTraces, ...templEmptyTracesX, ...templEmptyTracesY]];
    }

    /**
     * A ViewTable takes data collections and a query collection and turns it into an actual visual representation.
     * This visualization is attached to the DOM within the given pane <div> object.
     *
     * A ViewTable is a table of ViewPanes. Each ViewPane represents a single cell of the table.
     *
     * A ViewTable emits events:
     *  "PanZoom": if the user panned/zoomed in the visualization.
     *
     * @param pane A <div> element. This must already have a width and height.
     * @param aggrColl The {@link Collection} of predictions to visualize.
     * @param dataColl The {@link Collection} of training data to visualize.
     * @param testDataColl The {@link Collection} of test data to visualize.
     * @param uniColl The {@link Collection} of marignal probability values to visualize.
     * @param biColl The {@link Collection} of probability values to visualize.
     * @constructor
     * @alias module:ViewTable
     */
    class ViewTable {

      constructor(pane, legend, vismelColl, facets) {
        Emitter(this);
        this.facets = facets;
        this.vismel = vismelColl.base;
        this.vismelColl = vismelColl;  // is the collection of the base queries for each atomic plot, i.e. cell of the view table
        this.size = vismelColl.size;
        this.size.x = this.size.cols;
        this.size.y = this.size.rows;
        this.plotlyPane = pane;
        this.legend = legend;
        this.plotlyTraces = undefined;
        this.plotlyLayout = undefined;
        this.plotlyConfig = undefined;
        this.axesSyncManager = new AxesSync.AxesSyncManager();

        let vismel = this.vismelColl.base;  // .base is the common original base query of all queries that resulted in all these collections
        vismel.used = vismel.usages();

        let axesSyncManager = this.axesSyncManager;

        // Quick Fix of Normalization Problem, #issue ##
        // TODO: fix this cleaner.
        // TODO: implement an iterator/map/apply over collections and resulttables. This would really reduce duplication :)
        _normalizeDensitiesGlobally(facets.marginals, facets.dataMarginals, facets.contour, facets['data density']);

        // create global extent (i.e. across all result collections as far as it makes sense!)
        // globalExtent is a Map that maps FieldUsages to their extents
        let globalExtent = getGlobalExtent(facets);
        // generate yield-based extents from it
        let yieldExtent = getYieldExtent(globalExtent);
        globalExtent = updateWithYieldExtent(globalExtent, yieldExtent);
        // normalize extents
        normalizeExtents(globalExtent);
        // now finally attach to the field usages, i.e.:
        // each FieldUsage gets a .extent attribute that has its global extent (wrt its yield)!
        attachToFieldUsages(globalExtent);

        // TODO: build mappers here!!
        // build mappers for visual channels: fill, size, shape, (but not positional)

        // and global config options.
        // See https://github.com/plotly/plotly.js/blob/master/src/plot_api/plot_config.js#L22-L86
        let plConfig = {
          edits: {
            annotationPosition: true,
            colorbarPosition: true,
            legendPosition: true,
          },
          scrollZoom: true,
          displaylogo: false,
          // modeBarButtons: [
          //   // can add custom functionality!
          //   // see: https://github.com/plotly/plotly.js/blob/v1.3.0/src/components/modebar/buttons.js
          //   // and: https://codepen.io/etpinard/pen/QyLbqY
          //   ['pan2d','zoom2d','resetScale2d','sendDataToCloud',],
          // ],
          modeBarButtonsToRemove: ['toImage', 'zoomIn2d', 'zoomOut2d', 'boxSelect', 'lassoSelect', 'resetScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian'],
          // modeBarButtonsToAdd: [],
        };

        let [at, geometry, layout, axes, emptyTraces] = makeLayout(vismel, vismelColl, facets, pane, this.size, axesSyncManager);

        let traces = makeTraces(this.size, geometry, facets, vismelColl, axes.mainAxesIds, axes.marginalAxesIds, axes.catQuantAxesIds, axes.templAxesIds);

        // plot everything
        this.plotlyTraces = [...emptyTraces, ...traces];
        this.plotlyLayout = layout;
        this.plotlyConfig = plConfig;
        this._plot();
      };

      _plot() {
        let that = this;        
        Plotly.newPlot(this.plotlyPane, this.plotlyTraces, this.plotlyLayout, this.plotlyConfig);

        this.plotlyPane.on('plotly_afterplot', () => {
          VisLegend(that.vismel, that.legend);
        });

        this.plotlyPane.on('plotly_relayout', (event) => {          

          let updateEvent = utils.assignWithFilter({}, event, /^[xy]axis[0-9]+\./); // matches anything that begins with an axis id like xaxis9000
          if (Object.keys(updateEvent).length) {
            this.emit('PanZoom', updateEvent);
            that.plotlyLayout = that.axesSyncManager.propagate(
                AxesSync.parseRelayoutDict(updateEvent), 
                that.plotlyLayout
            );
            Plotly.react(that.plotlyPane, that.plotlyTraces, that.plotlyLayout, that.plotlyConfig);
          }          
        });

        this.plotlyPane.on('plotly_afterplot', event => {
          const styleToRemove = 'fill: transparent;';
          // this is hacky, but at least it won't do any damage if it doesn't work
          let draglayersPlotly = $('.main-svg .draglayer g .drag.nsewdrag', this.plotPane);
          draglayersPlotly.each( (idx, layer) => {
              layer = $(layer);
              let style = layer.attr('style');
              // check that the expected styling is in the style. often this is not the case because we have removed it before
              if (style.includes(styleToRemove)) {
                style = style.replace(styleToRemove, "").trim();          
                layer.attr('style', style);
              }
          });
        });
      }


      onPaneResize(ev) {
        /**
         * Extracts relevant state of axes
         * @param layout
         */
        function getAxesState(layout) {
          let axes = {};
          for (let key of Object.keys(layout)) 
            if (/^[xy]axis[0-9]+$/.test(key)) 
              axes[key] = utils.assignWithFilter({}, layout[key], ['range', 'autorange']);
          return axes;
        }

        // 1. save state of aces
        let savedAxesState = getAxesState(this.plotlyLayout);

        // 2. recreate layout (no need to recreate traces)
        let newLayout = makeLayout(this.vismel, this.vismelColl, this.facets, this.plotlyPane, this.size, this.axesSyncManager)[2];

        // 3. apply saved state recreated layout
        this.plotlyLayout = merge(newLayout, savedAxesState);

        // 4. run Plotly.react
        this._plot()
      };
    }

    return ViewTable;
  });