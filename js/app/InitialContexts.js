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
          "top": 83,
          "left": 431
        },
        "size": {
          "width": "500px",
          "height": "500px"
        },
        "facets": {
          "aggregations": {
            "active": false,
            "possible": true
          },
          "data": {
            "active": false,
            "possible": true
          },
          "testData": {
            "active": true,
            "possible": true
          },
          "marginals": {
            "active": true,
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
              "name": "emp_titanic",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "Fare"
                ],
                "aggregation": "maximum",
                "yields": "Fare",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": [
                  "Age"
                ],
                "aggregation": "maximum",
                "yields": "Age",
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
                  "name": "Pclass",
                  "split": "elements",
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
          "top": 394,
          "left": 61
        },
        "size": {
          "width": "500px",
          "height": "500px"
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
                "name": [
                  "sepal_width"
                ],
                "aggregation": "maximum",
                "yields": "sepal_width",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": [
                  "petal_width"
                ],
                "aggregation": "maximum",
                "yields": "petal_width",
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

  //json.push(initial);

  let initial2 = {
    "class": "ContextCollection",
    "contexts": [
      {
        "position": {
          "top": 14.98046875,
          "left": 590.78125
        },
        "size": {
          "width": "404px",
          "height": "389px"
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
              "name": "mcg_iris_map",
              "url": "https://modelvalidation.mooo.com:8080/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "petal_length"
                ],
                "aggregation": "maximum",
                "yields": "petal_length",
                "class": "Aggregation"
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
      },
      {
        "position": {
          "top": 536.85546875,
          "left": 653.84765625
        },
        "size": {
          "width": "500px",
          "height": "500px"
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
            "active": true,
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
              "name": "mcg_allbus_map",
              "url": "https://modelvalidation.mooo.com:8080/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "income"
                ],
                "aggregation": "maximum",
                "yields": "income",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": "age",
                "split": "equiinterval",
                "args": [
                  5
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
                  "name": "sex",
                  "split": "elements",
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
          "top": 534.82421875,
          "left": 51.89453125
        },
        "size": {
          "width": "500px",
          "height": "500px"
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
            "active": true,
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
              "name": "emp_allbus",
              "url": "https://modelvalidation.mooo.com:8080/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "income"
                ],
                "aggregation": "maximum",
                "yields": "income",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": "age",
                "split": "equiinterval",
                "args": [
                  5
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
                  "name": "sex",
                  "split": "elements",
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
          "top": 7.9296875,
          "left": 1020.87890625
        },
        "size": {
          "width": "435px",
          "height": "399px"
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
              "name": "spflow_iris",
              "url": "https://modelvalidation.mooo.com:8080/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "petal_length"
                ],
                "aggregation": "maximum",
                "yields": "petal_length",
                "class": "Aggregation"
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
  json.push(initial2);

  let initial3 = {
    "class": "ContextCollection",
    "contexts": [
      {
        "position": {
          "top": 14.98046875,
          "left": 590.78125
        },
        "size": {
          "width": "404px",
          "height": "389px"
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
              "name": "mcg_iris_map",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "petal_length"
                ],
                "aggregation": "maximum",
                "yields": "petal_length",
                "class": "Aggregation"
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
      },
      {
        "position": {
          "top": 536.85546875,
          "left": 653.84765625
        },
        "size": {
          "width": "500px",
          "height": "500px"
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
            "active": true,
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
              "name": "mcg_allbus_map",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "income"
                ],
                "aggregation": "maximum",
                "yields": "income",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": "age",
                "split": "equiinterval",
                "args": [
                  5
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
                  "name": "sex",
                  "split": "elements",
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
          "top": 534.82421875,
          "left": 51.89453125
        },
        "size": {
          "width": "500px",
          "height": "500px"
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
            "active": true,
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
              "name": "emp_allbus",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "income"
                ],
                "aggregation": "maximum",
                "yields": "income",
                "class": "Aggregation"
              }
            ],
            "cols": [
              {
                "name": "age",
                "split": "equiinterval",
                "args": [
                  5
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
                  "name": "sex",
                  "split": "elements",
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
          "top": 7.9296875,
          "left": 1020.87890625
        },
        "size": {
          "width": "435px",
          "height": "399px"
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
              "name": "spflow_iris",
              "url": "http://127.0.0.1:52104/webservice",
              "class": "model"
            }
          ],
          "layout": {
            "class": "layout",
            "rows": [
              {
                "name": [
                  "petal_length"
                ],
                "aggregation": "maximum",
                "yields": "petal_length",
                "class": "Aggregation"
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
  //json.push(initial3);

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