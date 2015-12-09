/**
 * Tests for {@link module:TableAlgebra}.
 *
 * @author Philipp Lucas
 * @module
 */
define(['lib/logger','app/DummyModel', 'app/Field', 'app/shelves', 'app/TableAlgebra', 'app/interaction'], function (Logger, DummyModel, F, sh, TableAlgebraExpr, inter) {
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

    it('tests the construction of a tableAlgebra expression from a shelf and normalization of a tableAlgebra expression', function(){

      // row and column shelf is empty
      var expr = new TableAlgebraExpr(shelf.row);
      var norm = expr.normalize();
      expect(expr.length).toBe(0);
      expect(_.isArray(norm)).toBe(true);

      // add dim 'sex' with domain [0,1] to row shelf
      var sexField = shelf.dim.contentAt(0);
      inter.onDrop(shelf.row, shelf.dim.at(0));
      expr = new TableAlgebraExpr(shelf.row);
      expect(expr.length).toBe(1);
      expect(expr[0].base).toBe(sexField); // the expression links to the original field

      // expect "[
      //  [{value:0, fieldUsage: sex}],
      //  [{value:1, fieldUsage: sex}]
      // ]"
      norm = expr.normalize();
      expect(norm.length).toBe(2);
      expect(norm[0].length).toBe(1);
      expect(norm[0][0].value).toBe(0);
      expect(norm[0][0].fieldUsage.base).toBe(sexField);
      expect(norm[1].length).toBe(1);
      expect(norm[1][0].value).toBe(1);
      expect(norm[1][0].fieldUsage.base).toBe(sexField);

      // add dim 'name' with domain ['John', 'Philipp', 'Maggie'] to row shelf
      var nameField = shelf.dim.contentAt(1);
      inter.onDrop(shelf.row, shelf.dim.at(1));
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
        return (!( (!Array.isArray(e)) ||
            (e.length !== 2) ||
            (e[0].fieldUsage.base !== sexField) ||
            (e[0].value !== sexField.domain[Math.floor(idx/3)]) ||
            (e[1].fieldUsage.base !== nameField) ||
            (e[1].value !== nameField.domain[idx%3]) ));
      })).toBe(true);

      //inter.onDrop(shelf.row, shelf.meas.at(0));
      //expr = new TableAlgebraExpr(shelf.row);
      //var norm3 = expr.normalize();

      // todo: more tests? ...?
    });

    it('tests TableAlgebra.fields', function(){
      var expr = new TableAlgebraExpr(shelf.row);
      expect(expr.fields().length).toBe(0);

      inter.onDrop(shelf.row, shelf.meas.at(0));
      inter.onDrop(shelf.row, shelf.meas.at(0));
      expr = new TableAlgebraExpr(shelf.row);
      expect(expr.fields().length).toBe(1);
      expect(expr.fields()[0] instanceof F.Field).toBe(true);
      expect(expr.fields()[0] instanceof F.FieldUsage).toBe(false);
      expect(expr.fields()[0]).toBe(shelf.meas.contentAt(0));

      inter.onDrop(shelf.row, shelf.dim.at(0));
      inter.onDrop(shelf.row, shelf.dim.at(1));
      inter.onDrop(shelf.row, shelf.dim.at(1));
      inter.onDrop(shelf.row, shelf.meas.at(2));
      expr = new TableAlgebraExpr(shelf.row);
      expect(expr.fields().length).toBe(4);
      expect(expr.fields().every(function(){
        return (expr.fields()[0] instanceof F.Field) && !(expr.fields()[0] instanceof F.FieldUsage);
      }));
      expect(expr.fields().indexOf(shelf.meas.contentAt(0))).not.toBe(-1); // has to be in there, order doesn't matter
      expect(expr.fields().indexOf(shelf.meas.contentAt(2))).not.toBe(-1); // has to be in there
      expect(expr.fields().indexOf(shelf.dim.contentAt(0))).not.toBe(-1); // has to be in there
      expect(expr.fields().indexOf(shelf.dim.contentAt(1))).not.toBe(-1); // has to be in there
    });

  });
});