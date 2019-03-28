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

  let initial = {
    "class": "ContextCollection",
    "contexts": [
      {
        "position": {
          "top": 288,
          "left": 674
        },
        "size": {
          "width": "500px",
          "height": "500px"
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "emp_mpg",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": "car_size",
                "split": "elements",
                "class": "Split"
              }
            ],
            "cols": [
              {
                "name": [
                  "displacement"
                ],
                "aggregation": "maximum",
                "yields": "displacement",
                "class": "Aggregation"
              }
            ]
          },
          "layers": [
            {
              "class": "layer",
              "aesthetics": {
                "mark": "auto"
              }
            }
          ]
        }
      },
      {
        "position": {
          "top": 37,
          "left": 67
        },
        "size": {
          "width": "500px",
          "height": "500px"
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "emp_iris",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": "species",
                "split": "elements",
                "class": "Split"
              }
            ],
            "cols": [
              {
                "name": [
                  "sepal_length"
                ],
                "aggregation": "maximum",
                "yields": "sepal_length",
                "class": "Aggregation"
              }
            ]
          },
          "layers": [
            {
              "class": "layer",
              "aesthetics": {
                "mark": "auto"
              }
            }
          ]
        }
      }
    ]
  };

  json.push(initial);

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