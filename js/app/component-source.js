/**
 * @author Philipp Lucas
 *
 * JavaScript code for this the source component of the UI of the EMV tool.
 */
define(['d3', 'app/shelves', 'app/visuals', 'app/interaction', 'app/utils'],
  function (d3, sh, vis, inter, util) {
  'use strict';

  // setup code here
  Logger.useDefaults();

 // var foobar = util.selectValue(1,0);

  function myScript () {
    var dimShelf =  new sh.DimensionShelf();
    var measShelf = new sh.MeasureShelf();
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
    dataSource.fields = {
      age: ageField,
      weight: weightField,
      sex: sexField,
      name: nameField
    };
    dataSource.populate(dimShelf, measShelf);

    measShelf.beVisual({label: 'Measures'}).beInteractable();
    dimShelf.beVisual({label: 'Dimensions'}).beInteractable();

    var base = $('#testRow');
    base.append(measShelf.$visual);
    base.append(dimShelf.$visual);
//    debugger;
  }

  // definitions of modules functions here
  return {

    /**
     * Start the application.
     */
    start: function () {

      /**
       * namespace build: Methods for building up the DOM with Shelves and Shelf elements
       *
      var build = (function() {

        var build = {};
        var logger = Logger.get('pl-build');

        /**
         * Adds a shelf as a <ul> to each element of the passed selection.
         * @param selection The selection
         * @param typeString The type of the shelf.
         * @param opt = {id, label, direction}
         * Where:
         *   - id is the string that will used as ID for the added shelf-<div> element.
         *   - label is the label of the shelf
         *   - direction = ['horizontal'|'vertical']
         *
         * @returns the added shelf.
         *
        build.addShelf = function (selection, typeString, opt) {

          if (!opt) opt = {};
          if (!opt.direction) opt.direction = build.DirectionType.vertical;
          if (!opt.label) opt.label = typeString;

          // create shelf container
          var shelf = $('<div></div>')
            .addClass('shelf');

          if (opt.id) {
            shelf.attr('id', opt.id);
          }

          // create label
          var htmlElem = build.DirectionElement[opt.direction];
          $(htmlElem)
            .addClass('shelf-title')
            .text(opt.label)
            .appendTo(shelf);

          // create element container
          $(htmlElem).addClass('shelf-list')
            .appendTo(shelf);

          // attach type and direction
          shelf.data(build.ShelfTypeString, typeString);
          shelf.data(build.DirectionString, opt.direction);

          // add drag&drop
          makeShelfDroppable(shelf);

          // append!
          shelf.appendTo(selection);

          return shelf;
        };*/


        /**
         * @param labelString The label of the new item.
         * @param shelf The shelf the item is for. It will not be added to the shelf.
         * @returns {*|jQuery}
         *
        build.createShelfItem = function (labelString, shelf) {
          var item = $(build.DirectionElement[shelf.data(build.DirectionString)]);
          item.addClass('shelf-list-item')
            .text(labelString);
          makeItemDraggable(item);
          makeItemDroppable(item);
          return item;
        };*/

        /**
         * Adds an item to the shelf passed as selection.
         * @param shelf
         * @param itemString
         * @returns the added item.
         *
        build.addShelfItem = function (shelf, itemString) {
          var item = build.createShelfItem(itemString, shelf);
          var itemContainer = shelf.children('.shelf-list');
          item.appendTo(itemContainer);
          return item;
        };*/

        /*return build;
      })();*/

       /**
       * Callback functions for dropping
       *
      var onDrop = (function() {

        var logger = Logger.get('pl-onDrop');
        //logger.setLevel(Logger.WARN);

        var onDrop = {};

        // this is going to be a class one day :-)
      /*  var Item = {};
        Item.remove = function(item){
            item.remove();
        };
        Item.append = function(source, targetItem, targetShelf){
          var newItem = build.createShelfItem(source.text(), targetShelf);
          targetItem.after(newItem);
        };
        Item.prepend = function(source, targetItem, targetShelf){
          var newItem = build.createShelfItem(source.text(), targetShelf);
          targetItem.before(newItem);
        };
        Item.replaceBy = function(source, targetItem, targetShelf){
          var newItem = build.createShelfItem(source.text(), targetShelf);
          targetItem.replaceWith(newItem);
        };

        var Shelf = {
          append : function (shelf, item){
            var newItem = build.createShelfItem(item.text(), shelf);
            shelf.children('.shelf-list').append(newItem);
          },
          prepend : function (shelf, item){
            var newItem = build.createShelfItem(item.text(), shelf);
            shelf.children('.shelf-list').prepend(newItem);
          },
          clear : function(shelf) {
            shelf.find('.shelf-list-item').remove();
            // todo: use Item.remove instead?
          }
        };


        return onDrop;

      })();*/

     /* /// build up initial DIMENSION and MEASURE shelves and add some elements
      var sourceColumn = $('#sourceColumn');

      var dimShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.field,
        { id: 'dimension-shelf',
          label: 'Dimensions'}
      );
      build.addShelfItem(dimShelf, 'Name');
      build.addShelfItem(dimShelf, 'Home City');

      var measureShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.field,
        { id: 'measure-shelf',
          label: 'Measures'}
      );
      build.addShelfItem(measureShelf, 'Weight');
      build.addShelfItem(measureShelf, 'Height');

      var removeShelf = build.addShelf(
        sourceColumn,
        build.ShelfType.remove,
        { id: 'remove-shelf',
          label: 'Drop here to remove' }
      );

      /// build up initial AESTHETICS shelves and add elements
      var aestheticsColumn = $('#aestheticsColumn');

      var colorShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.color,
        { id: 'color-shelf',
          label: 'Color'}
      );
      build.addShelfItem(colorShelf, 'CurrentColor');

      var shapeShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.shape,
        { id: 'shape-shelf',
          label: 'Shape'}
      );
      build.addShelfItem(shapeShelf, 'CurrentShape');

      var filterShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.filter,
        { id: 'filter-shelf',
          label: 'Filter'}
      );
      build.addShelfItem(filterShelf, 'some filter');
      build.addShelfItem(filterShelf, 'another filter');
      build.addShelfItem(filterShelf, 'a third filter');

      var sizeShelf = build.addShelf(
        aestheticsColumn,
        build.ShelfType.size,
        { id: 'size-shelf',
          label: 'Size'}
      );

      // build up initial LAYOUT shelf
      var layoutRow = $('#layoutRow');
      var rowShelf = build.addShelf(
        layoutRow,
        build.ShelfType.layout,
        { id: 'row-shelf',
          label: 'Rows',
          direction: build.DirectionType.horizontal }
        );
      var colsShelf = build.addShelf(
        layoutRow,
        build.ShelfType.layout,
        { id: 'cols-shelf',
          label: 'Cols',
          direction: build.DirectionType.horizontal }
      );*/

      myScript();
    }
  };

});
