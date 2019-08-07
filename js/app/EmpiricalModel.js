define(['./utils'], function (utils) {
  "use strict";

  // THIS IS CURRENTLY UNUSED

  /**
   * Modifies and returns a given a VisMEL query such that it is valid to be executed on the data-only part of the
   * referenced model. Essentially it filters out any Fields and FieldUsages that reference non-observed variables.
   *
   * @param pqlvismel
   */
  function filterPQLQuery (pql) {
    console.log(pql.toString());
    return pql;
  }


  return {
    filterPQLQuery,
  };
});