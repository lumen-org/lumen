/**
 * Definition of splitters and samplers for {@link Domain}s.
 *
 * todo: maybe I should move splitters and samples to the specific domain definitions. it seems a little awkward and unnatural to have them seperate that much: e.g. I'm checking for the correct types in each splitters ...
 *
 * @author Philipp Lucas
 * @module SplitSample
 */
define(['./Domain'], function (Domain) {
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
    equiIntervals: function (domain, n) {
      throw new Error("not implemented"); // todo: implement
    },

    /**
     * Splits a discrete domain into all its individual elements
     * @param {DiscreteDomain} domain The domain to split.
     * @param {boolean} valueFlag If set, this function returns an array all values of the domain, otherwise, it returns an array of domains, each having only a single element as its domain.
     */
    singleElements: function (domain, valueFlag) {
      if (domain instanceof Domain.Discrete) {
        if (valueFlag)
          return domain.values.slice();
        else
          return domain.values.map(function (e) {
            return new Domain.Discrete([e]);
          });
      } else
        throw new TypeError("domain must be of type Domain.Discrete");
    },

    identity: function  (domain) {
      return [domain];
    }
  };


  var Sampler = {

    /**
     * Samples the domain to n samples that are equidistancily
     * @param {SimpleNumericContinuousDomain} domain The domain to sample.
     * @param n
     */
    equiDistance: function (domain, n) {
      throw new Error("not implemented"); // todo: implement
    },

    /**
     * Samples a domain using to n random samples.
     * @param domain The domain to sample.
     * @param n
     */
    randomSamples: function (domain, n) {
      throw new Error("not implemented"); // todo: implement
    }
  };

  return {
    ample: Sampler,
    plitter: Splitter
  };
});


///**
// * Returns a cached function
// * @param domain
// * @returns {Function}
// */
//function singleElements (domain) {
//
//  var cachedDomain, cachedSplitDomain, cachedSplitValues;
//
//  /**
//   * Caches result of split
//   */
//  function cacheIt (domain) {
//    cachedDomain = domain;
//    cachedSplitDomain = Splitter.singleElements(domain, false);
//    cachedSplitValues = Splitter.singleElements(domain, true);
//  }
//
//  cacheIt(domain);
//
//  // return function to retrieve the cached values
//  return function (domain, valueFlag) {
//
//    // todo: how to properly check that it is unchanged ... ?!
//    if (domain !== cachedDomain) {
//      cacheIt(domain);
//    }
//
//    return (valueFlag ? cachedSplitValues : cachedSplitDomain);
//  };
//}