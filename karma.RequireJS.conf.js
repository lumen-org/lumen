// Karma configuration
// Generated on Tue Jan 27 2015 14:01:14 GMT+0100 (CET)

module.exports = function(config) {
  'use strict';

  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: 'js',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'requirejs'],


    // list of files / patterns to load in the browser
    // note (requirejs): only include (-> attribute 'include') those files that are NOT loaded by requires
    files: [
      //'https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js',
      //'../node_modules/js-logger/src/logger.min.js',
      {pattern: 'lib/**/*.js', included: false},
      {pattern: 'app/**/*.js', included: false},
      {pattern: 'test/**/*.spec.js', included: false},
      'test-entry.js'
    ],


    // list of files to exclude
    exclude: [
      'run-entry.js'
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    //browsers: ['PhantomJS', 'Chrome'],
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
