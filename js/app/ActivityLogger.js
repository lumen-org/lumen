/**
 * Module for logging of user actions.
 *
 * Example Usage:
 *   ActivityLogger.logPath("user_log.json");
 *   ActivityLogger.logServerUrl(DEFAULT_ACTIVITY_LOGGER_URL);
 *   ActivityLogger.mode('remote');
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
   * Sets the mode for this logger or returns the currently set mode.
   * @param mode Mode to set, one of "disabled", "console.err", "console.log", "remote".
   */
  function mode(mode=undefined) {
    const validModes = new Set(["disabled", "console.error", "console.log", "remote"]);

    if (mode === undefined)
      return this._mode;

    if (!validModes.has(mode))
      throw RangeError("invalid mode. must be one of " + [...validModes]);

    this._mode = mode;
    enable(mode !== 'disabled')
  }

  /**
   * If no path is given it returns the currently set output path.
   *
   * If a path is given it is set as the new output path. This causes the previously opened logfile to be closed and the
   * new one to be opened. The . If you set replaceFlag to true the contents of the new log files are overwritten, else
   * they are apended (the default).
   * @param path
   * @param replaceFlag
   */
  function logPath(path = undefined, replaceFlag=false) {
    if (path === undefined) {
      return _logPath;
    } else {
      // set a new log file on the server
      _logPath = path;
      // if append is set to true the single next log command will have append=true and hence overwrite all of the previous log file
      _appendContent = !replaceFlag;
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
      // try to serialize it (it may throw)
      let tryout = JSON.stringify(obj);

      // store it
      _additionalFixedContent = obj;
    }
  }

  /**
   * Writes the given json-serializable object to the log file.
   * @param jsonSerializableObj
   * @param activityType
   * @private
   */
  function log(jsonSerializableObj, activityType='NO_TYPE') {
    if (!enabled())
      return;

    // add some more attributes to log
    jsonSerializableObj.activityType = activityType;
    jsonSerializableObj.timestamp = Date.now(); // number of milliseconds since
    jsonSerializableObj.logPath = _logPath;  // log path
    jsonSerializableObj.logAppend = _appendContent;  // reset log file?
    if (_appendContent === false)   // only overwrite once!
      _appendContent = true;
    jsonSerializableObj = Object.assign(jsonSerializableObj, _additionalFixedContent);  // additional content

    // serialize
    let serializedObject = JSON.stringify(jsonSerializableObj);

    if (this._mode === 'console.log')
      console.log(serializedObject);
    else if (this._mode === 'console.error')
      console.error(serializedObject);
    else
      // send to log server
      d3.json(_logServerUrl)
        .header("Content-Type", "application/json")
        .post(serializedObject, (err, json) => err ? _logFailed(err) : 0);
  }

  function _logFailed(err) {
    logger.warn("something went wrong");
    logger.warn(err.toString());
  }

  // exports of this module
  return {
    additionalFixedContent,
    mode,
    logPath,
    logServerUrl,
    ready,
    log
  };

});