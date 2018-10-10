# README #

Lumen is an interactive, visual web-application for exploration, comparision and validation of data and/or models derived from the data.

### Setup ###

Clone this repository into a folder <path> of your choice. If you simply want to run it, you are done. For a development setup see below.

### Running it ###


1. start your local backend, if not running already. Note that that Lumen is only the client but relies on a backend for storing and querying of data and models.
 This 'modelbase' must run at 'localhost:5000/webservice'. You can get it from [here](https://bitbucket.org/phlpp/modelbase).
2. open `html/lumen.html` in your chrome browser.

NOTE: currently only the chrome browser is supported!

### Development Setup ###
1. Do the steps as described in the Setup section above.
2. recommended IDE is [WebStorm](https://www.jetbrains.com/webstorm/download/)
3. Install [node-js](https://nodejs.org/en/download/). For questions refer to the [getting started guide](https://docs.npmjs.com/getting-started/what-is-npm).
4. Update npm (part of node-js): `sudo npm install -g npm`
5. Install all npm-dependencies as provided by the projects `package.json`:
    * run from `root` directory: `npm install`
6. make sure you have the following packages installed (preferably) globally: TODO !?

### Trouble Shooting ###

#### When open the front-end I get the error message: "Could not load remote model from server!" ####
 
 1. Confirm that the backend server actually running
 2. Check the developer console log of the browser where you are loading the front-end. If it shows something like:
 
     ```Failed to load http://127.0.0.1:5000/webservice: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'null' that is not equal to the supplied origin. Origin 'null' is therefore not allowed access.```
 
 Then your probably run into some CORS issue because you serve the file directly from the file system, instead from a webserver running locally. See here for the issues:
   * [problem description: answer 1, point 2 ](https://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin)
 
 Solutions:
  * serve it from a local webservice (preferred)
  * [disable CORS control in chrome](https://stackoverflow.com/questions/3102819/disable-same-origin-policy-in-chrome) (kind of hacky)
 

#### I get the error message: "Could not load remote model 'XXXX' from server 'XXXX' !" ####
 1. Confirm that the backend server actually running
 2. Did the backend server load the particular model that you are trying to retrieve? Loaded models are listed in the terminal output of the backend server on its start up.

### Contact ###

For any questions, feedback, bug reports, feature requests, spam, etc please contact: [philipp.lucas@uni-jena.de](philipp.lucas@uni-jena.de) or come and see me in my office #3311.

### Copyright ###

© 2018 Philip Lucas All Rights Reserved