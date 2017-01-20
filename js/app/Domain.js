/**
 * Definition of domains of {@link Field}s.
 * @module Domain
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */

define(['./utils'], function (utils) {
  "use strict";

  class Domain {

  }

  class DiscreteDomain extends Domain {
    /**
     * Constructs a discrete domain.
     * @param values A single value or an array of values for the domain. Pass nothing or null or [null] to create an unbounded Domain.
     * @constructor
     */
    constructor(values) {
      super();
      if (values == undefined)
        values = null;
      values = utils.listify(values);
      this.values = values.slice();
    }

    _checkType(d) {
      if (!(d instanceof DiscreteDomain))
        throw new TypeError("domain must also be of type DiscreteDomain");
    }

    union(domain) {
      this._checkType(domain);
      if(this.isUnbounded())
        // cannot become any larger
        return new DiscreteDomain(this.values);
      else
        return new DiscreteDomain(_.union(this.values, domain.values));
    }

    intersection(domain) {
      this._checkType(domain);
      if(this.isUnbounded())
        // it remains all the values to intersect with
        return new DiscreteDomain(domain.values);
      else
        return new DiscreteDomain(_.intersection(this.values, domain.values));
    }

    minus(domain) {
      throw Error("Not implemented");
      // TODO: not sure what to do. I'd need the extent to compute the difference
      this._checkType(domain);
      return new DiscreteDomain(_.difference(this.values, domain.values));
    }

    isUnbounded() {
      return this.values[0] === null;
    }

    /**
     * Returns a bounded version of this domain, where bounding is done by means of the given extent.
     */
    bounded(extent) {
      this._checkType(extent);
      if(this.isUnbounded())
        return extent;
      else
        return this;
    }

    get value() {
      return (this.isSingular() ? this.values[0] : this.values);
    }

    isSingular() {
      return this.values.length == 1 && !this.isUnbounded();
    }

    copy () {
      return new DiscreteDomain(this.values);
    }

  }

  class NumericDomain extends Domain {

    /**
     * Constructs a simple continuous numerical domain from the given interval.
     * A continuous numeric domain is just an interval, including its bounds.
     *
     * @param arg Either the interval of the domain as a 2-element list, or a single value. Pass null or [null, null] to construct an unbounded domain.
     * @constructor
     */
    constructor(arg) {
      super();
      if (arg == undefined)
        arg = null;
      if (_.isArray(arg)) {
        this.l = arg[0];
        this.h = arg[1];
      } else {
        this.l = arg;
        this.h = arg;
      }
      if(this.l == null)
        this.l = Number.NEGATIVE_INFINITY;
      if(this.h == null)
        this.h = Number.POSITIVE_INFINITY;
    }

    _checkType (d) {
      if (!(d instanceof NumericDomain))
        throw new TypeError("domain must also be of type NumericDomain");
    }

    union (domain) {
      this._checkType(domain);
      var low = (this.l < domain.l ? this : domain);
      var high = (this.h > domain.h ? this : domain);
      // make sure the intersection is not empty
      if (low.h < high.l)
        throw "intersection of domains is empty";
      else
        return new NumericDomain([low.l, high.h]);
    }

    intersection (domain) {
      this._checkType(domain);
      var low = (this.l < domain.l ? this : domain);
      var high = (this.h > domain.h ? this : domain);
      // make sure the intersection is not empty
      if (low.h < high.l)
        throw "domain values cannot be unioned";
      else
        return new NumericDomain([low.h, high.l]);
    }

    minus (domain) {
      throw new Error("not implemented"); // todo: implement
    }

    isSingular() {
      return this.l !== Number.NEGATIVE_INFINITY && this.l === this.h;
    }

    isUnbounded() {
      return this.l === Number.NEGATIVE_INFINITY || this.h === Number.POSITIVE_INFINITY;
    }

    isBounded() {
      return !this.isSingular() && !this.isUnbounded();
    }

    get value() {
      if(this.isSingular())
        return this.l;
      else
        return [this.l, this.h];
    }

    /**
     * Returns a bounded version of this domain, where bounding is done by means of the given extent.
     */
    bounded(extent) {
      if(this.isUnbounded())
        return new NumericDomain([this.l === Number.NEGATIVE_INFINITY ? extent.l : this.l, this.h === Number.POSITIVE_INFINITY ? extent.h : this.h]);
      else
        return this;
    }

    toString () {
      return "[" + this.l + "," + this.h + "]";
    }

    copy () {
      return new NumericDomain([this.l, this.h]);
    }
  }

  return {
    Abstract: Domain,
    Discrete: DiscreteDomain,
    Numeric: NumericDomain
  };

});