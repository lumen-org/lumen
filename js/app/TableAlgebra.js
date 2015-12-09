/**
 * Table Algebra Expression module.
 *
 * This module allows to construct table algebra expressions from row and column shelves, as well as normalizing them to their normalized set form (NSF).
 *
 * @module TableAlgebra
 * @author Philipp Lucas
 */
define(['./Field', './shelves'], function (F, sh) {
  "use strict";

  /**
   * Returns the cartesian product of the two arrays a and b
   */
  function _cross (a, b) {
    if( !(a instanceof Array && b instanceof Array) ) throw new TypeError();
    var ret = [];
    a.forEach( function(ea) {
      b.forEach( function(eb) {
        ret.push(_.flatten([ea,eb]));
      });
    });
    return ret;
  }

  /**
   * Returns the concatenation of the two array a and b.
   */
  function _plus (a, b) {
    if( !(a instanceof Array && b instanceof Array) ) throw new TypeError();
    // todo test
    return a.concat(b);
    //alternative: return [...this, ...expr];
  }


  /**
   * Constructor for a table algebra expression from a row or column shelf.
   * @constructor
   * @returns Returns the table algebra expression of shelf. It's simply an array of the {@link FieldUsages}.
   * @alias module:TableAlgebra
   */
  var TableAlgebraExpr = function (shelf) {
    if( !(shelf instanceof sh.RowShelf || shelf instanceof sh.ColumnShelf)) throw new TypeError();
    Array.call(this);
    for( var idx = 0; idx < shelf.length(); ++idx ) {
      if (idx !== 0)
        this.push( (shelf.contentAt(idx).role === F.FieldT.Role.measure &&
        shelf.contentAt(idx - 1).role === F.FieldT.Role.measure)? '+' : '*' );
      this.push( shelf.contentAt(idx) );
    }
  };
  TableAlgebraExpr.prototype = Object.create(Array.prototype);
  TableAlgebraExpr.prototype.constructor = TableAlgebraExpr;


  /**
   * Returns the set of (unique) {@link FieldUsage}s used this table algebra expression.
   */
  TableAlgebraExpr.prototype.fieldUsages = function () {
    return _.uniq( _.filter(this, function(e){return (e instanceof F.FieldUsage);}) );
  };


  /**
   * Returns the set of (unique) {@link Field}s used this table algebra expression.
   * Note that uniqueness is decided (and returned) on the level of Field not FieldUsages.
   */
  TableAlgebraExpr.prototype.fields = function () {
    return _.uniq( _.map(this.fieldUsages(), function(e){return e.base;}) );
  };


  /**
   * Returns the normalized set form (NSF) of this table algebra expression. It does not modify this table algebra expression.
   */
  TableAlgebraExpr.prototype.normalize = function () {

    // 1. turn FieldUsages into their domain representation
    // the domain representation of a FieldUsage is an array of symbols:
    // (i) a single symbol, i.e. the name of the field, if the field is quantitative
    // (ii) all possible values of the field , if the field is ordinal
    // Note that the symbols are stored under 'val', while a reference to the original FieldUsage is stored under 'fieldUsage'

    // also note the way its encapsulated in three array levels:
    // level 1: expression level: each element is an operand / operator
    // level 2: element level: each element is a combination of domain values / symbols
    // level 3: value level: each element is a certain domain value / symbol of a fieldUsage
    // note: at the end of the normalization, there is naturally only one element at the expression level left

    // example 1: [sex]
    //  -> [ [[{value:"0", fieldUsage: sex}], [{value:"1", fieldUsage: sex}]] ]
    // example 2: [sex, *, avg(age)]
    //  -> [ [[{value:"0", fieldUsage: sex}], [{value:"1", fieldUsage: sex}]], *, [[{value: "age", fieldUsage: age}]] ]
    var domainExpr = [];

    if (this.length === 0)
      return [];

    this.forEach( function(fu) {
      if (fu instanceof F.FieldUsage) {
        // store field usage with each symbol
        var operand = [];
        if (fu.kind === F.FieldT.Kind.discrete)
          fu.domain.forEach( function (val, idx) { operand[idx] = [{value : val, fieldUsage : fu}];} );
        else
          operand = [[{value: fu.name, fieldUsage : fu}]];
        domainExpr.push(operand);
      } else {
        // elem is an operator
        domainExpr.push(fu);
      }
    });

    // 2. evaluate expression. that results in a single ordered set of arrays
    // example 1 cont'd: [ [[{value:"0", fieldUsage: sex}], [{value:"1", fieldUsage: sex}]] ]
    //  -> stays the same
    // example 2 cont'd: [ [[{value:"0", fieldUsage: sex}], [{value:"1", fieldUsage: sex}]], *, [[{value: "age", fieldUsage: age}]] ]
    //  -> [[ [{value:"0", fieldUsage: sex}, {value: "age", fieldUsage: age}],
    //        [{value:"1", fieldUsage: sex}, {value: "age", fieldUsage: age}] ]]

    //   2a) evaluate all "*"
    domainExpr.forEach( function(elem, idx) {
      if (elem === "*") {
        // replace that element by the result of "domainExpr[idx-1] * domainExpr[idx+1]"
        domainExpr.splice(idx-1, 3, _cross(domainExpr[idx-1], domainExpr[idx+1]) );
      }
    });

    //   2b) evaluate all "+"
    domainExpr.forEach( function(elem, idx) {
      if (elem === "+") {
        // replace that element by the result of "domainExpr[idx-1] + domainExpr[idx+1]"
        domainExpr.splice(idx-1, 3, _plus(domainExpr[idx-1], domainExpr[idx+1]) );
      }
    });

    // an array of arrays should be left
    if (domainExpr.length !== 1) {
      throw new Error("after normalization there must be only 1 element left at expression level.");
    }

    return domainExpr[0];
  };

  /**
   * @returns {string} Returns a concise string representation...
   */
  TableAlgebraExpr.prototype.toString = function () {
    var str = "";
    this.forEach( function(elem) {
      if (elem instanceof F.Field)
        str += elem.name;
      else
        str += " " + elem + " ";
    });
    return str;
  };

  return TableAlgebraExpr;
});

