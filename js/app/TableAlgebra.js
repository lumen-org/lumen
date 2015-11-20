/**
 * Created by philipp on 18/11/15.
 */

/**
 * Table Algebra Expression module.
 *
 * This module allows to construct table algebra expressions from row and column shelves, as well as normalizing them to their normalized set form (NSF).
 */
define(['app/shelves'], function (sh) {
  "use strict";

  /**
   * Returns the cartesian product of the two arrays a and b
   */
  function _cross (a, b) {
    console.assert(a instanceof Array && b instanceof Array);
    var ret = [];
    a.forEach( function(ea) {
      b.forEach( function(eb) {
        ret.push([ea,eb]);
      });
    });
    return ret;
  }

  /**
   * Returns the concatenation of the two array a and b.
   */
  function _plus (a, b) {
    console.assert(a instanceof Array && b instanceof Array);
    return a.concat(b);
    //alternative: return [...this, ...expr];
  }


  /**
   * Constructor for a table algebra expression from a row or column shelf.
   * @constructor
   * @returns Returns the table algebra expression of shelf. It's simply an array of the {@link FieldUsages}.
   */
  var TableAlgebraExpr = function (shelf) {
    // create empty array
    Array.call(this);

    console.assert(shelf instanceof sh.RowShelf || shelf instanceof sh.ColumnShelf);
    for( var idx = 0; idx < shelf.length(); ++idx ) {
      if (idx !== 0) {
        this.push( (shelf.contentAt(idx).role === sh.FieldT.Role.measure && shelf.contentAt(idx - 1).role === sh.FieldT.Role.measure)? '+' : '*' );
      }
      this.push( shelf.contentAt(idx) );
    }
  };
  TableAlgebraExpr.prototype = Object.create(Array.prototype);
  TableAlgebraExpr.prototype.constructor = TableAlgebraExpr;


  /**
   * Returns the set of unique {@link Field s} used this table algebra expression.
   * Note that unique-ness is decided on the level of Field not FieldUsages.
   */
  TableAlgebraExpr.prototype.uniqueFields = function () {
    return _.chain(this)
      .filter(function(e){return (e instanceof sh.FieldUsage);})
      .map(function(e){return e.base;})
      .uniq()
      .value();
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
    // e.g. sex -> [{value:"female", fieldUsage: sex}, {value:"male", fieldUsage: sex}]
    var domainExpr = [];

    this.forEach( function(fu) {
      if (fu instanceof sh.FieldUsage) {
        // store field usage with each symbol
        var operand = [];
        if (fu.kind === sh.FieldT.Kind.discrete)
          fu.domain.forEach(function (val, idx) { operand[idx] = {value : val, fieldUsage : fu};} );
        else
          operand = [{value: fu.name, fieldUsage : fu}];
        domainExpr.push(operand);
      } else {
        // elem is an operator
        domainExpr.push(fu);
      }
    });

    // 2. evaluate expression. that results in a single ordered set of arrays
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

    // only a array set of arrays should be left
    // note: however, all sub arrays must also store their original fieldUsage
    // todo : test

    return domainExpr;
  };

  return TableAlgebraExpr;
});

