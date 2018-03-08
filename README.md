# README #

An interactive, visual web front-end for exploration of probability models.

Version: 0.1

### Setup ###

Clone this repository into a folder of your choice. Let's call it `root`. If you simply want to run it, you are done. For a development setup see below.

### Development Setup ###
1. Do the steps as described in the Setup section above.
2. I recommend using [WebStorm](https://www.jetbrains.com/webstorm/download/) as an IDE. 
3. Install [node-js](https://nodejs.org/en/download/). For questions refer to the [getting started guide](https://docs.npmjs.com/getting-started/what-is-npm).
4. Update npm (part of node-js): `sudo npm install -g npm`
5. Install all npm-dependencies as provided by the projects `package.json`:
    * run from `root` directory: `npm install`
6. make sure you have the following packages installed (preferably) globally: TODO !?

### Running it ###

Open `html/prototype.html` in your browser (preferably Chrome)

Note that a ModelBase server is expected to run at 'localhost:5000/webservice'. You can get it from [here](https://bitbucket.org/phlpp/modelbase).

### Trouble Shooting ###

#### I get the error message: "Could not load remote model from server!" ####
 
 1. Is the backend server actually running? 
 2. Check the developer console log of the browser where you are loading the front end. If it shows something like:
 
     ```Failed to load http://127.0.0.1:5000/webservice: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'null' that is not equal to the supplied origin. Origin 'null' is therefore not allowed access.```
 
 Then your probably run into some CORS issue because you serve the file directly from the file system, instead from a webserver running locally. See here for the issues:
   * [problem description: answer 1, point 2 ](https://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin)
 
 Solutions:
  * serve it from a local webservice (preferred)
  * [disable CORS control in chrome](https://stackoverflow.com/questions/3102819/disable-same-origin-policy-in-chrome) (kind of hacky)
 

#### I get the error message: "Could not load remote model 'XXXX' from server 'XXXX' !" ####
 1. Is the backend server actually running?
 2. Did the backend server load the model that you are trying to retrieve? Loaded models are listed in the terminal output of the backend server on its start up.
 

### Contact ###

For any questions, feedback, bug reports, feature requests, spam, etc please contact: [philipp.lucas@uni-jena.de](philipp.lucas@uni-jena.de) or come and see me in my office #3311.

### Copyright ###

© 2016 Philip Lucas All Rights Reserved