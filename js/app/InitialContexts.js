/**
 * Provides contexts as a list of JSON objects that will be loadad on start up of lumen.
 *
 * @module InitialContexts
 * @copyright © 2019 Philipp Lucas (philipp.lucas@dlr.de)
 * @author Philipp Lucas
 */
define(['lib/logger'], function (Logger) {
  'use strict';

  let json = [];

  // TODO fill
  json.push();

  /* json is a list and each element is:
   *  * a json object or json string describing a Context
   *  * a json object or json string describing a ContextCollection
   *
   * A context collection is simply a JSON object like:
   * {
   *  class: 'ContextCollection',
   *  contexts: [ <list-of-contexts-as-json> ]
   * }
   */
  return json;
});