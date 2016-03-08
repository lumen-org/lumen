/**
 * Definition of splitters and samplers for {@link Domain}s.
 *
 * todo: maybe I should move splitters and samples to the specific domain definitions. it seems a little awkward and unnatural to have them separate that much: e.g. I'm checking for the correct types in each splitters ...
 *
 * @author Philipp Lucas
 * @module SplitSample
 */
define(['lib/d3', './Domain'], function (d3, Domain) {
  "use strict";

  /**
   * Collection of split and sample functions for domains.
   */
  var Splitter = {
    /**
     * Splits a {@link SimpleNumericContinuousDomain} into n equivalently sized subintervals.
     * @param {SimpleNumericContinuousDomain} domain The domain to split
     * @param n Number of subintervals
     */
    equiIntervals: function (domain, valueFlag, n) {
      if (!(domain instanceof Domain.SimpleNumericContinuous))
        throw new TypeError("domain must be of type Domain.SimpleNumericContinuousDomain");
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
          return new Domain.SimpleNumericContinuous(range);
        });
    },

    /**
     * Splits a discrete domain into all its individual elements
     * @param {DiscreteDomain} domain The domain to split.
     * @param {boolean} valueFlag If set, this function returns an array all values of the domain, otherwise, it returns an array of domains, each having only a single element as its domain.
     */
    singleElements: function (domain, valueFlag) {
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
    }
  };


  var Sampler = {

    /**
     * Samples the domain to n samples that are equidistancily
     * @param {SimpleNumericContinuousDomain} domain The domain to sample.
     * @param n
     */
    equiDistance: function (domain, valueFlag, n) {
      if (!(domain instanceof Domain.SimpleNumericContinuous))
        throw new TypeError("domain must be of type Domain.SimpleNumericContinuousDomain");
      // slice into n values equally distanced
      let values = d3.range(domain.l, domain.h, (domain.h - domain.l)/n);

      if (valueFlag)
        return values;
      else
        return values.map(function (val) {
          return new Domain.SimpleNumericContinuous([val, val]);
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
    ampler: Sampler,
    plitter: Splitter
  };
});
