define( ['app/RemoteModelling', 'app/PQL'], function (Remote, PQL) {
  "use strict";

  function printResult(res) {
    console.log(res);
    return res;
  }

  describe('PQL specifications', function () {

    var mb,iris;
    var pw, pl, sw, sl;
    var promise;

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
    });

    it('runs some PQL queries', function (done) {
      promise
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
          new PQL.Split(pl, "equiDist", [5])))
        .then(printResult)
        .then( () => iris)
        .then(ic => ic.predict(
          [sw, pl, new PQL.Density(pl)],
          [],
          [new PQL.Split(pl, "equiDist", [5]), new PQL.Split(sw, "equiDist", [3])]))
        .then(printResult)
        .then( () => done() )
        .catch( err => {
          console.error(err);
          fail(err);
          done();
        });
    });

  });

});