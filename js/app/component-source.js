/**
 * @author Philipp Lucas
 *
 * JavaScript code for this the source component of the UI of the EMV tool.
 */
define(['d3', 'app/shelves', 'app/visuals', 'app/interaction'], function (d3, sh, vis, inter) {
  'use strict';

  // setup code here
  Logger.useDefaults();

 // var foobar = util.selectValue(1,0);

  /**
   * Get current PQL expression
   * @constructor
   */
  function PQL () {

  }

  function myScript () {
    var dimShelf =  new sh.DimensionShelf();
    var measShelf = new sh.MeasureShelf();
    var detailShelf = new sh.DetailShelf();
    var colorShelf = new sh.ColorShelf();
    var filterShelf = new sh.FilterShelf();
    var shapeShelf = new sh.ShapeShelf();
    var sizeShelf = new sh.SizeShelf();
    var rowShelf = new sh.RowShelf();
    var columnShelf = new sh.ColumnShelf();
    var removeShelf = new sh.RemoveShelf();

    var dataSource = new sh.DataSource('foo.csv', 'my source');
    var ageField = new sh.Field(
      'age', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.measure,
        kind: sh.FieldT.Kind.cont
      });
    var weightField = new sh.Field(
      'weight', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.measure,
        kind: sh.FieldT.Kind.cont
      });
    var incomeField = new sh.Field(
      'income', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.measure,
        kind: sh.FieldT.Kind.cont
      });
    var childrenField = new sh.Field(
      'children', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.measure,
        kind: sh.FieldT.Kind.discrete
      });
    var weightField = new sh.Field(
      'weight', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.measure,
        kind: sh.FieldT.Kind.cont
      });
    var sexField = new sh.Field(
      'sex', dataSource, {
        dataType: sh.FieldT.Type.num,
        role: sh.FieldT.Role.dimension,
        kind: sh.FieldT.Kind.discrete
      });
    var nameField = new sh.Field(
      'name', dataSource, {
        dataType: sh.FieldT.Type.string,
        role: sh.FieldT.Role.dimension,
        kind: sh.FieldT.Kind.discrete
      });
    var cityField = new sh.Field(
      'city', dataSource, {
        dataType: sh.FieldT.Type.string,
        role: sh.FieldT.Role.dimension,
        kind: sh.FieldT.Kind.discrete
      });
    dataSource.fields = {
      age: ageField,
      weight: weightField,
      income: incomeField,
      children: childrenField,
      sex: sexField,
      name: nameField,
      city: cityField
    };
    dataSource.populate(dimShelf, measShelf);

    measShelf.beVisual({label: 'Measures'}).beInteractable();
    dimShelf.beVisual({label: 'Dimensions'}).beInteractable();
    detailShelf.beVisual({label: 'Details'}).beInteractable();
    colorShelf.beVisual({label: 'Color'}).beInteractable();
    filterShelf.beVisual({label: 'Filter', direction: vis.DirectionTypeT.box}).beInteractable();
    shapeShelf.beVisual({label: 'Shape'}).beInteractable();
    sizeShelf.beVisual({label: 'Size'}).beInteractable();
    removeShelf.beVisual({label: 'Drag here to remove'}).beInteractable();
    rowShelf.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal}).beInteractable();
    columnShelf.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal}).beInteractable();

    var base = $('#testRow');
    base.append(measShelf.$visual);
    base.append(dimShelf.$visual);
    base.append(filterShelf.$visual);
    base.append(detailShelf.$visual);
    base.append(colorShelf.$visual);
    base.append(shapeShelf.$visual);
    base.append(sizeShelf.$visual);
    base.append(removeShelf.$visual);
    base.append(rowShelf.$visual);
    base.append(columnShelf.$visual);

    inter.onDrop[sh.ShelfTypeT.color](colorShelf, measShelf.at(3));
    inter.onDrop[sh.ShelfTypeT.filter](filterShelf, dimShelf.at(2));
    inter.onDrop[sh.ShelfTypeT.detail](detailShelf, dimShelf.at(1));
    inter.onDrop[sh.ShelfTypeT.shape](shapeShelf, dimShelf.at(0));
    inter.onDrop[sh.ShelfTypeT.size](sizeShelf, measShelf.at(2));

    inter.onDrop[sh.ShelfTypeT.row](rowShelf, dimShelf.at(0));
    inter.onDrop[sh.ShelfTypeT.row](rowShelf, measShelf.at(0));
    inter.onDrop[sh.ShelfTypeT.column](columnShelf, dimShelf.at(1));
    inter.onDrop[sh.ShelfTypeT.column](columnShelf, measShelf.at(1));

    var pqlString = function () {
      return 'SELECT AS auto \n' +
        '\t' + colorShelf.toPQLString() +
        '\t' + detailShelf.toPQLString() +
        '\t' + shapeShelf.toPQLString() +
        '\t' + rowShelf.toPQLString() +
        '\t' + columnShelf.toPQLString() +
        '\nFROM\n\tmyDataSource\n' +
        filterShelf.toPQLString();
    };
    debugger;


    //'SELECT AS SHAPE' +
    //(!colorShelf.empty() ? colorShelf.at(0).content.name  + ' ON COLOR': '') +
    //(!filterShelf.empty() ? filterShelf)

  }

  return {
    /**
     * Starts the application.
     */
    start: function () {
      myScript();
    }
  };

});
