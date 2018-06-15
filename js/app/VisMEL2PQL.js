/**
 * A collection of translation methods that converts a given VisMEL query into a PQL query.
 *
 * All return an object with three properties: query, fu2idx, idx2fu, as follows:
 *
 *   query: the generated PQL query.
 *
 *   fu2idx: a Map from the FieldUsage s of the VisMEL query to their corresponding column index in the result of the query. This encodes which {@link FieldUsage} of the VisMEL query is represented by which column of the result table.
 *
 *   idx2fu: an array that maps a row index of the result of the query to the corresponding FieldUsage.
 *
 * If it is for some reason impossible to generate a valid query from given VisMEL query a ConversionError is thrown.
 */
define(['lib/logger', './utils', './PQL', './VisMEL', './ViewSettings'], function (Logger, utils, PQL, VisMEL, c) {
  "use strict";

  let logger = Logger.get('pl-vismel2pql');
  logger.setLevel(Logger.INFO);

  /**
   * Error Class that indicates a conversion error for vismel2pql conversions. No suitable pql query can be derived in this case.
   */
  class ConversionError extends utils.ExtendableError {}

  /**
   * Translates a VisMEL query into a predict PQL query as specified in the VisMEL query.
   * @param vismel
   * @return {query, fu2idx, idx2fu}
   */
  function predict(vismel) {
    // note:
    // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
    // - multiple measures of the same field are possible

    // 1. build list of split fields and aggregate fields, and attach indices to FieldUsages of query

    // note: in the general case query.fieldUsages() and [...dimensions, ...measures] do not contain the same set of
    //  field usages, as duplicate dimensions won't show up in dimensions
    // TODO: it's not just about the same method, is just should be the same Split! Once I implemented this possiblity (see "TODO-reference" in interaction.js) no duplicate split should be allowed at all!

    let fieldUsages = PQL.cleanFieldUsages(vismel.fieldUsages()),
      dimensions = [],
      fu2idx = new Map(),
      idx2fu = [],
      idx = 0;

    fieldUsages.filter(PQL.isSplit).forEach(fu => {
      // todo: this kind of comparison is ugly and slow for the case of many dimensions
      // how to make it better: build boolean associative array based on fu.base -> then the find becomes a simple lookup
      let sameBase = dimensions.find(elem => (fu.name === elem.name));
      if (sameBase) {
        // fu is already there
        if (fu.method === sameBase.method /*|| fu.method === 'identity'*/) {
          fu.index = sameBase.index;
          fu2idx.set(fu, sameBase.index);
        } else
          throw new RangeError("If using multiple splits of the same field in an atomic query, either their splitter methods must match, or at most one may split differently than by 'identity'!");
      }
      else {
        // fu is new
        fu.index = idx;
        idx2fu.push(fu);
        fu2idx.set(fu, idx);
        dimensions.push(fu);
        idx++;
      }
    });

    let measures = [];
    fieldUsages
      .filter(fu => PQL.isAggregationOrDensity(fu))
      .forEach(fu => {
        fu.index = idx;
        idx2fu.push(fu);
        fu2idx.set(fu, idx);
        measures.push(fu);
        idx++;
      });

    let query = {
      'type': 'predict',
      'predict': [...dimensions, ...measures],
      'splitby': dimensions,
      'mode': vismel.mode
    };

    return {query, fu2idx, idx2fu};
  }

  function sample(vismelQuery, opts) {
    // we derive the data-select query from a PQL/VisMEL query as follows:
    //  * filters: stay unchanged as filters
    //  * splits: add the name of what is split to the select-clause
    //  * aggregations: add the name of the field that is the yield of the aggregation to the select-clause
    //  * densities: ignore them. A valid density anyway requires a split - which is handleled above
    // note2: we need to detect multiple usages of the same name and add indices later accordingly

    let idx2fu = [],
      idx = 0,
      fu2idx = new Map(),
      select = new Map();  // map of <field-name to select> to <index of column in result-table>
    let filters = [];
    for (let fu of PQL.cleanFieldUsages(vismelQuery.fieldUsages())) {
      let name;
      if (PQL.isFilter(fu) && fu.field.name !== "model vs data") {
        filters.push(fu);
        continue;
      }
      else if (PQL.isSplit(fu))
        name = fu.name;
      else if (PQL.isAggregation(fu))
        name = fu.yields;
      else if (PQL.isDensity(fu))
        continue;
      else
        throw new RangeError('Unknown object in field usages: ' + fu.toString());

      if (select.has(name)) {
        // don't add again but reuse the stored index
        let prev_idx = select.get(name);
        fu2idx.set(fu, prev_idx);
      } else {
        fu2idx.set(fu, idx);
        select.set(name, idx);
        idx2fu.push(fu);
        idx++;
      }
    }

    // TODO: validate opts?
    let query = {
      'type': 'select',
      'select': Array.from(select.keys()),
      'where': filters,
      'opts': opts
    };
    return {query, fu2idx, idx2fu}
  }

  return {
    predict,
    sample,
    ConversionError,
  };

});