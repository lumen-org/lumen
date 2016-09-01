/**
 * Definition of domains of {@link Field}s.
 * @module Domain
 * @author Philipp Lucas
 */

define([], function () {
  "use strict";

  /**
   * Constructs a discrete domain.
   * @param values Values of the domain as an array.
   * @constructor
   */
  var DiscreteDomain = function (values) {
    this.values = [];
    values.forEach(function (v) { this.values.push(v);}, this);
  };

  DiscreteDomain.prototype._checkType = function (d) {
    if (!(d instanceof DiscreteDomain))
      throw new TypeError("domain must also be of type DiscreteDomain");
  };

  DiscreteDomain.prototype.union = function (domain) {
    this._checkType(domain);
    return new DiscreteDomain( _.union(this.values, domain.values));
  };

  DiscreteDomain.prototype.intersection = function (domain) {
    this._checkType(domain);
    return new DiscreteDomain( _.intersection(this.values, domain.values));
  };

  DiscreteDomain.prototype.minus = function (domain) {
    this._checkType(domain);
    return new DiscreteDomain( _.difference(this.values, domain.values));
  };


  /**
   * Constructs a simple continuous numerical domain from the given interval.
   * A continuous numeric domain is just an interval, including its bounds.
   *
   * @param low lower bound of the interval.
   * @param high lower bound of the interval.
   * @constructor
   */
  var SimpleNumericContinuousDomain = function (low, high) {
    this.l = low;
    this.h = high;
  };
  SimpleNumericContinuousDomain.prototype.constructor = SimpleNumericContinuousDomain;

  SimpleNumericContinuousDomain.prototype._checkType = function (d) {
    if (!(d instanceof SimpleNumericContinuousDomain))
      throw new TypeError("domain must also be of type SimpleNumericContinuousDomain");
  };

  SimpleNumericContinuousDomain.prototype.union = function (domain) {
    this._checkType(domain);
    var l = (this.low < domain.l ? this : domain);
    var h = (this.high > domain.h ? this : domain);
    // make sure the intersection is not empty
    if (l.high < h.low)
      throw "domain values cannot be unioned";
    else
      return new SimpleNumericContinuousDomain(l.low, h.high);
  };

  SimpleNumericContinuousDomain.prototype.intersection = function (domain) {
    this._checkType(domain);
    var l = (this.low < domain.l ? this : domain);
    var h = (this.high > domain.h ? this : domain);
    // make sure the intersection is not empty
    if (l.high < h.low)
      throw "domain values cannot be unioned";
    else
      return new SimpleNumericContinuousDomain(l.high, h.low);
  };

  SimpleNumericContinuousDomain.prototype.minus = function (domain) {
    this._checkType(domain);
    throw new Error("not implemented"); // todo: implement
  };

  /**
   * Constructs a continuous numerical domain from the given interval.
   * A continuous numeric domain is described by an array of intervals, and the union of all those intervals gives the actual domain.
   // todo: implement
   * @param interval An array of ranges defining the domain.
   * @constructor
   *
   var NumericContinuousDomain = function (interval)
    Array.call(this, interval);
    // sort by start value of intervals
    throw new Error("not implemented"); // todo: implement
  };
   NumericContinuousDomain.prototype = Object.create(Array.prototype);
   NumericContinuousDomain.prototype.constructor = NumericContinuousDomain;

   NumericContinuousDomain.prototype._checkType = function (d) {
    if (!(d instanceof NumericContinuousDomain))
      throw new TypeError("domain must also be of type NumericContinuousDomain");
  };

   NumericContinuousDomain.prototype.union = function (domain) {
    _checkType(domain);
   throw new Error("not implemented"); // todo: implement
  };

   NumericContinuousDomain.prototype.intersection = function (domain) {
    _checkType(domain);
    throw new Error("not implemented"); // todo: implement
  };

   NumericContinuousDomain.prototype.minus = function (domain) {
    _checkType(domain);
    throw new Error("not implemented"); // todo: implement
  };*/

  return {
    Discrete: DiscreteDomain,
    SimpleNumericContinuous: SimpleNumericContinuousDomain
  };

});
