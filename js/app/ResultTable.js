/**
 * @module ResultTable
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'lib/d3-collection', 'd3', './PQL', './VisMEL2PQL', './VisMEL4Traces'], function (Logger, d3c, d3, PQL, vismel2pql, V4T) {
    "use strict";

    var logger = Logger.get('pl-ResultTable');
    logger.setLevel(Logger.DEBUG);

    /**
     * Attaches the extent of each column of a (row-major) result table under the attribute .extent and returns the modified table.
     * Naturally this requires each row of the table to have equal number of items. A RangeError is raised otherwise.
     * Note that a result table is expected, which has the .idx2fu property.
     */
    function _attachExtent(resultTable) {
        if (resultTable === undefined) {
            throw "check this out"
        }            
        if (resultTable.length === 0 || resultTable[0].length === 0)
            resultTable.extent = [];
        else {
            let cols = resultTable[0].length;
            let extent = new Array(cols);
            for (let i = 0; i < cols; ++i) {
                if (resultTable.idx2fu[i].yieldDataType === PQL.FieldT.DataType.num)
                    extent[i] = d3.extent(resultTable, row => row[i]); // jshint ignore:line
                else if (resultTable.idx2fu[i].yieldDataType === PQL.FieldT.DataType.string)
                    extent[i] = _.unique(_.map(resultTable, row => row[i]));
                else
                    throw new RangeError("invalid data type.");
            }
            resultTable.extent = extent;
        }
        return resultTable;
    }

    /**
     * Utility function for multiple reuse in collection creation below.
     * @private
     */
    function _runAndaddRTtoCollection(model, pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName, prop = undefined) {
        let execOps = {
            returnEmptyTableOnFailure: (facetName === 'dataMarginals')
        };
        return model.execute(pql, execOps).then(table => {
            table.idx2fu = idx2fu;
            table.fu2idx = fu2idx;
            table.pql = pql;
            table.vismel = vismel;
            table.model = model;
            table = _attachExtent(table);
            if (prop) {
                if (!collection[rIdx][cIdx])
                    collection[rIdx][cIdx] = {};
                collection[rIdx][cIdx][prop] = table;
            } else
                collection[rIdx][cIdx] = table;
            return table;
        });
    }

    /**
     * Normalize a column of a ResultTable in place.
     * @param rt ResulTable
     * @param columnIdx integer.
     *    Index of Column to normalize.
     * @param targetWeight see code.
     * @param normalizationFactor see code.
     * @returns {*}
     */
    function normalizeRT (rt, columnIdx, targetWeight=1, normalizationFactor=undefined) {
        if (normalizationFactor === undefined) {
            let currentWeight = d3.sum(rt, row => row[columnIdx]);
            normalizationFactor = targetWeight / currentWeight;
        }
        rt.forEach( row => row[columnIdx] *= normalizationFactor);
        return _attachExtent(rt);
    }

    function getEmptyCollection(size, enabled) {
        let collection = new Array(size.rows);
        collection.size = size;
        collection.enabled = enabled;
        for (let rIdx = 0; rIdx < size.rows; ++rIdx)
            collection[rIdx] = new Array(size.cols);
        return collection;
    }

    /**
     * Derives for each VisMEL query and each model in the given collection the corresponding PQL
     * query, executes it and stores both, the query and its result, in a 2d array collection. A call to this function returns a promise to the collection.
     *
     * Each element of the collection is a ResultTable, i.e. a row-major list of lists which stores the result of a query in tabular form. An individual entry of the can be accessed via [rowIdx][columnIdx].
     *
     * It has additional properties as follows:
     *
     *  * .header: a list of names for the columns of the table
     *  * .pql: the PQL query whose execution resulted in this result table
     *  * .vismel: the VisMEL query that the PQL query was derived from, if any
     *  * .model: the model which the PQL query was executed on
     *  * .fu2idx, .idx2fu: see vismel2pql documentation.
     *
     *
     * Since the collection is merely an 2d array, elements can be accessed using the standard [] notation
     * @param queryCollection
     * @param modelCollection
     * @param fieldUsageCacheMap
     * @param facetName
     * @param enabled
     * @return {Promise.<Array>}
     */
    function aggrCollection(queryCollection, modelCollection, fieldUsageCacheMap, facetName, enabled = true) {
        let size = queryCollection.size;
        let collection = getEmptyCollection(size, enabled);
        if (!enabled)  // quit early if disabled
            return Promise.resolve(collection);

        let fetchPromises = new Set();
        for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
            for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
                let promise;

                // 1. convert atomic vismel VisMEL query to suitable VisMEL query for this facet
                let vismel = queryCollection.at[rIdx][cIdx];  // in this particular case, there is nothing to do
                // unify identical field usages / maps!
                vismel = V4T.reuseIdenticalFieldUsagesAndMaps(vismel, fieldUsageCacheMap);

                try {
                    // 2. convert this facet's atomic VisMEL query to PQL query
                    let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.predict(vismel);

                    // 3. run this query and return promise to its result
                    promise = _runAndaddRTtoCollection(modelCollection.at[rIdx][cIdx], pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName);

                } catch (e) {
                    if (e instanceof vismel2pql.ConversionError)
                        promise = Promise.resolve(undefined);
                    else
                        throw e;
                }
                fetchPromises.add(promise);
            }
        }
        return Promise.all(fetchPromises).then(() => collection);
    }


    function predictionDataLocalCollection(queryCollection, modelCollection, fieldUsageCacheMap, facetName, enabled = true, opts = {}) {
        let size = queryCollection.size;
        let collection = getEmptyCollection(size, enabled);
        if (!enabled)
            return Promise.resolve(collection);

        let fetchPromises = new Set();
        for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
            for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
                let promise;

                // 1. convert atomic vismel VisMEL query to suitable VisMEL query for this facet
                let vismel = V4T.predictionDataLocal(queryCollection.at[rIdx][cIdx]);
                // unify identical field usages / maps
                vismel = V4T.reuseIdenticalFieldUsagesAndMaps(vismel, fieldUsageCacheMap);

                try {
                    // 2. convert this facet's atomic VisMEL query to PQL query
                    let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.predict(vismel, opts);

                    // 3. run this query and return promise to its result
                    promise = _runAndaddRTtoCollection(modelCollection.at[rIdx][cIdx], pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName);

                } catch (e) {
                    if (e instanceof vismel2pql.ConversionError)
                        promise = Promise.resolve(undefined);
                    else
                        throw e;
                }
                fetchPromises.add(promise);
            }
        }
        return Promise.all(fetchPromises).then(() => collection);
    }

    /**
     * See aggr Collection
     * @param queryCollection
     * @param model
     * @return {Promise.<Array>}
     */
    function samplesCollection(queryCollection, modelTable, fieldUsageCacheMap, facetName, enabled = true, opts = {}) {
        let size = queryCollection.size;
        let collection = getEmptyCollection(size, enabled);
        if (!enabled)  // quit early if disabled
            return Promise.resolve(collection);

        let fetchPromises = new Set();
        for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
            for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
                let promise;

                try {
                    // 1. convert atomic vismel VisMEL query to suitable VisMEL query for this facet
                    let vismel = V4T.samples(queryCollection.at[rIdx][cIdx]);
                    // unify identical field usages / maps!
                    vismel = V4T.reuseIdenticalFieldUsagesAndMaps(vismel, fieldUsageCacheMap);

                    // 2. convert this facet's atomic VisMEL query to PQL query
                    let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.sample(queryCollection.at[rIdx][cIdx], opts);

                    // 3. run this query and return promise to its result
                    promise = _runAndaddRTtoCollection(modelTable.at[rIdx][cIdx], pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName);
                } catch (e) {
                    if (e instanceof vismel2pql.ConversionError)
                        promise = Promise.resolve(undefined);
                    else
                        throw e;
                }
                fetchPromises.add(promise);
            }
        }
        return Promise.all(fetchPromises).then(() => collection);
    }

    /**
     * An UniDensityResultTable creates marginal density queries for each atomic query of a given queryTable, and stores their results (on request using fetch()) in a result table, that can be accessed via the attribute [][].x and [][].y where .x refers to the x axis and y to the y axis.
     *
     * [][].x is not undefined iff the respective VisMEL query had any FieldUsage on columns. Similarly for [][].y and a required FieldUsage on Rows.
     *
     * For the layout of the individual result tables see vismel2pq.uniDensity().
     *
     * @param queryCollection
     * @param modelTable
     * @param fieldUsageCacheMap
     * @param enabled
     * @param opts
     * @return {Promise.<Array>}
     */
    function uniDensityCollection(queryCollection, modelTable, fieldUsageCacheMap, facetName, enabled = true, opts = {}) {
        let size = queryCollection.size;
        let collection = getEmptyCollection(size, enabled);
        if (!enabled)  // quit early if disabled
            return Promise.resolve(collection);

        let fetchPromises = new Set();
        for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
            for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
                for (let [xOrY, colsOrRows] of [['x', 'cols'], ['y', 'rows']]) {
                    let promise,
                        model = modelTable.at[rIdx][cIdx];
                    try {
                        // 1. convert atomic VisMEL query to suitable VisMEL query for this facet
                        let vismel = V4T.uniDensity(queryCollection.at[rIdx][cIdx], colsOrRows);

                        // unify identical field usages / maps!
                        vismel = V4T.reuseIdenticalFieldUsagesAndMaps(vismel, fieldUsageCacheMap);

                        // 2. convert this facet's atomic VisMEL query to PQL query
                        let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.predict(vismel);

                        // 3. run this query and return promise to its result
                        promise = _runAndaddRTtoCollection(model, pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName, xOrY);
                        // .then(
                        // tbl => {
                        //   // TODO: Hack for Paper: simulate correct scaling of model probability queries
                        //   let nester = d3c.nest();
                        //   nester.key(e => e[0]);
                        //   for (let _key of ["$model", "$data"]) {
                        //     let probs = nester.map(tbl)[_key];
                        //     if (probs != undefined) {
                        //       let prob_sum = probs.reduce((s, e) => s + e[2], 0);
                        //       probs.map(e => e[2] = e[2] / prob_sum);
                        //     }
                        //   }
                        //   // rerun attachExtent
                        //   _attachExtent(tbl);
                        //   return tbl;
                        // });
                    } catch (e) {
                        if (e instanceof vismel2pql.ConversionError || e instanceof V4T.ConversionError)
                            promise = Promise.resolve(undefined);
                        else
                            throw e;
                    }
                    fetchPromises.add(promise);
                }
            }
        }
        return Promise.all(fetchPromises).then(() => collection);
    }

    /**
     * See aggr Collection
     * @param queryCollection
     * @param modelTable
     * @param fieldUsageCacheMap
     * @param facetName
     * @param enabled
     * @param opts
     * @return {Promise.<Array>}
     */
    function biDensityCollection(queryCollection, modelTable, fieldUsageCacheMap, facetName, enabled=true, opts={}) {
        let size = queryCollection.size;
        let collection = getEmptyCollection(size, enabled);
        if (!enabled)  // quit early if disabled
            return Promise.resolve(collection);

        let fetchPromises = new Set();
        for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
            for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
                let promise,
                    model = modelTable.at[rIdx][cIdx];

                try {
                    // 1. convert atomic VisMEL query to suitable VisMEL query for this facet
                    let vismel = V4T.biDensity(queryCollection.at[rIdx][cIdx]);
                    // unify identical field usages / maps!
                    vismel = V4T.reuseIdenticalFieldUsagesAndMaps(vismel, fieldUsageCacheMap);

                    // 2. convert this facet's atomic VisMEL query to PQL query
                    let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.predict(vismel);

                    // 3. run this query and return promise to its result
                    promise = _runAndaddRTtoCollection(model, pql, vismel, idx2fu, fu2idx, collection, rIdx, cIdx, facetName);

                } catch (e) {
                    if (e instanceof vismel2pql.ConversionError || e instanceof V4T.ConversionError)
                        promise = Promise.resolve(undefined);
                    else
                        throw e;
                }
                fetchPromises.add(promise);
            }
        }
        return Promise.all(fetchPromises).then(() => collection);
    }

    return {
        aggrCollection,
        samplesCollection,
        uniDensityCollection,
        biDensityCollection,
        getEmptyCollection,
        predictionDataLocalCollection,
        normalizeRT,
    };
});
