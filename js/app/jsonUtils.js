/**
 * Utility functions for handling JSON.
 * @module utils
 * @author Philipp Lucas
 * @copyright © 2019 Philipp Lucas (philipp.lucas@dlr.de)
 */
define([], function() {
  'use strict';


  /**
   * Utility function for parsing of json objects.
   * Asserts that given {jsonObj} has an attribute 'class' with value {cls} and throw otherwise.
   * @param jsonObj
   * @param cls
   */
  function assertClass (jsonObj, cls) {
    if (jsonObj.class !== cls)
      throw `json object is not a ${cls}, as it's 'class' attribute has value ${jsonObj.class}`;
  }

  /**
   * Given a JSON returns a nicely indented and syntax-highlighted and version of it.
   * Credits to: https://stackoverflow.com/questions/4810841/how-can-i-pretty-print-json-using-javascript
   * @param json {String|Object}
   * @return String A HTML string.
   */
  function prettifyJSON(json) {
    if (typeof json != 'string') {
      json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      var cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }


  function stringify(jsonObj, pretty=true, replacer=undefined, space=2) {
    return JSON.stringify(jsonObj, replacer, space);
  }


  /**
   * Removes empty dicts and empty lists and returnd modified object.
   *
   * Note that it does not recurse down but only does a shallow search in the own properties of {jsonObj}.
   *
   * @param jsonObj
   */
  function removeEmptyElements (jsonObj) {
    for (let key in jsonObj) {
      let val = jsonObj[key];
      if( _.isObject(val) && _.isEmpty(val))
        delete jsonObj[key];
    }
    return jsonObj;
  }


  /**
   * Returns a json represention of obj using it's toJSON() method. Returns {} if not such method is available.
   * @param obj
   * @return {{}}
   */
  function toJSON_failsafe(obj) {
    try {
      return obj.toJSON();
    } catch (TypeError) {
      return {};
    }
  }

  function fromJSON_failsafe(jsonObj, FromJSON, ...moreArgs) {
    return _.isEmpty(jsonObj) ? {} : FromJSON(jsonObj, ...moreArgs);
  }


  function arrayToJSON(arr) {
    return arr.map(e => e.toJSON());
  }

  function arrayFromJSON(arr, FromJSON, ...moreargs) {
    return arr.map( d => FromJSON(d, ...moreargs) )
  }

  return {
    assertClass,
    removeEmptyElements,
    toJSON_failsafe,
    fromJSON_failsafe,
    arrayToJSON,
    arrayFromJSON,
    stringify
  }
});