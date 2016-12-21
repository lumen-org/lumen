/**
 * Definition of splitters and samplers for {@link Domain}s.
 *
 * todo: maybe I should move splitters and samplers to the specific domain definitions. it seems a little awkward and unnatural to have them separate that much: e.g. I'm checking for the correct types in each splitters ...
 *
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 * @module SplitSample
 */
define(['d3', './Domain', './PQL'], function (d3, Domain, PQL) {
  "use strict";

  /**
   * @returns {*} Returns the actual split into single values / subdomains.
   */
  function splitToValues (split) {
    // todo: 5 is a magic number. introduce a configuration variable to allow custom splitting
    //return this.splitter(this.domain, true, 10);
    let field = split.field;
    return Splitter[split.method](field.domain.bounded(field.extent), true /*valueflag*/, split.args);
  }

  /**
   * @returns {Array|*} Applies the split on its field and returns an array of filters that represent
   * the restriction of the domain of each split.
   */
  function splitToFilters (split) {
    //let values = splitToValues(split);
    let field = split.field;
    let domains =  Splitter[split.method](field.domain.bounded(field.extent), false /*valueflag*/, split.args);
    // create filter for each split value
    return domains.map( domain => new PQL.Filter(split.field, 'equals', domain) );
  }

  /**
   * Collection of split and sample functions for domains.
   */
  var Splitter = {
    /**
     * Splits a {@link NumericDomain} into n equivalently sized subintervals.
     * @param {NumericDomain} domain The domain to split
     * @param n Number of subintervals
     */
    equiIntervals: function (domain, valueFlag, n) {
      if (!(domain instanceof Domain.Numeric))
        throw new TypeError("domain must be of type Domain.NumericDomain");
      // slice into n intervals of same length
      let len = (domain.h - domain.l)/n;
      let val = domain.l;
      let pairs = new Array(n);
      for (let i=0; i<n; ++i) {
        pairs[i] = [val, val = val + len];
      }

      if (valueFlag)
        return pairs;
      else
        return pairs.map(function (range) {
          return new Domain.Numeric(...range);
        });
    },

    /**
     * Splits a discrete domain into all its individual elements
     * @param {Discrete} domain The domain to split.
     * @param {boolean} valueFlag If set, this function returns an array of all values of the domain, otherwise, it returns an array of domains, each having only a single element as its domain.
     */
    elements: function (domain, valueFlag) {
      if (!(domain instanceof Domain.Discrete))
        throw new TypeError("domain must be of type Domain.Discrete");
      let values = domain.values.slice();

      if (valueFlag)
        return values;
      else
        return values.map(function (e) {
          return new Domain.Discrete([e]);
        });
    },

    identity: function  (domain) {
      throw new TypeError(" not implemented ");
      //return [domain];
    },

    /**
     * Samples the domain to (at most) n samples that are equidistant.
     * @param {NumericDomain} domain The domain to sample.
     * @param n
     */
    equiDist: function (domain, valueFlag, n) {
      if (!(domain instanceof Domain.Numeric)) {
        throw new TypeError("domain must be of type Domain.NumericDomain");
      }

      // slice into n values equally distanced      
      let values;
      // special case: domain contracts to single value
      if (domain.h === domain.l) 
        //values = Array(n).fill(domain.l);
        values = [domain.l]; // I think not duplicating the single value makes more sense
      // general case
      else 
        values = d3.range(domain.l, domain.h, (domain.h - domain.l)/n);

      if (valueFlag)
        return values;
      else
        return values.map(function (val) {
          return new Domain.Numeric(val, val);
          //return new Domain.Discrete([val]);
        });
    },

    /**
     * Samples a domain using to n random samples.
     * @param domain The domain to sample.
     * @param n
     */
    randomSamples: function (domain, valueFlag, n) {
      throw new Error("not implemented"); // todo: implement
    }
  };

  return {
    Splitter: Splitter,
    splitToValues: splitToValues,
    splitToFilters: splitToFilters
  };
});
