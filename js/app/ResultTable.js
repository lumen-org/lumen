/**
 * @module ResultTable
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['lib/logger', 'd3', './PQL', './VisMEL2PQL'], function (Logger, d3, PQL, vismel2pql) {
  "use strict";

  var logger = Logger.get('pl-ResultTable');
  logger.setLevel(Logger.DEBUG);


  /**
   * Attaches the extent of each column of a (row-major) result table under the attribute .extent and returns the modified table.
   * Naturally this requires each row of the table to have equal number of items. A RangeError is raised otherwise.
   * Note that a result table is expected, which has the .idx2fu property.
   */
  function _attachExtent(resulttable) {
    if (resulttable.length === 0 || resulttable[0].length === 0)
      resulttable.extent = [];
    else {
      let cols = resulttable[0].length;
      let extent = new Array(cols);
      for (let i = 0; i < cols; ++i) {
        if (resulttable.idx2fu[i].yieldDataType === PQL.FieldT.DataType.num)
          extent[i] = d3.extent(resulttable, row => row[i]); // jshint ignore:line
        else if (resulttable.idx2fu[i].yieldDataType === PQL.FieldT.DataType.string)
          extent[i] = _.unique(_.map(resulttable, row => row[i]));
        else
          throw new RangeError("invalid data type.");
      }
      resulttable.extent = extent;
    }
    return resulttable;
  }


  /**
   * Utility function for multiple reuse in collection creation below.
   * @private
   */
  function _runAndaddRTtoCollection(model, pql, idx2fu, fu2idx, collection, rIdx, cIdx, prop = undefined) {
    return model.execute(pql).then(table => {
      table.idx2fu = idx2fu;
      table.fu2idx = fu2idx;
      table.query = pql;
      table = _attachExtent(table);
      if (prop) {
        if (!collection[rIdx][cIdx])
          collection[rIdx][cIdx] = {};
        collection[rIdx][cIdx][prop] = table;
      } else
        collection[rIdx][cIdx] = table;
    });
  }


  function getEmptyCollection (size) {
    let collection = new Array(size.rows);
    collection.size = size;
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
   *  * .query: the PQL query whose execution resulted in this result table
   *  * .fu2idx, .idx2fu: see vismel2pql documentation.
   *
   *
   * Since the collection is merely an 2d array, elements can be accessed using the standard [] notation
   * @param queryCollection
   * @param modelCollection
   * @return {Promise.<Array>}
   */
  function aggrCollection(queryCollection, modelCollection, enabled=true) {
    let size = queryCollection.size;
    let collection = getEmptyCollection(size);
    if (!enabled)  // quit early if disabled
      return Promise.resolve(collection);

    let fetchPromises = new Set();
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        // generate and run PQL query
        let promise;
        try {
          let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.aggregation(queryCollection.at[rIdx][cIdx]);
          promise = _runAndaddRTtoCollection(modelCollection.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx);
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
  function samplesCollection(queryCollection, modelTable, enabled=true) {
    let size = queryCollection.size;
    let collection = getEmptyCollection(size);
    if (!enabled)  // quit early if disabled
      return Promise.resolve(collection);

    let fetchPromises = new Set();
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        let promise;
        try {
          let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.samples(queryCollection.at[rIdx][cIdx]);
          promise = _runAndaddRTtoCollection(modelTable.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx);
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
   * @param model
   * @return {Promise.<Array>}
   */
  function uniDensityCollection(queryCollection, modelTable, enabled=true) {
  //function uniDensityCollection(queryCollection, model, enabled=true) {
    let size = queryCollection.size;
    let collection = getEmptyCollection(size);
    if (!enabled)  // quit early if disabled
      return Promise.resolve(collection);

    let fetchPromises = new Set();
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        for(let [xOrY, colsOrRows] of [['x','cols'], ['y', 'rows']] ) {
          let promise;
          try {
            let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.uniDensity(queryCollection.at[rIdx][cIdx], colsOrRows, modelTable.at[rIdx][cIdx]);
            promise = _runAndaddRTtoCollection(modelTable.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx, xOrY);
          } catch (e) {
            if (e instanceof vismel2pql.ConversionError)
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
   * @param model
   * @return {Promise.<Array>}
   */
  function biDensityCollection(queryCollection, modelTable, enabled=true) {
    let size = queryCollection.size;
    let collection = getEmptyCollection(size);
    if (!enabled)  // quit early if disabled
      return Promise.resolve(collection);

    let fetchPromises = new Set();
    for (let rIdx = 0; rIdx < size.rows; ++rIdx) {
      for (let cIdx = 0; cIdx < size.cols; ++cIdx) {
        let promise;
        try {
          let {query: pql, fu2idx: fu2idx, idx2fu: idx2fu} = vismel2pql.biDensity(queryCollection.at[rIdx][cIdx]);
          promise = _runAndaddRTtoCollection(modelTable.at[rIdx][cIdx], pql, idx2fu, fu2idx, collection, rIdx, cIdx);
        }
        catch (e) {
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

  return {
    aggrCollection,
    samplesCollection,
    uniDensityCollection,
    biDensityCollection,
  };
});
