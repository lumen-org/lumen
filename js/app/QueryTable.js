/**
 * This module defines a query table, i.e. a table of 'atomic' {@link VisMEL} queries that are derived from a templated {@link VisMEL} query.
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module QueryTable
 */

define(['lib/logger', './PQL', './init'], function (Logger, PQL, __) {
  "use strict";

  var logger = Logger.get('pl-QueryTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Extends the field usage templates in query, possibly merging domains if applicable.
   *
   * Removes a template by expanding it into a list of atomic queries. The implicit domain restrictions are encoded
   * in filter statements of the query.
   *
   * @param query {VisMEL} The templated query.
   * @param what {"rows"|"cols"} Expand the template in the rows or cols?
   * @return {Array} Returns the array of template instantiations, i.e. an array of atomic VisMEL queries with respect
   *  to the expanded template.
   * @private
   */
  var _expandTemplate = function (query, what) {

    if (what !== "rows" && what !== "cols")
      throw "the value of 'what' has to be 'rows' or 'cols' but it is : " + what;

    let nsf = (what === "rows" ? query.layout.rows.normalize() : query.layout.cols.normalize()),
      len = nsf.length,
      expansion = [];

    for (let i=0; i<len; ++i) {
      // shallow copy query. shallow means that all {@link FieldUsage}s in the copy are references to those in query.
      let instance = query.shallowCopy(),
        filter = instance.layers[0].filters,
        details = instance.layers[0].aesthetics.details,
        layout = (what === "rows" ? instance.layout.rows : instance.layout.cols);

      // delete templated part (this does not affect the base query!)
      layout.clear();

      nsf[i].forEach( fu => { // jshint ignore:line
        if (PQL.isFilter(fu)) {
          // add this field to details, if not already in the query. This is necessary since we need that field to be included in the result table later.
          let fus = instance.fieldUsages(['layout','filters']); // exclude 'layout' and 'filters' from search
          if (-1 === fus.findIndex(o => PQL.isSplit(o) && o.name === fu.name)) {
            // this split is necessary to generate any input from that field at all
            details.push(new PQL.Split(fu.field, 'identity'));
          }
          // add the filer to restrict its domain accordingly at query time
          filter.push(fu);
        } else {
          // push remaining field usage to layout
          console.assert(layout.empty(), "After template expansion there must be only one FU on a row/col shelf");
          layout.push(fu);
        }
      });
      expansion.push(instance);
    }

    return expansion;
  };

  /**
   * @param query A templated {@link VisMEL} query.
   * @constructor
   */
  var QueryTable = function (query) {
    // apply filter on splitting dimensions
    // do this by modifying the fields of the splits in the rows and column accordingly
    let filters = query.layers[0].filters;
    for (let idx=0; idx<filters.length; idx++) {
      // TODO: only apply filters on splits (at the moment there is nothing else...)
      filters[idx].apply();
    }

    this.base = query;
    let rowBase = _expandTemplate(query, 'rows');

    this.at = new Array(rowBase.length);
    for (let i = 0; i < this.at.length; ++i) {
      this.at[i] = _expandTemplate(rowBase[i], 'cols');
    }
    this.size = {
      rows: this.at.length,
      cols: (this.at.length > 0 ? this.at[0].length : 0)
    };
  };

  /**
   * For debugging
   */
  QueryTable.prototype.first = function () {
    return this.at[0][0];
  };

  /**
   * For debugging
   */
  QueryTable.prototype.firstColumn = function () {
    return this.at[0][0].layout.cols[0];
  };

  return QueryTable;
});