/**
 * @module interaction
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @author Philipp Lucas
 */
define(['lib/logger', './PQL'], function (Logger, PQL) {
  'use strict';

  var logger = Logger.get('pl-ShelfGraphConnector');
  logger.setLevel(Logger.DEBUG);


  /**
   * Given a Shelf return the first record that has content that is a Field with name == dimName.
   * @param shelf
   */
  function getRecordByDimensionName (shelf, dimName) {
    for (let record of shelf) {
      let field = record.content;
      if (PQL.isField(field) && field.name === dimName)
        return record;
    }
    return undefined;
  }

  return {
    getRecordByDimensionName,
  };
});