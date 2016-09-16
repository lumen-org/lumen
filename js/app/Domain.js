/**
 * Definition of domains of {@link Field}s.
 * @module Domain
 * @author Philipp Lucas
 */

define(['./utils'], function (utils) {
  "use strict";

  class DiscreteDomain {

    /**
     * Constructs a discrete domain.
     * @param values A single of or an array of values for the domain.
     * @constructor
     */
    constructor (values) {
      values = utils.listify(values);
      this.values = [];
      values.forEach( v => this.values.push(v), this);
    }

    _checkType (d) {
      if (!(d instanceof DiscreteDomain))
        throw new TypeError("domain must also be of type DiscreteDomain");
    }

    union (domain) {
      this._checkType(domain);
      return new DiscreteDomain( _.union(this.values, domain.values));
    }

    intersection (domain) {
      this._checkType(domain);
      return new DiscreteDomain( _.intersection(this.values, domain.values));
    }

    minus (domain) {
      this._checkType(domain);
      return new DiscreteDomain( _.difference(this.values, domain.values));
    }
  }


  class SimpleNumericContinuousDomain {

    /**
     * Constructs a simple continuous numerical domain from the given interval.
     * A continuous numeric domain is just an interval, including its bounds.
     *
     * @param arg Either the interval of the domain as a 2-element list, or a single value
     * @constructor
     */
    constructor(arg) {
      if (_.isArray(arg)) {
        this.l = arg[0];
        this.h = arg[1];
      } else {
        this.l = arg;
        this.h = arg;
      }
    }

    _checkType (d) {
      if (!(d instanceof SimpleNumericContinuousDomain))
        throw new TypeError("domain must also be of type SimpleNumericContinuousDomain");
    }

    union (domain) {
      this._checkType(domain);
      var l = (this.low < domain.l ? this : domain);
      var h = (this.high > domain.h ? this : domain);
      // make sure the intersection is not empty
      if (l.high < h.low)
        throw "domain values cannot be unioned";
      else
        return new SimpleNumericContinuousDomain([l.low, h.high]);
    }

    intersection (domain) {
      this._checkType(domain);
      var l = (this.low < domain.l ? this : domain);
      var h = (this.high > domain.h ? this : domain);
      // make sure the intersection is not empty
      if (l.high < h.low)
        throw "domain values cannot be unioned";
      else
        return new SimpleNumericContinuousDomain([l.high, h.low]);
    }

    minus (domain) {
      this._checkType(domain);
      throw new Error("not implemented"); // todo: implement
    }
  }

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
