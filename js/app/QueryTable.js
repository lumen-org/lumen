/**
* This module defines a query table, i.e. a table of 'atomic' {@link VisMEL} queries that are derived from a templated {@link VisMEL} query.
*
* @author Philipp Lucas
* @module QueryTable
*/

define(['lib/logger', './Field', './VisMEL'], function (Logger, F, VisMEL) {
  "use strict";

  var logger = Logger.get('pl-QueryTable');
  logger.setLevel(Logger.DEBUG);

  /**
   * Extends the field usages template in query, possibly merging domains if applicable.
   * @param query {VisMEL} The templated query.
   * @param what {"rows"|"cols"} Expand the template in the rows or cols?
   * @return {Array} Returns the array of template instantiations.
   * @private
   */
  var _extendTemplate = function (query, what) {

    if (what !== "rows" && what !== "cols")
      throw new TypeError("the value of 'what' has to be 'rows' or 'cols' but it is : " + what);

    let nsf = (what === "rows" ? query.layout.rows.normalize() : query.layout.cols.normalize()),
      len = nsf.length,
      expansion = new Array(len);

    for (let i=0; i<len; ++i) {
      // shallow copy query. shallow means that all {@link FieldUsage}s in the copy are references to those in query.
      let instance = query.shallowCopy(),
        details = instance.layers[0].aesthetics.details,
        layout = (what === "rows" ? instance.layout.rows : instance.layout.cols);

      // delete templated part (this does not affect the base query)
      layout.clear();

      // iterate over all field usages of the current NSF element
      nsf[i].forEach(
        function (fu) {
          if (F.isDimension(fu)) {
            // find dimension usages on details shelf that are based on the same name
            let idx = details.findIndex( function (o) {
              return F.isDimension(o) && fu.name === o.name;
            });
            if (idx !== -1) {
              // merge the domains of the existing fieldUsage with fieldUsage of NSF
              // do NOT modify the existing fieldUsage since it is a shallow copy. Instead create a new FieldUsage.
              let mergedFU = new F.FieldUsage(details[idx]);
              mergedFU.domain = mergedFU.domain.intersection(fu.domain);
              details[idx] = mergedFU;
              logger.log('merging domains...');
            } else {
              details.push(fu);
            }
          }
          else {
            if (!layout.empty())
              throw new Error("After template expansion there must be only one FU on a row/col shelf");
            layout.push(fu);
          }
        }
      );
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
    let rowBase = _extendTemplate(query, 'rows');

    this.at = new Array(rowBase.length);
    for (let i = 0; i < this.at.length; ++i) {
      this.at[i] = _extendTemplate(rowBase[i], 'cols');
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
          throw new RangeError("templated expansion failed!")
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