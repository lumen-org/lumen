/**
 * This module defines a query table, i.e. a table of 'atomic' {@link VisMEL} queries that are derived from a templated {@link VisMEL} query.
 *
 * @author Philipp Lucas
 * @module QueryTable
 */

define(['lib/logger', './Field'], function (Logger, F) {
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
      expansion = new Array(len);

    for (let i=0; i<len; ++i) {
      // shallow copy query. shallow means that all {@link FieldUsage}s in the copy are references to those in query.
      let instance = query.shallowCopy(),
        filter = instance.layers[0].filters,
        details = instance.layers[0].aesthetics.details,
        layout = (what === "rows" ? instance.layout.rows : instance.layout.cols);

      // delete templated part (this does not affect the base query!)
      layout.clear();

      nsf[i].forEach( fu => {
        if (F.isDimension(fu)) {
          // add the FU to details, since we need that field to be included in the result table alter. Do not change its domain, as the domain is readonly
          let idx = details.findIndex(o => F.isDimension(o) && fu.name === o.name);
          if (idx === -1) {
            details.push(fu.origin);
            // TODO: change split function to prevent further splitting?
          }
          // however, add a filer to restrict its domain accordingly at query time
          filter.push({
            name: fu.name,
            operator: 'in',
            value: [fu.domain.l, fu.domain.h]
          });
        } else {
          console.assert(layout.empty(), "After template expansion there must be only one FU on a row/col shelf");
          layout.push(fu);
        }
      });
      expansion[i] = instance;
    }

    return expansion;
  };

  /**
   * @param query A templated {@link VisMEL} query.
   * @constructor
   */
  var QueryTable = function (query) {

    // todo: apply filter on dimensions

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

    // verify expansion
    // @debug
    for (let r=0; r<this.size.rows; ++r)
      for(let c=0; c<this.size.cols; ++c)
        if(this.at[r][c].layout.rows.filter(F.isDimension).length !== 0 ||
           this.at[r][c].layout.cols.filter(F.isDimension).length !== 0)
          throw "templated expansion failed!";
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