/**
 * Created by philipp on 23/11/15.
 */


/**
 * Type definitions of a Field.
 * @type {{Type: {string: string, num: string}, Role: {measure: string, dimension: string}, Kind: {cont: string, discrete: string}}}
 * @alias module:shelves.FieldT
 */
var FieldT = {
  Type: {string: 'string', num: 'numerical'},
  Role: {measure: 'measure', dimension: 'dimension'}, //todo: ????
  Kind: {cont: 'continuous', discrete: 'discrete'}
};

/**
 * Type definitions of a FieldUsage.
 * @type {{Aggregation: {sum: string, avg: string}, Scale: {linear: string, log: string}, Order: {ascending: string, descending: string}}}
 * @alias module:shelves.FUsageT
 */
var FUsageT = {
  Aggregation: {sum: 'sum', avg: 'avg'},
  Scale: {
    linear: 'linear', log: 'log'
  },
  Order: {
    ascending: 'asc', descending: 'desc'
  }
};