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
   * @param what {"rows"|"cols"} Is the template the rows or cols
   * @return Returns the array of template instantiations.
   * @private
   */
  var _extendTemplate = function (query, what) {

    if (what !== "rows" && what !== "cols")
      throw new TypeError("the value of 'what' has to be 'rows' or 'cols' but it is : " + what);

    var nsf = (what === "rows" ? query.layout.rows.normalize() : query.layout.cols.normalize());
    var len = nsf.length;
    var extension = new Array(len);

    for (let i=0; i<len; ++i) {
      // shallow copy query. shallow means that all {@link FieldUsage}s in the copy are references to those in query.
      let instance = query.shallowCopy();
      let instDetails = instance.layers[0].aesthetics.details;
      let instLayout = (what === "rows" ? instance.layout.rows : instance.layout.cols);

      // delete templated part
      instLayout.clear();

      // iterate over all field usages of the current NSF element
      nsf[i].forEach(
        function (fu) {
          if (fu.isDimension()) {
            // find dimension usages on details shelf that are based on the same name.
            let idx = instDetails.findIndex( function (o) {
              return F.isDimension(o) && fu.name === o.name;
            });
            if (idx !== -1) {
              throw new Error('merging of domains for template extension not implemented yet');
              // todo: merge the domains of the existing fieldUsage with fieldUsage of NSF
              // do NOT modify the existing fieldUsage since it is a shallow copy!!
            }
            instDetails.push(fu);
          }
          else {
            if (!instLayout.empty())
              throw new Error("After template extension there must be only one FU on a row/col shelf");
            instLayout.push(fu);
          }
        }
      );
      extension[i] = instance;
    }

    return extension;
  };

  /**
   * @param query A templated {@link VisMEL} query.
   * @constructor
   */
  var QueryTable = function (query) {
    this.at = _extendTemplate(query, 'rows');
    for (let i = 0; i < this.at.length; ++i) {
      this.at = _extendTemplate(this.at[i], 'cols');
    }
  };

  return QueryTable;
});