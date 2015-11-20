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
        // todo: need to remember variable for each symbol/value
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
    // the domain representation is an array containing:
    // (i) the name of the field, if the field is quantitative
    // (ii) all possible values of the field , if the field is ordinal
    var domainExpr = [];

    this.forEach( function(elem, idx) {
      if (elem instanceof sh.FieldUsage) {
        // elem is some field usage
        var operand;

        if (elem.kind === sh.FieldT.Kind.discrete)
          //operand = elem.domain().order(); // todo: not implemented yet!
          operand = [1,2,3,4,5,6];
        else
          operand = [elem.name];
        // store field usage with it
        operand.fieldUsage = elem;
        domainExpr.push(operand);
      } else {
        // elem is an operator
        domainExpr.push(elem);
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

