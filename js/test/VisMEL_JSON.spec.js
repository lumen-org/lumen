/**
 * @author Philipp Lucas
 * @copyright © 2019 Philipp Lucas (philipp.lucas@dlr.de)
 */
define( ['app/PQL', 'app/VisMEL', 'app/RemoteModelling'],
    function (PQL, VisMEL, Remote ) {
      "use strict";

      describe('VisMEL specifications', function () {

        // var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
        // var promise;
        // var iris, pw, pl, sw, sl; // model and its fields
        // var query, queryTable, modelTable, resultTable, viewTable; // query and stages of query execution pipeline
        // var paneD3; // dummy svg element to draw viewTable on

        // setup
        beforeEach(function () {
          // mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
          // promise = mb.get('iris')
          //     .then( iris_ => {
          //       iris = iris_;
          //       pw = iris.fields.get("petal_width");
          //       pl = iris.fields.get("petal_length");
          //       sw = iris.fields.get("sepal_width");
          //       sl = iris.fields.get("sepal_length");
          //     });
          // paneD3 = d3.selection()
          //     .append("svg")
          //     .attr({
          //       width: 400,
          //       height: 400
          //     });
        });

        it('constructs and runs a VisMEL query 01', function (done) {
          it('tests Model.density', function () {
            expect(true).toEqual(true);
          });
        });

      });
    });
