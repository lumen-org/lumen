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
        // todo alternative: ret.push([...ea, ...eb]) ?
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
    // alternative: return a.concat(b);
    return [...a, ...b];
  }


  /**
   * Constructs a table algebra expression from a row or column shelf, or creates an empty expression.
   * @param {ColumnShelf|RowShelf} [shelf] The shelf to build the expression from.
   * @returns Returns the table algebra expression of shelf. It's simply an array of the {@link FieldUsage}s with proper operators in between.
   * @constructor
   * @alias module:TableAlgebra
   */
  var TableAlgebraExpr = function (shelf) {
    Array.call(this);
    if (arguments.length === 0)
      return;

    if( !(shelf instanceof sh.RowShelf || shelf instanceof sh.ColumnShelf)) throw new TypeError();
    for( var idx = 0; idx < shelf.length(); ++idx ) {
      if (idx !== 0)
        /* todo: bug: fix this. this is not a proper way of deciding on the operators. see as follows:
          - dimensions have to be positioned before measures, as we split the axis in accordance of the order of symbols in a NSF entry.
          - measures have to be added up, before the cross operator with dimensions is applied, i.e.
            wrong: dim1 * meas1 + meas2
              because it leads to something like: {(d1 meas1), (d2 meas1), ..., (dn meas1), meas2
            right: dim1 * (meas1 + meas2)}
              because it leads to something like: {(d1 meas1 meas2), (d2 meas1 meas2), ..., (dn meas1, meas2)}
         */
        this.push( (shelf.contentAt(idx).role === F.FieldT.Role.measure &&
        shelf.contentAt(idx - 1).role === F.FieldT.Role.measure)? '+' : '*' );
      this.push( shelf.contentAt(idx) );
    }
  };
  TableAlgebraExpr.prototype = Object.create(Array.prototype);
  TableAlgebraExpr.prototype.constructor = TableAlgebraExpr;

  TableAlgebraExpr.prototype.shallowCopy = function () {
    var copy = new TableAlgebraExpr();
    this.forEach(function(e){copy.push(e);});
    return copy;
  };


  /**
   * Returns the set of (unique) {@link FieldUsage}s used this table algebra expression.
   */
  TableAlgebraExpr.prototype.fieldUsages = function () {
    return _.uniq( _.filter(this, F.isFieldUsage));
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
   *
   * If the table algebra expression is empty, it returns an 'empty NSF element' {@link TableAlgebraExpr.emptyNsfElement}
   */
  TableAlgebraExpr.prototype.normalize = function () {

    // todo: implement check: each NSF element may not contain more than 1 measure usage
    // todo: implement check: if a NSF element contains a measure usage, this must be the last piece of that NSF element.
    // todo: in the previous version we distinguished by ordinal vs discrete, not dimension vs measure. what is correct?

    // 1. turn FieldUsages into their domain representation
    // the domain representation of a FieldUsage is:
    // (i) in case of a measure: an array containing a single element: the measure itself
    // (ii) in case of a dimension: an array containing the split/sampling of the dimension, according to its split/sampling function

    // also note the way its encapsulated in three array levels:
    // level 1: expression level: each element is an operand / operator
    // level 2: element level: each element is a combination of domain values / symbols
    // level 3: value level: each element is a certain domain value / symbol of a fieldUsage
    // note: at the end of the normalization, there is naturally only one element at the expression level left

    // example 1: [sex]
    // -> [[ [sex (domain: 0)], [sex (domain: 1)] ]]
    // example 2: [sex, *, avg(age)]
    // -> [[ [sex (domain: 0)], [sex (domain: 1)] ], *, [[age]] ]

    var domainExpr = [];

    if (this.length === 0) {
      // return the "empty NSF element"
      return [[this.emptyNsfElement]];
    }

    this.forEach( function(elem) {
      if (elem instanceof F.FieldUsage) {
        if (F.isDimension(elem)) {
          // splitted returns an array of FieldUsages, however, we need an array of arrays where each inner array only has a single element: namely the field usage with reduced domain
          let splitted = elem.split();
          domainExpr.push(splitted.map (function (e) {return [e]; }));
        } else
          domainExpr.push([[elem]]);
      } else {
        // elem is an operator
        domainExpr.push(elem);
      }
    });

    // 2. evaluate expression. that results in a single ordered set of arrays
    // example 1 cont'd: [[ [sex (domain: 0)], [sex (domain: 1)] ]]
    //  -> stays the same
    // example 2 cont'd: [ [ [sex with domain=[0]], [sex with domain=[1]] ], *, [[age]] ]
    // -> [[ [sex with domain=[0], age], [sex with domain=[1], age] ]]

    //   2a) evaluate all "+"
    for (let idx=0; idx<domainExpr.length; ++idx) {
      let elem = domainExpr[idx];
      if (elem === "+") {
        // replace that element by the result of "domainExpr[idx-1] + domainExpr[idx+1]"
        domainExpr.splice(idx-1, 3, _plus(domainExpr[idx-1], domainExpr[idx+1]) );
        // decrease idx, since we merged three elements of domainExpr into one. Otherwise we would skip elements.
        --idx;
      }
    }

    //   2b) evaluate all "*"
    for (let idx=0; idx<domainExpr.length; ++idx) {
      let elem = domainExpr[idx];
      if (elem === "*") {
        // replace that element by the result of "domainExpr[idx-1] * domainExpr[idx+1]"
        domainExpr.splice(idx-1, 3, _cross(domainExpr[idx-1], domainExpr[idx+1]) );
        // decrease idx, since we merged three elements of domainExpr into one. Otherwise we would skip elements.
        --idx;
      }
    }

    // an array of arrays should be left
    if (domainExpr.length !== 1) {
      throw new Error("after normalization there must be only 1 element left at expression level.");
    }

    return domainExpr[0];
  };

  TableAlgebraExpr.prototype.emptyNsfElement = {};

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

