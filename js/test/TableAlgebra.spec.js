/**
 * Tests for {@link module:TableAlgebra}.
 *
 * @author Philipp Lucas
 * @module
 */
define(['lib/logger','app/DummyModel', 'app/shelves', 'app/TableAlgebra', 'app/interaction'], function (Logger, DummyModel, sh, TableAlgebraExpr, inter) {
  "use strict";

  var logger = Logger.get('pl-TableAlgebra.spec');
  logger.setLevel(Logger.INFO);

  describe('Tests for the TableAlgebra module', function () {

    // needs a little more complicated setup...:
    // setup model
    var myModel = DummyModel.generator.census();
    // the needed shelves
    var shelf = {
      meas: new sh.MeasureShelf(),
      dim: new sh.DimensionShelf()
    };
    // populate fields of model on dimension and measure shelf
    sh.populate(myModel, shelf.dim, shelf.meas);

    // important for debugging: turn of interaction and visual part (this is kinda hacky...)
    inter.onDrop.noVisualNoInteraction = true;

    // always start with empty row and column shelves
    beforeEach( function() {
      shelf.row = new sh.RowShelf();
      shelf.column = new sh.ColumnShelf();
    });

    it('tests the construction of a tableAlgebra expression from a shelf', function(){

      // row and column shelf is empty
      var expr = new TableAlgebraExpr(shelf.row);
      var norm = expr.normalize();
      expect(expr.length).toBe(0);
      expect(_.isArray(norm)).toBe(true);

      // add dim 'sex' with domain [0,1] to row shelf
      var sexField = shelf.dim.contentAt(0);
      inter.onDrop[sh.ShelfTypeT.row](shelf.row, shelf.dim.at(0));
      expr = new TableAlgebraExpr(shelf.row);
      expect(expr.length).toBe(1);
      expect(expr[0].base).toBe(sexField); // the expression links to the original field

      // expect "[
      //  [{value:0, fieldUsage: sex}],
      //  [{value:1, fieldUsage: sex}]
      // ]"
      norm = expr.normalize();
      expect(norm.length).toBe(2);
      expect(norm[0].value).toBe(0);
      expect(norm[0].fieldUsage.base).toBe(sexField);
      expect(norm[1].value).toBe(1);
      expect(norm[1].fieldUsage.base).toBe(sexField);

      // add dim 'name' with domain ['John', 'Philipp', 'Maggie'] to row shelf
      var nameField = shelf.dim.contentAt(1);
      inter.onDrop[sh.ShelfTypeT.row](shelf.row, shelf.dim.at(1));
      expr = new TableAlgebraExpr(shelf.row);
      expect(expr.length).toBe(3);
      expect(expr[0].base).toBe(sexField);
      expect(expr[1]).toBe("*");
      expect(expr[2].base).toBe(nameField);

      // expect "[
      //   [{value:0, fieldUsage:sex}, {value:'John', fieldUsage:name}],
      //   [{value:0, fieldUsage:sex}, {value:'Philipp', fieldUsage:name}],
      //   [{value:0, fieldUsage:sex}, {value:'John', fieldUsage:name}],
      //   [{value:1, fieldUsage:sex}, {value:'Maggie', fieldUsage:name}],
      //   [{value:1, fieldUsage:sex}, {value:'Philipp', fieldUsage:name}],
      //   [{value:1, fieldUsage:sex}, {value:'Maggie', fieldUsage:name}]
      // ]"
      var norm2 = expr.normalize();
      expect(norm2.length).toBe(6);
      expect(norm2.every(function(e, idx){
        if (!Array.isArray(e)) return false;
        if (e.length !== 2) return false;
        if (e[0].fieldUsage.base !== sexField) return false;
        //if (e[0].value !== sexField.domain[idx/3]) return false;  // todo: no integer operations ...
        if (e[1].fieldUsage.base !== nameField) return false;
        //if (e[1].value !== nameField[idx%3]) return false;
        return true;
      })).toBe(true);

      //inter.onDrop[sh.ShelfTypeT.row](shelf.row, shelf.meas.at(0));
      //inter.onDrop[sh.ShelfTypeT.column](shelf.column, shelf.dim.at(1));
      //inter.onDrop[sh.ShelfTypeT.column](shelf.column, shelf.meas.at(1));
    });

    it('tests TableAlgebra.uniqueFields', function(){

    });

    it('tests TableAlgebra.normalize', function(){

    });

  });
});