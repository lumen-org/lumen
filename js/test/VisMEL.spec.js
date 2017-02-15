/**
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define( ['d3', 'app/PQL', 'app/VisMEL', 'app/TableAlgebra', 'app/QueryTable', 'app/ModelTable', 'app/ResultTable', 'app/ViewTable', 'app/RemoteModelling'],
  function (d3, PQL, VisMEL, TableAlgebraExpr, QueryTable, ModelTable, RT, ViewTable, Remote ) {
  "use strict";

  describe('VisMEL specifications', function () {

    var mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
    var promise;
    var iris, pw, pl, sw, sl; // model and its fields
    var query, queryTable, modelTable, resultTable, viewTable; // query and stages of query execution pipeline
    var paneD3; // dummy svg element to draw viewTable on

    // setup
    beforeEach(function () {
      mb = new Remote.ModelBase("http://127.0.0.1:5000/webservice");
      promise = mb.get('iris')
        .then( iris_ => {
          iris = iris_;
          pw = iris.fields.get("petal_width");
          pl = iris.fields.get("petal_length");
          sw = iris.fields.get("sepal_width");
          sl = iris.fields.get("sepal_length");
        });
      paneD3 = d3.selection()
        .append("svg")
        .attr({
          width: 400,
          height: 400
        });
    });

    function excuteQuery( query ) {
        queryTable = new QueryTable(query);
        console.log(queryTable);
        modelTable = new ModelTable(queryTable);
        return modelTable.model()
          .then(() => {
            console.log(modelTable);
            resultTable = new RT.AggrResultTable(modelTable, queryTable);
            return resultTable.fetch();
          })
          .then(() => {
            console.log(resultTable);
            viewTable = new ViewTable(paneD3, resultTable, queryTable);
          });
    }

    it('constructs and runs a VisMEL query 01. Only checks that now uncaught exceptions are raised.', function (done) {
      promise.then( () => {
        let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
        let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
        let pl_split = new PQL.Split(pl, "equidist", [3]);
        let sl_split = new PQL.Split(sl, "equidist", [3]);
        let plsl_density = new PQL.Density([pl,sl]);
        query = new VisMEL.VisMEL(iris);
        query.layout.rows = new TableAlgebraExpr([pw_aggr]);
        query.layout.cols = new TableAlgebraExpr([sw_aggr]);
        query.layers[0].aesthetics.details.push(sl_split);
        query.layers[0].aesthetics.details.push(pl_split);
        query.layers[0].aesthetics.color = new VisMEL.ColorMap(plsl_density, 'rgb');
        query.layers[0].aesthetics.size = new VisMEL.SizeMap(plsl_density);
        return query;
      }).then( (query) => excuteQuery(query))
        .then( () => done() )
        .catch( err => {
          console.error(err);
          fail(err);
          done();
        });
    });

    /*it('constructes and runs a VisMEL query 01', function (done) {
      promise

        .then( () => done )
        .catch( err => {
          console.error(err);
          fail(err);
          done();
        });
    }); */

    function testVisMEL() {
        // TODO: here is more prepared VisMEL queries for testing...
        /*
         .then( () => {
         let pw_split = new PQL.Split(pw, "equidist", [4]);
         let sw_split = new PQL.Split(sw, "equidist", [4]);
         let pw_density = new PQL.Density([pw,sw]);
         query = new VisMEL.VisMEL(undefined, iris);
         query.layout.rows = new TableAlgebraExpr([sw_split]);
         query.layout.cols = new TableAlgebraExpr([pw_split]);
         query.layers[0].aesthetics.color = new VisMEL.ColorMap(pw_density, 'rgb');
         return query;
         }) //*/


         //*/

        /*
         .then( () => {
         let pw_split = new PQL.Split(pw, "equidist", [4]);
         let sw_split = new PQL.Split(sw, "equidist", [4]);
         let pl_split = new PQL.Split(pl, "equidist", [5]);
         let sl_split = new PQL.Split(sl, "equidist", [4]);
         let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
         let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
         query = new VisMEL.VisMEL(undefined, iris);
         query.layout.rows = new TableAlgebraExpr([pw_aggr]);
         query.layout.cols = new TableAlgebraExpr([sw_aggr]);
         query.layers[0].aesthetics.details.push(sl_split);
         query.layers[0].aesthetics.details.push(pl_split);
         return query;
         }) //*/
        /*
         .then( () => {
         let pw_split = new PQL.Split(iris.fields["petal_width"], "equidist", [20]);
         let pw_aggr = new PQL.Aggregation(iris.fields["petal_width"], "maximum", "petal_width");
         let pw_density = new PQL.Density(iris.fields["petal_width"]);
         query = new VisMEL.VisMEL(undefined, iris);
         query.layout.rows = new TableAlgebraExpr([pw_density]);
         query.layout.cols = new TableAlgebraExpr([pw_split]);
         return query;
         })//*/

        /*        .then( () => {
         let sw_split = new PQL.Split(iris.fields["sepal_width"], "equidist", [5]);
         let pl_split = new PQL.Split(iris.fields["petal_length"], "equidist", [10]);
         let pl_density = new PQL.Density(iris.fields["petal_length"]);
         let pw_aggr = new PQL.Aggregation(iris.fields["petal_width"], "maximum", "petal_width");
         let sw_aggr = new PQL.Aggregation(iris.fields["sepal_width"], "maximum", "sepal_width");

         query = new VisMEL.VisMEL(undefined, iris);
         query.layout.rows = new TableAlgebraExpr([sw_aggr]);
         //query.layout.cols = new TableAlgebraExpr([pl_density, pw_aggr]);
         query.layout.cols = new TableAlgebraExpr([pw_aggr]);

         query.layers[0].aesthetics.color = new VisMEL.ColorMap(pw_aggr, 'rgb');
         query.layers[0].aesthetics.size = new VisMEL.SizeMap(sw_split);
         //query.layers[0].aesthetics.shape = new VisMEL.ShapeMap(sw_split);
         query.layers[0].aesthetics.details.push(sw_split);
         //query.layers[0].aesthetics.details.push(pl_split);
         return query;
         })//*/

    } // function testVisMEL

  });

});