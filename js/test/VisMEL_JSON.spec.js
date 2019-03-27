/**
 * @author Philipp Lucas
 * @copyright © 2019 Philipp Lucas (philipp.lucas@dlr.de)
 *
 * TODO: implement these tests.
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
        });


        it('test forth and back conversion of a query', function (done) {
          function testConversion(context) {

            // get vismel query
            let vismel = context.query;
            console.log(`Current vismel query:\n ${vismel.toString()}`);

            // turn into JSON
            let vismelJson = vismel.toJSON(),
                vismelStr = jsonutils.stringify(vismelJson);
            expect(vismel.toString()).toEqual(vismelStr);

            // turn back into Vismel
            let vismel_re_promise = VisMEL.VisMEL.FromJSON(vismelStr);
            vismel_re_promise.then( vismel_re => {
              let vismel_re_str = jsonutils.stringify(vismel_re);
              expect(vismel_re_str).toEqual(vismelStr);
            });

        });

      });
    });
