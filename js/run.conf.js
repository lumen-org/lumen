define([], function () {

  // the model to be loaded on startup of the page
  /* this name must match the name of the model that the backend loaded */
  const DEFAULT_MODEL = '';

  // the model server to use for PQL queries
  /* Make sure that all aspects are correct:

       <protocol>://<ip/hostname>:<port>/<directory>

       * hostname/ip: e.g. 127.0.0.1
       * protocol: https or http ?
       * port: e.g. 8080
       * directory on host (if any)
   */  
  const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:52104';

  return {
    DEFAULT_MODEL,
    DEFAULT_SERVER_ADDRESS
  }
});
