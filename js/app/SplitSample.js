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
     */
    singleElements: function (domain) {
      if (domain instanceof Domain.Discrete)
        return domain.map(function (e) {
          return new Domain.Discrete([e]);
        });
      else
        throw new TypeError("domain must be of type NumericDiscreteDomain or StringDomain");
    },

    /**
     * Splits a discrete domain into all its individual elements
     */
    singleElements2: function () {
      if (!(this instanceof Domain.Discrete))
        throw new TypeError("domain must be of type DiscreteDomain to use this splitter");

      return this.map(function (e) {
        return new Domain.Discrete([e], this.split);
      }, this);
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