/**
 * Tests if a model fulfils generic requirements to its API.
 *
 *  * returns the correct type
 *  * marginalization
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module
 */

define(['app/Model'], function (Model) {
  "use strict";

  // TODO: maybe adapt these tests for the current code base later again... this should also just test basic functions of the Model class
/*  describe('Tests for generic functions of Model', function () {
    var model1;
    var modelEmpty;

    beforeEach( function () {
      model1 = DummyModel.generator.census();
      modelEmpty = DummyModel.generator.empty();
    });

    it('tests the size and name of the models', function () {
      expect(model1.size()).toBe(7);
      expect(model1.name).toBe('census');
      expect(modelEmpty.size()).toBe(0);
      expect(modelEmpty.name).toBe('empty');
    });

    it('tests all the ways of specifying a field of a model', function () {
      expect(model1.isIndex(0)).toBe(true);
      expect(model1.isIndex(6)).toBe(true);
      expect(model1.isIndex(7)).toBe(false);
      expect(model1.isIndex(-5)).toBe(false);
      expect(model1.isIndex(Number.MAX_VALUE)).toBe(false);
      expect(model1.isIndex(undefined)).toBe(false);
      expect(model1.isIndex("a string")).toBe(false);

      // model1 has the expected names by construction...
      expect(model1.isName('sex')).toBe(true);
      expect(model1.isName('age')).toBe(true);
      expect(model1.isName('Age')).toBe(false);
      expect(model1.isName(' age')).toBe(false);
      expect(model1.isName('not there')).toBe(false);
      expect(model1.isName('')).toBe(false);
      expect(model1.isName(1)).toBe(false);

      expect(model1.isField('age')).toBe(false);
      expect(model1.isField(0)).toBe(false);
      expect(model1.isField(undefined)).toBe(false);
      expect(model1.isField(model1.fields[0])).toBe(true);
      expect(model1.isField(model1.fields[model1.size()-1])).toBe(true);
    });

    it('tests all the ways of converting field specifications into one another', function () {
      expect(model1.asIndex(0)).toBe(0);
      expect(model1.asIndex(model1.fields[6])).toBe(6);
      expect(model1.asIndex(model1.fields[1].name)).toBe(1);
      expect(function(){model1.asIndex(-1);}).toThrow();
      expect(function(){model1.asIndex("not a field");}).toThrow();
      expect(function(){model1.asIndex(undefined);}).toThrow();
      expect(function(){model1.asIndex(100);}).toThrow();
    });

    it('tests the copying of a model', function () {
      var copy1 = model1.copy();
      var copy2 = model1.copy('another name');
      expect(copy1.name).toBe(model1.name);
      expect(copy2.name).toBe('another name');
    });

    it('tests the dimensions() function', function () {
      expect(modelEmpty.dimensions().length).toBe(0);
      var dims = model1.dimensions();
      expect(dims.length).toBe(3);
      expect(dims.some(function(field) {return field.name === 'sex';})).toBe(true);
      expect(dims.some(function(field) {return field.name === 'name';})).toBe(true);
      expect(dims.some(function(field) {return field.name === 'city';})).toBe(true);
      expect(dims.some(function(field) {return field.name === 'sx';})).toBe(false);
    });

  });

  describe('Tests for each subclass of functions of Model', function () {
    var myModels = [];

    beforeEach( function () {
      myModels = {
        census: DummyModel.generator.census(),
        empty: DummyModel.generator.empty()
      };
    });

    function testMarginalizeField (model, idxArray) {
      var field = model.fields[idx];
      var size =  model.size();
      idxArray.forEach( function(idx) {
        if (model.isIndex(idx)) {
          model.marginalize(idx);
          expect(model.size()).toBe(size - 1);
          expect(model.fields.some(function (f) {
            return f.name === field.name;
          })).not.toBe(true);
        } else {
          expect(function () {
            model.marginalize(idx);
          }).toThrow();
        }
      });
    }

    for (var model in myModels) {
      if (model.isPrototypeOf(myModels))
        it('tests Model.marginalize', function() {
          testMarginalizeField(model, [0]);
          testMarginalizeField(model, [3]);
          testMarginalizeField(model, [6]);
          testMarginalizeField(model, [-3]);
          testMarginalizeField(model, [Number.MAX_VALUE]);
          testMarginalizeField(model, [0,3,6,-3,Number.MAX_VALUE]);
        }); // jshint ignore:line
    }

    it('tests Model.density', function () {
      expect(myModels.census.density([1,2,3,4,5,6,7])).toEqual(jasmine.any(Number));
      expect(myModels.census.density([1,2,3,4,5,6,7,8])).toEqual(jasmine.any(Number)); // allow too many arguments
      expect(function(){myModels.census.density([1,2,3,4,5]);}).toThrow();
      expect(function(){myModels.census.density();}).toThrow();
    });

    it('tests Model.condition', function () {
      //todo
    });
  });*/
});