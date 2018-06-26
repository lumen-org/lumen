/**
 * Module for logging of user actions.
 *
 * Example Usage:
 *   ActivityLogger.logPath("user_log.json");
 *   ActivityLogger.logServerUrl(DEFAULT_ACTIVITY_LOGGER_URL);
 *   ActivityLogger.additionalFixedContent({'user_id':'NOT_SET'});
 *   ActivityLogger.enable(true);
 *
 * @module UserActionLogger
 * @author Philipp Lucas
 * @copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define(['lib/logger', 'd3'], function (Logger, d3) {
  "use strict";

  let logger = Logger.get('pl-UserActionLogger');
  logger.setLevel(Logger.INFO);

  let _enabled = false;

  let _additionalFixedContent = {};
  let _logPath = undefined;
  let _logServerUrl = undefined;
  let _appendContent = true;

  /**
   * Returns true iff user action logging is initialized and ready, i.e. 'it is ready to go'.
   * @returns {boolean}
   */
  function ready() {
    return _enabled && _logPath !== undefined && _logServerUrl !== undefined;
  }

  /**
   * Enables/disables user action logging.
   * @param onOff
   */
  function enable(onOff = true) {
    _enabled = onOff;
  }

  /**
   * Returns true iff user action logging is active.
   * @returns {boolean}
   */
  function enabled() {
    return _enabled;
  }

  /**
   * If no path is given it returns the currently set output path.
   * If a path is given it is set as the new output path.
   * This will close any previously set log file and then open the new one. If you set append to true then previous contents are kept. Otherwise it is overwritten.
   * @param path
   */
  function logPath(path = undefined, append=true) {
    if (path === undefined) {
      return _logPath;
    } else {
      // set a new log file on the server
      _logPath = path;
      // if append is set to true the single next log command will have append=true and hence overwrite all of the previous log file
      _appendContent = append;
    }
  }

  function logServerUrl(serverUrl = undefined) {
    if (serverUrl === undefined) {
      return _logServerUrl;
    } else {
      _logServerUrl = serverUrl;
    }
  }

  /**
   * Get the currently set additional content, or set it. Pass {} to remove any additional content.
   * Obj must be json-serializable.
   * @param obj
   */
  function additionalFixedContent (obj=undefined) {
    if (obj === undefined) {
      return _additionalFixedContent;
    } else {
      // try to serialize it
      let tryout = JSON.stringify(obj);

      // store it
      _additionalFixedContent = obj;
    }
  }

  /**
   * Writes the given json-serializable object to the log file.
   * @param jsonSerializableObj
   * @private
   */
  function log(jsonSerializableObj, activityType='NO_TYPE') {
    if (!enabled)
      return;

    // add some more attributes to log
    jsonSerializableObj.activityType = activityType;
    jsonSerializableObj.timestamp = Date.now(); // number of milliseconds since
    jsonSerializableObj.logPath = _logPath;  // log path
    jsonSerializableObj.logAppend = _appendContent;  // reset log file?
    if (_appendContent === false)   // only overwrite once!
      _appendContent = true;
    jsonSerializableObj = Object.assign(jsonSerializableObj, _additionalFixedContent);  // additional content

    // DEBUG
    console.log(jsonSerializableObj);

    // serialize
    let serializedObject = JSON.stringify(jsonSerializableObj);

    // send to log server
    console.error(serializedObject.toString());
    // TODO:
    // d3.json(_logServerUrl)
    //   .header("Content-Type", "application/json")
    //   .post(serializedObject, (err, json) => err ? _logFailed(err) : console.log(json.toString()));
  }

  function _logFailed(err) {
    logger.info(err.toString());
  }

  // exports of this module
  return {
    additionalFixedContent,
    enable,
    enabled,
    logPath,
    logServerUrl,
    ready,
    log
  };

});