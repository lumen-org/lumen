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
          "top": 1.9791679382324219,
          "left": 443.9410095214844
        },
        "size": {
          "width": "381px",
          "height": "346px"
        },
        "facets": {
          "aggregations": {
            "active": true,
            "possible": true
          },
          "data": {
            "active": true,
            "possible": true
          },
          "testData": {
            "active": false,
            "possible": true
          },
          "marginals": {
            "active": false,
            "possible": true
          },
          "contour": {
            "active": false,
            "possible": true
          }
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "Iris_tsne_testdata",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": "Emb_dim2",
                "split": "equiinterval",
                "args": [
                  8
                ],
                "class": "Split"
              }
            ],
            "cols": [
              {
                "name": "Emb_dim1",
                "split": "equiinterval",
                "args": [
                  8
                ],
                "class": "Split"
              }
            ]
          },
          "layers": [
            {
              "class": "layer",
              "aesthetics": {
                "mark": "auto",
                "color": {
                  "name": [
                    "petal_length"
                  ],
                  "aggregation": "maximum",
                  "yields": "petal_length",
                  "class": "Aggregation",
                  "channel": "rgb"
                }
              }
            }
          ]
        }
      },
      {
        "position": {
          "top": 352.9340591430664,
          "left": 452.9166564941406
        },
        "size": {
          "width": "359px",
          "height": "310px"
        },
        "facets": {
          "aggregations": {
            "active": true,
            "possible": true
          },
          "data": {
            "active": false,
            "possible": true
          },
          "testData": {
            "active": false,
            "possible": true
          },
          "marginals": {
            "active": false,
            "possible": true
          },
          "contour": {
            "active": true,
            "possible": true
          }
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "mpg_lle_pred",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "mpg_highway"
                ],
                "aggregation": "maximum",
                "yields": "mpg_highway",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": [
                  "year"
                ],
                "aggregation": "maximum",
                "yields": "year",
                "class": "Aggregation"
              }
            ]
          },
          "layers": [
            {
              "class": "layer",
              "aesthetics": {
                "mark": "auto",
                "color": {
                  "name": "Emb_dim1",
                  "split": "equiinterval",
                  "args": [
                    10
                  ],
                  "class": "Split",
                  "channel": "rgb"
                }
              }
            }
          ]
        }
      },
      {
        "position": {
          "top": 307.98612213134766,
          "left": 7.986114501953125
        },
        "size": {
          "width": "422px",
          "height": "372px"
        },
        "facets": {
          "aggregations": {
            "active": false,
            "possible": true
          },
          "data": {
            "active": true,
            "possible": true
          },
          "testData": {
            "active": false,
            "possible": true
          },
          "marginals": {
            "active": true,
            "possible": true
          },
          "contour": {
            "active": true,
            "possible": true
          }
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "mpg_spectrale_pred",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "Emb_dim2"
                ],
                "aggregation": "maximum",
                "yields": "Emb_dim2",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": [
                  "Emb_dim1"
                ],
                "aggregation": "maximum",
                "yields": "Emb_dim1",
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
          "top": 12.951393127441406,
          "left": 12.951385498046875
        },
        "size": {
          "width": "297px",
          "height": "288px"
        },
        "facets": {
          "aggregations": {
            "active": false,
            "possible": true
          },
          "data": {
            "active": true,
            "possible": true
          },
          "testData": {
            "active": false,
            "possible": true
          },
          "marginals": {
            "active": false,
            "possible": true
          },
          "contour": {
            "active": true,
            "possible": true
          }
        },
        "vismel": {
          "class": "vismel",
          "from": [
            {
              "name": "iris_tsne_pred",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": "Emb_dim2",
                "split": "equiinterval",
                "args": [
                  8
                ],
                "class": "Split"
              }
            ],
            "cols": [
              {
                "name": "Emb_dim1",
                "split": "equiinterval",
                "args": [
                  8
                ],
                "class": "Split"
              }
            ]
          },
          "layers": [
            {
              "class": "layer",
              "aesthetics": {
                "mark": "auto",
                "color": {
                  "name": "species",
                  "split": "elements",
                  "class": "Split",
                  "channel": "rgb"
                }
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