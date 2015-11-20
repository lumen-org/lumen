/**
 * Main component that assembles and manages the actual GUI of the EMV tool.
 * @module main
 * @author Philipp Lucas
 */
define(['d3', 'app/shelves', 'app/visuals', 'app/interaction', 'app/VisMEL', 'lib/emitter'],
  function (d3, sh, vis, inter, VisMEL, e) {
    'use strict';
    Logger.useDefaults();

  // define shelves
  var shelf = {
    dim :  new sh.DimensionShelf(),
    meas : new sh.MeasureShelf(),
    detail : new sh.DetailShelf(),
    color : new sh.ColorShelf(),
    filter : new sh.FilterShelf(),
    shape : new sh.ShapeShelf(),
    size : new sh.SizeShelf(),
    row : new sh.RowShelf(),
    column : new sh.ColumnShelf(),
    remove : new sh.RemoveShelf()
  };  

  // define 'dummy' datasource
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
      kind: sh.FieldT.Kind.discrete,
      // todo: future feature: domain: {min: 0, max: 6}
      domain: [0, 1, 2, 3, 4, 5, 6]
    });
  var sexField = new sh.Field(
    'sex', dataSource, {
      dataType: sh.FieldT.Type.num,
      role: sh.FieldT.Role.dimension,
      kind: sh.FieldT.Kind.discrete,
      domain: [0, 1]
    });
  var nameField = new sh.Field(
    'name', dataSource, {
      dataType: sh.FieldT.Type.string,
      role: sh.FieldT.Role.dimension,
      kind: sh.FieldT.Kind.discrete,
      domain: ['John', 'Philipp', 'Maggie']
    });
  var cityField = new sh.Field(
    'city', dataSource, {
      dataType: sh.FieldT.Type.string,
      role: sh.FieldT.Role.dimension,
      kind: sh.FieldT.Kind.discrete,
      domain: ['Jena', 'Weimar', 'Berlin']
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

  // populate shelves with data source
  dataSource.populate(shelf.dim, shelf.meas);

  // make all shelves visual and interactable
  shelf.meas.beVisual({label: 'Measures'}).beInteractable();
  shelf.dim.beVisual({label: 'Dimensions'}).beInteractable();
  shelf.detail.beVisual({label: 'Details'}).beInteractable();
  shelf.color.beVisual({label: 'Color', direction: vis.DirectionTypeT.horizontal}).beInteractable();
  shelf.filter.beVisual({label: 'Filter', direction: vis.DirectionTypeT.box}).beInteractable();
  shelf.shape.beVisual({label: 'Shape', direction: vis.DirectionTypeT.horizontal}).beInteractable();
  shelf.size.beVisual({label: 'Size', direction: vis.DirectionTypeT.horizontal}).beInteractable();
  shelf.remove.beVisual({label: 'Drag here to remove'}).beInteractable();
  shelf.row.beVisual({label: 'Row', direction: vis.DirectionTypeT.horizontal}).beInteractable();
  shelf.column.beVisual({label: 'Column', direction: vis.DirectionTypeT.horizontal}).beInteractable();

  // add all shelves to the DOM
  var base = $('#shelves');
  base.append(shelf.meas.$visual);
  base.append(shelf.dim.$visual);
  base.append(shelf.filter.$visual);
  base.append(shelf.detail.$visual);
  base.append(shelf.color.$visual);
  base.append(shelf.shape.$visual);
  base.append(shelf.size.$visual);
  base.append(shelf.remove.$visual);
  var layout = $('#layout');
  layout.append(shelf.row.$visual);
  layout.append(shelf.column.$visual);

  // do some dummy drag and drops
  inter.onDrop[sh.ShelfTypeT.color](shelf.color, shelf.meas.at(3));
  inter.onDrop[sh.ShelfTypeT.filter](shelf.filter, shelf.dim.at(2));
  inter.onDrop[sh.ShelfTypeT.detail](shelf.detail, shelf.dim.at(1));
  inter.onDrop[sh.ShelfTypeT.shape](shelf.shape, shelf.dim.at(0));
  inter.onDrop[sh.ShelfTypeT.size](shelf.size, shelf.meas.at(2));

  inter.onDrop[sh.ShelfTypeT.row](shelf.row, shelf.dim.at(0));
  inter.onDrop[sh.ShelfTypeT.row](shelf.row, shelf.meas.at(0));
  inter.onDrop[sh.ShelfTypeT.column](shelf.column, shelf.dim.at(1));
  inter.onDrop[sh.ShelfTypeT.column](shelf.column, shelf.meas.at(1));

  inter.asRemoveElem($(document.body).find('main'));



  function pqlString () {
    return 'SELECT AS auto \n' +
      (shelf.color.toPQLString() ? '\t' + shelf.color.toPQLString() : '') +
      (shelf.detail.toPQLString()? '\t' + shelf.detail.toPQLString() : '') +
      (shelf.shape.toPQLString() ? '\t' + shelf.shape.toPQLString() : '') +
      (shelf.size.toPQLString() ? '\t' + shelf.size.toPQLString() : '') +
      (shelf.column.toPQLString()? '\t' + shelf.column.toPQLString() : '') +
      (shelf.row.toPQLString()? '\t' + shelf.row.toPQLString() : '') +
      'FROM\n\tmyDataSource\n' +
      shelf.filter.toPQLString();
  }

  function printPQLString () {
    $('#pqlTextBox').text(pqlString());
  }

  // listen for GUI changes and trigger extraction of VisMEL queries
  for (var key in shelf) { if (!shelf.hasOwnProperty(key)) continue;
    // todo: fix it: it triggers multiple times for most/all drag&drop operations
    shelf[key].on(sh.Shelf.ChangedEvent, printPQLString);
  }

  // trigger intial PQL writeout
  printPQLString();
  var myQuery = new VisMEL(shelf, dataSource);

  function myScript () {

   /* var dataX = [1,2,3,4,5,6,7,2];
    var dataY = [4,5,1,6,7,1,2,3];

    var d3box = d3.select('#d3box');

    var xScale = d3.scale.linear()
      .domain([0, d3.max(dataX)])
      //.range([0, parseInt(d3box.style("width"),10)]);
      .range([0, 100]);

    var yScale = d3.scale.linear()
      .domain([0, d3.max(dataY)])
      .range([0, 100]);

    //debugger;

    d3box.selectAll('g')
      .data(dataX)
      .enter().append('div')
      .classed("d3bar", true)
      .style("height", "20px")
      .style("width", function(d) {return xScale(d)+"%";})
      .text( function(d){return d;});
    //debugger;
    */
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