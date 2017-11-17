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
 * If it is for some reason impossible to generate a valid query from given VisMEL query a
 */
define(['lib/logger', './utils', './PQL'], function (Logger, utils, PQL) {
  "use strict";

  var logger = Logger.get('pl-vismel2pql');
  logger.setLevel(Logger.DEBUG);

  /**
   * Error Class that indicates a conversion error for vismel2pql conversions. No suitable pql query can be derived in this case.
   */
  class ConversionError extends utils.ExtendableError {}

  /**
   * Translates a VisMEL query into a PQL query of the aggregations requested in the VisMEL query.
   * @param vismelQuery
   * @return {query, fu2idx, idx2fu}
   */
  function aggregation(vismelQuery) {
    // note:
    // - all dimensions based on the same field must use the same split function and hence map to the same column of the result table
    // - multiple measures of the same field are possible

    // 1. build list of split fields and aggregate fields, and attach indices to FieldUsages of query

    // note: in the general case query.fieldUsages() and [...dimensions, ...measures] do not contain the same set of
    //  field usages, as duplicate dimensions won't show up in dimensions
    // TODO: it's not just about the same method, is just should be the same Split! Once I implemented this possiblity (see "TODO-reference" in interaction.js) no duplicate split should be allowed at all!

    let fieldUsages = vismelQuery.fieldUsages(),
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
      'mode': vismelQuery.mode
    };

    return {query, fu2idx, idx2fu};
  }

  function samples(vismelQuery) {
    // note:
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
    for (let fu of vismelQuery.fieldUsages()) {
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

    let query = {
      'type': 'select',
      'select': Array.from(select.keys()),
      'where': filters
    };
    return {query, fu2idx, idx2fu}
  }

  /**
   *
   * All filters of the VisMEL query are preserved.
   *
   * When executing the resulting query, you will get a result table with columns in a certain order, as follows:
   *
   *   1. column:
   *     * idx: 0
   *     * name: 'data vs model'
   *     * fieldUsage: A Split on the 'data vs model' Field.
   *   2. column:
   *     * idx: 1
   *     * name: the name of the field which is on rows/cols in the VisMEL query
   *     * fieldUsage: the FieldUsage which is on rows/cols in the VisMEL query
   *   3. column:
   *     * idx: 2
   *     * name: density[<all involved fields>])
   *     * fieldUsage: a new Density FieldUsage over all splits
   *   4.+ all other remaining discrete fields that is split by.
   *
   * Handling the model vs data field (mvd):
   *   case 1: mvd is entirely unused in the base VisMEL query.
   *     -> then it defaults to a filter on 'model' and a identity split
   *   case 2: mvd is used as a split:
   *     -> then stays the same and use the split as the mvds field usage
   *   case 3: mvd is used as a filter (but not as a split):
   *     - add a elements split on mvd
   *
   * @param vismelQuery The VisMEL query to derive the PQL query from.
   * @param rowsOrCols There is up to two marginal density queries from a VisMEL query, one for the FieldUsage on Layout.Rows and one for the FieldUsage on Layout.Cols. Accordingly, this parameter may have the value 'rows' or 'cols'.
   * @param model The model against which the resulting query is executed later.
   * @return {*}
   */
  function uniDensity(vismelQuery, rowsOrCols, model) {
    if (rowsOrCols !== 'cols' && rowsOrCols !== 'rows')
      throw new RangeError("rowsOrCols must be 'rows' or 'cols' but is:" + rowsOrCols.toString());

    let axisFieldUsage = vismelQuery.layout[rowsOrCols][0];
    if (!PQL.isFieldUsage(axisFieldUsage)) {
      // nothing to do! set result table to empty and return fullfilled promise
      //return Promise.resolve(_emptyResultTable());
      throw new ConversionError("empty " + rowsOrCols);
    }

    // collect splits from aesthetics and details
    let splits = vismelQuery.fieldUsages(['layout', 'filters'], 'exclude')
      .filter(PQL.isSplit)
      .filter(split => split.field.isDiscrete());

    // find (index of) split on data vs model
    let mvd_split_idx = splits.findIndex(split => split.name === 'model vs data');
    let mvd_split = []; // this is an array on purpose, even though it as one element at maximum
    if (mvd_split_idx !== -1)
      mvd_split = splits.splice(mvd_split_idx, 1); // removes mvd_split and returns it

    // create new split for univariate density
    let densitySplit = PQL.Split.FromFieldUsage(axisFieldUsage, 'density');

    // create new univariate density field usage
    let fields4density = [...splits, densitySplit].map(split => split.field);
    let densityUsage = new PQL.Density(fields4density);

    // find mvd filter
    let filters = vismelQuery.fieldUsages(['filters'], 'include');
    let mvd_filter = filters.find(elem => elem.name === 'model vs data');
    // TODO: there could be more than one mvd filter

    // if there is no filter on model vs data and no split on model vs data ...
    if (mvd_filter === undefined && mvd_split_idx == -1) {
      // .. then add a (new) filter on model vs data == model
      filters.push(PQL.Filter.ModelVsDataFilter(model, 'model'));
      // .. and add a (new) identity split on model vs data (for consistency)
      mvd_split = [PQL.Split.ModelVsDataSplit(model, 'identity')]
    }
    // if mvd is used as a filter, but has no split on it ...
    if (mvd_filter !== undefined && mvd_split_idx == -1) {
      // ... add an elements split
      mvd_split = [PQL.Split.ModelVsDataSplit(model, 'elements')]
    }

    // build accessor maps
    let fu2idx = new Map();
    let idx2fu = [mvd_split[0], densitySplit, densityUsage, ...splits];
    idx2fu.forEach((fu, idx) => fu2idx.set(fu, idx));

    let query = {
      'type': 'predict',
      'predict': ['model vs data', densitySplit.name, densityUsage, ...splits.map(split => split.name)],
      'splitby': [...mvd_split, densitySplit, ...splits],
      'where': filters
    };
    return {query, fu2idx, idx2fu}
  }

  /**
   * Given a VisMEL query, it constructs a PQL query for the 2d model density over the fields of rows and cols.
   * */
  function biDensity(vismelQuery) {
    // can only get density if there is something on rows and cols
    let xfu = vismelQuery.layout.cols[0];
    let yfu = vismelQuery.layout.rows[0];
    if (!PQL.isFieldUsage(xfu) || !PQL.isFieldUsage(yfu)) {
      // nothing to do! set result table to empty and return fullfilled promise
      //return Promise.resolve(_emptyResultTable())
      throw new ConversionError("at least one empty axis");
    }

    let xSplit = PQL.Split.FromFieldUsage(xfu, 'density');
    let ySplit = PQL.Split.FromFieldUsage(yfu, 'density');
    for (let s of [xSplit, ySplit])
      s.args[0] = 30;
    let densityFu = new PQL.Density([xSplit.field, ySplit.field]);

    let idx2fu = [xSplit, ySplit, densityFu];
    let fu2idx = new Map();
    idx2fu.forEach((fu, idx) => fu2idx.set(fu, idx));

    // respect any filters but mvd_filter s
    let filters = vismelQuery.fieldUsages(['filters'], 'include').filter( f => f.field.name !== "model vs data");

    let query = {
      'type': 'predict',
      'predict': [xSplit.name, ySplit.name, densityFu],
      'where': filters,
      'splitby': [xSplit, ySplit]
    };

    return {query, fu2idx, idx2fu}
  }


  return {
    aggregation,
    samples,
    biDensity,
    uniDensity,
    ConversionError
  };

});