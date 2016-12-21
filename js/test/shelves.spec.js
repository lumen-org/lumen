/**
 * Test module for shelves.js
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module
 */

define(['app/shelves', 'app/PQL'], function (sh, f) {
  "use strict";
  // TODO: maybe adapt these tests for the current code base later again..
  /*  describe('Specifications for Shelves', function () {

    var shelf = {};
    var dataSource;

    // setup
    beforeEach(function () {

      // get some dummy model
      dataSource = dummyModel.generator.census();

      // constructs all shelves
      shelf = sh.construct();

      // populate field shelves from model
      sh.populate(dataSource, shelf.dim, shelf.meas);

    });

    it('tests DataSet.populate', function () {

      expect(shelf.meas.length).toBe(4);
      expect(shelf.dim.length).toBe(3);
      shelf.dim.records.forEach(function (record) {
        expect(record.content.role === f.FieldT.Role.dimension);
      });
      shelf.meas.records.forEach(function (record) {
        expect(record.content.role === f.FieldT.Role.measure);
      });
    });

   it('tests shelf functions (basic)', function () {
      expect(shelf.color.empty()).toBe(true);

      shelf.color.append(shelf.dim.at(0));
      expect(shelf.color.empty()).not.toBe(true);
      expect(shelf.color.at(0).content.name).toBe('sex');

      shelf.color.remove(0);
      expect(shelf.color.empty()).toBe(true);

      shelf.color.prepend(shelf.meas.at(1));
      expect(shelf.color.empty()).not.toBe(true);
      expect(shelf.color.at(0).content.name).toBe('weight');
      expect(shelf.color.contains(shelf.color.at(0))).toBe(true);

      expect(shelf.color.limit).toBe(1);
      shelf.color.replace(shelf.dim.at(1));
      expect(shelf.color.at(0).content.name).toBe('name');
    });

    it('tests shelf functions (more)', function () {
      expect(shelf.row.empty()).toBe(true);

      shelf.row.append(shelf.dim.at(0));
      expect(shelf.row.empty()).not.toBe(true);
      expect(shelf.row.at(0).content.name).toBe('sex');

      shelf.row.append(shelf.meas.at(0));
      expect(shelf.row.at(1).content.name).toBe('age');
      shelf.row.prepend(shelf.meas.at(1));
      expect(shelf.row.at(2).content.name).toBe('age');
      expect(shelf.row.at(1).content.name).toBe('sex');
      expect(shelf.row.at(0).content.name).toBe('weight');
      expect(shelf.row.contains(shelf.row.at(0))).toBe(true);
      expect(shelf.row.contains(shelf.row.at(1))).toBe(true);
      expect(shelf.row.contains(shelf.row.at(2))).toBe(true);
      expect(shelf.row.contains(null)).toBe(false);
      expect(shelf.row.contains({})).toBe(false);

      shelf.row.replace(shelf.row.at(1), shelf.dim.at(1));
      expect(shelf.row.at(1).content.name).toBe('name');

      shelf.row.remove(shelf.row.at(1));
      expect(shelf.row.at(1).content.name).toBe('age');
      expect(shelf.row.at(0).content.name).toBe('weight');
      expect(shelf.row.length).toBe(2);
    });

    it('tests shelf functions (even more)', function () {
      shelf.color.append(shelf.dim.at(0));
      expect(shelf.color.at(0).content.name).toBe('sex');

      // color can only hold 1 item, another item will not be added
      shelf.color.append(shelf.meas.at(0));
      expect(shelf.color.at(0).content.name).toBe('sex');

      // however, it can be replaced
      shelf.color.replace(shelf.meas.at(0));
      expect(shelf.color.at(0).content.name).toBe('age');

      // also using this syntax
      shelf.color.replace(0, shelf.dim.at(0));
      expect(shelf.color.at(0).content.name).toBe('sex');
    });
  });*/
});

