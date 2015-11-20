/**
 * Test module for shelves.js
 *
 * @author Philipp Lucas
 * @module
 */

define(['app/shelves'], function (Sh) {
  "use strict";

  describe('A simple Spec', function () {

    var dimShelf = null;
    var measShelf = null;
    var colorShelf = null;
    //var filterShelf,
    //var shapeShelf;
    var rowShelf = null;
    var columnShelf = null;
    var dataSource = null;

    // setup
    beforeEach(function () {
      /// Shelves
      // create field shelves
      dimShelf = new Sh.DimensionShelf();
      measShelf = new Sh.MeasureShelf();

      // create field usage shelves
      colorShelf = new Sh.ColorShelf();
//filterShelf = new _.FilterShelf();
//shapeShelf = new _.ShapeShelf();
      rowShelf = new Sh.RowShelf();
      columnShelf = new Sh.ColumnShelf();

      dataSource = new Sh.DataSource('foo.csv', 'my source');
      var ageField = new Sh.Field(
        'age', dataSource, {
          dataType: Sh.FieldT.Type.num,
          role: Sh.FieldT.Role.measure,
          kind: Sh.FieldT.Kind.cont
        });
      var weightField = new Sh.Field(
        'weight', dataSource, {
          dataType: Sh.FieldT.Type.num,
          role: Sh.FieldT.Role.measure,
          kind: Sh.FieldT.Kind.cont
        });
      var sexField = new Sh.Field(
        'sex', dataSource, {
          dataType: Sh.FieldT.Type.num,
          role: Sh.FieldT.Role.dimension,
          kind: Sh.FieldT.Kind.discrete
        });
      var nameField = new Sh.Field(
        'name', dataSource, {
          dataType: Sh.FieldT.Type.string,
          role: Sh.FieldT.Role.dimension,
          kind: Sh.FieldT.Kind.discrete
        });
      dataSource.fields = {
        age: ageField,
        weight: weightField,
        sex: sexField,
        name: nameField
      };

/// view table definition
// => maps to layout shelves
      /*var layout = {
       fieldUsages: [], // need to generate the names
       rows : rowShelf.expression, // just like that?
       cols : colShelf.expression
       };*/

/// layers definition
      /*var layer = {
       sourceName: false,
       fieldUsages: {
       // associative array to map name to unique field usage
       },
       aesthetics: {
       mark: "auto",
       color: false,
       shape: false,
       size: false
       }
       };*/

      // populate field shelves
      dataSource.populate(dimShelf, measShelf);
    });

    //meas0: 'age'
    //meas1: 'weight'
    //dim0: 'sex'
    //dim1: 'name'

    it('tests DataSet.populate', function () {

      expect(measShelf.length()).toBe(2);
      expect(dimShelf.length()).toBe(2);
      dimShelf.records.forEach(function (record) {
        expect(record.content.role == Sh.FieldT.Role.dimension);
      });
      measShelf.records.forEach(function (record) {
        expect(record.content.role == Sh.FieldT.Role.measure);
      });
    });

   it('tests Shelf functions', function () {
      expect(colorShelf.empty()).toBe(true);

      colorShelf.append(dimShelf.at(0));
      expect(colorShelf.empty()).not.toBe(true);
      expect(colorShelf.at(0).content.name).toBe('sex');

      colorShelf.remove(0);
      expect(colorShelf.empty()).toBe(true);

      colorShelf.prepend(measShelf.at(1));
      expect(colorShelf.empty()).not.toBe(true);
      expect(colorShelf.at(0).content.name).toBe('weight');
      expect(colorShelf.contains(colorShelf.at(0))).toBe(true);

      expect(colorShelf.limit).toBe(1);
      colorShelf.replace(dimShelf.at(1));
      expect(colorShelf.at(0).content.name).toBe('name');
    });

    it('tests shelf functions (more)', function () {
      expect(rowShelf.empty()).toBe(true);

      rowShelf.append(dimShelf.at(0));
      expect(rowShelf.empty()).not.toBe(true);
      expect(rowShelf.at(0).content.name).toBe('sex');

      rowShelf.append(measShelf.at(0));
      expect(rowShelf.at(1).content.name).toBe('age');
      rowShelf.prepend(measShelf.at(1));
      expect(rowShelf.at(2).content.name).toBe('age');
      expect(rowShelf.at(1).content.name).toBe('sex');
      expect(rowShelf.at(0).content.name).toBe('weight');
      expect(rowShelf.contains(rowShelf.at(0))).toBe(true);
      expect(rowShelf.contains(rowShelf.at(1))).toBe(true);
      expect(rowShelf.contains(rowShelf.at(2))).toBe(true);
      expect(rowShelf.contains(null)).toBe(false);
      expect(rowShelf.contains({})).toBe(false);

      rowShelf.replace(rowShelf.at(1), dimShelf.at(1));
      expect(rowShelf.at(1).content.name).toBe('name');

      rowShelf.remove(rowShelf.at(1));
      expect(rowShelf.at(1).content.name).toBe('age');
      expect(rowShelf.at(0).content.name).toBe('weight');
      expect(rowShelf.length()).toBe(2);
    });
  });
});

