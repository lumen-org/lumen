/**
 * Test module for shelves.js
 *
 * @author Philipp Lucas
 * @module
 */

define(['app/shelves'], function (_) {
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
      /*var colorShelf = new ColorShelf();
       var dimShelf = new DimensionShelf();
       //var colorShelf = new Shelf(ColorRecord);


       var myField = new Field('age', 'dataSource');
       var myUsage = new FieldUsage(myField);

       //var myColorRecord = new ColorRecord(myField, colorShelf);
       colorShelf.append(myUsage);
       dimShelf.append(myField);
       dimShelf.prepend(new Field('sex', 'another data source'));

       debugger;

       colorShelf.record.remove();
       colorShelf.append(myUsage);
       colorShelf.record.replace(myField);

       debugger;

       /* ignore for now:
       * layers
       * multiple data sources
       */
      /// Shelves
      // create field shelves
      dimShelf = new _.DimensionShelf();
      measShelf = new _.MeasureShelf();

      // create field usage shelves
      colorShelf = new _.ColorShelf();
//filterShelf = new _.FilterShelf();
//shapeShelf = new _.ShapeShelf();
      rowShelf = new _.RowShelf();
      columnShelf = new _.ColumnShelf();

      dataSource = new _.DataSource('foo.csv', 'my source');
      var ageField = new _.Field(
        'age', dataSource, {
          dataType: _.FieldT.Type.num,
          role: _.FieldT.Role.measure,
          kind: _.FieldT.Kind.cont
        });
      var weightField = new _.Field(
        'weight', dataSource, {
          dataType: _.FieldT.Type.num,
          role: _.FieldT.Role.measure,
          kind: _.FieldT.Kind.cont
        });
      var sexField = new _.Field(
        'sex', dataSource, {
          dataType: _.FieldT.Type.num,
          role: _.FieldT.Role.dimension,
          kind: _.FieldT.Kind.discrete
        });
      var nameField = new _.Field(
        'name', dataSource, {
          dataType: _.FieldT.Type.string,
          role: _.FieldT.Role.dimension,
          kind: _.FieldT.Kind.discrete
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
        expect(record.content.role == _.FieldT.Role.dimension);
      });
      measShelf.records.forEach(function (record) {
        expect(record.content.role == _.FieldT.Role.measure);
      });

      colorShelf.append(dimShelf.records[0]);
      expect(colorShelf.record.content.name).toBe('sex');
    });

   it('tests asSingeltonShelf', function () {
      expect(colorShelf.empty()).toBe(true);

      colorShelf.append(dimShelf.records[0]);
      expect(colorShelf.empty()).not.toBe(true);
      expect(colorShelf.record.content.name).toBe('sex');

      colorShelf.remove();
      expect(colorShelf.empty()).toBe(true);

      colorShelf.prepend(measShelf.records[1]);
      expect(colorShelf.empty()).not.toBe(true);
      expect(colorShelf.record.content.name).toBe('weight');

      expect(colorShelf.contains(colorShelf.record)).toBe(true);

      colorShelf.replace(dimShelf.records[1]);
      expect(colorShelf.record.content.name).toBe('name');
    });

    it('tests asMultiShelf', function () {
      expect(rowShelf.empty()).toBe(true);

      rowShelf.append(dimShelf.records[0]);
      expect(rowShelf.empty()).not.toBe(true);
      expect(rowShelf.records[0].content.name).toBe('sex');

      rowShelf.append(measShelf.records[0]);
      expect(rowShelf.records[1].content.name).toBe('age');
      rowShelf.prepend(measShelf.records[1])
      expect(rowShelf.records[2].content.name).toBe('age');
      expect(rowShelf.records[1].content.name).toBe('sex');
      expect(rowShelf.records[0].content.name).toBe('weight');
      expect(rowShelf.contains(rowShelf.records[0])).toBe(true);
      expect(rowShelf.contains(rowShelf.records[1])).toBe(true);
      expect(rowShelf.contains(rowShelf.records[2])).toBe(true);
      expect(rowShelf.contains(null)).toBe(false);
      expect(rowShelf.contains({})).toBe(false);

      rowShelf.replace(rowShelf.records[1], dimShelf.records[1]);
      expect(rowShelf.records[1].content.name).toBe('name');

      rowShelf.remove(rowShelf.records[1]);
      expect(rowShelf.records[1].content.name).toBe('age');
      expect(rowShelf.records[0].content.name).toBe('weight');
      expect(rowShelf.length()).toBe(2);
    });
  });
});

