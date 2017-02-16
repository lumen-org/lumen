/**
 * Test module for prototype.js
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module
 */

// TODO: fix the code below to be actual tests of some sort

define(['app/shelves', 'app/PQL'], function (sh, f) {
  "use strict";

  function testPQL(server) { // jshint ignore:line
    function printResult(res) {
      console.log(res);
      return res;
    }
    var mb = new Remote.ModelBase(server);
    var iris, pw, pl, sw, sl;
    mb.get('iris')
      .then( iris_ => {
        iris = iris_;
        pw = iris.fields.get("petal_width");
        pl = iris.fields.get("petal_length");
        sw = iris.fields.get("sepal_width");
        sl = iris.fields.get("sepal_length");
      })
      .then( () => mb.header('iris'))
      .then(printResult)
      .then( () => mb.get('iris'))
      .then(printResult)
      .then(iris => iris.copy("iris_copy"))
      .then(ic => ic.model(['sepal_length', 'petal_length', 'sepal_width']))
      .then(printResult)
      .then(ic => {
        iris = ic.model("*", [new PQL.Filter(sl, "equals", 5)]);
        return iris;
      })
      .then(printResult)
      .then(ic => ic.predict(
        ["petal_length", new PQL.Density(pl)],
        [],
        new PQL.Split(pl, "equidist", [5])))
      .then(printResult)
      .then( () => iris)
      .then(ic => ic.predict(
        [sw, pl, new PQL.Density(pl)],
        [],
        [new PQL.Split(pl, "equidist", [5]), new PQL.Split(sw, "equidist", [3])]))
      .then(printResult)
      .then( () => iris);
  }

  function testVisMEL(server) {
    //var c = context;
    var mb = new Remote.ModelBase(server);
    var query, iris, pw, pl, sw, sl;
    mb.get('iris')
      .then( iris_ => {
        iris = iris_;
        pw = iris.fields.get("petal_width");
        pl = iris.fields.get("petal_length");
        sw = iris.fields.get("sepal_width");
        sl = iris.fields.get("sepal_length");
      })
      .then( () => {
        let pw_aggr = new PQL.Aggregation([pw,sw], "maximum", "petal_width");
        let sw_aggr = new PQL.Aggregation([pw,sw], "maximum", "sepal_width");
        let pl_split = new PQL.Split(pl, "equidist", [20]);
        let sl_split = new PQL.Split(sl, "equidist", [20]);
        let plsl_density = new PQL.Density([pl,sl]);
        query = new VisMEL.VisMEL(iris);
        query.layout.rows = new TableAlgebraExpr([pw_aggr]);
        query.layout.cols = new TableAlgebraExpr([sw_aggr]);
        query.layers[0].aesthetics.details.push(sl_split);
        query.layers[0].aesthetics.details.push(pl_split);
        query.layers[0].aesthetics.color = new VisMEL.ColorMap(plsl_density, 'rgb');
        query.layers[0].aesthetics.size = new VisMEL.SizeMap(plsl_density);
        return query;
      })
      .then(query => {
        queryTable = new QueryTable(query);
        modelTable = new ModelTable(queryTable);
        return modelTable.model();
      })
      .then(() => {
        resultTable = new RT.AggrResultTable(modelTable, queryTable);
        return resultTable.fetch();
      })
      .then(() => {
        viewTable = new ViewTable(visPaneD3, resultTable, queryTable);
      });
  } // function testVisMEL

});
