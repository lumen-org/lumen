# README #

`lumen` is an interactive web-application for exploration, comparision and validation of data and/or machine learning models derived from the data.

It is part of the (equally named) [Lumen project](https://github.com/lumen-org/) which consists of two parts: the back-end [modelbase](https://github.com/lumen-org/modelbase) and (this one) the front-end [lumen](https://github.com/lumen-org/lumen).

There is a online demo version available [here](http://lumen.inf-i2.uni-jena.de/).

## Setup and Configuration 

This explains how to get and configure `lumen` and it's dependencies.

### Requirements

* `lumen` is a webfrontend (web application) that requires access to a webservice instance of the `modelbase` backend. `lumen` allows a user to interactively compile queries and visualize the queries results, while `modelbase` does the heavy computation and actually answers the queries. You can get `modelbase` [here](https://github.com/lumen-org/modelbase) where you also find information on how to set it up and run it as a webservice.

* *`lumen` and `modelbase` need to be configured correctly with 'matching' settings*: 
  * hostname set in `lumen` must match the actual hostname of `modelbase` 
  * port must match
  * protocol must match (http or https)

* In order to do anything useful the backend needs to host the models that you want to explore. This is configured in `modelbase`

### Get it

Clone this repository into a folder `<path>` of your choice. If you simply want to run it, you are done. For a development setup see below.

**Updating it** 

Just pull the branch/verion you'd like.

### Configuring `lumen`

For configuration of `modelbase` see its documentation.

`lumen` requires a configuration file `run.conf.js` which is *NOT* part of the repository. In the future this file will probably be created automatically, but at the moment you have to do it manually. Adapt and save this in a new file under `<path>/js/run.conf.js`:
  
    define([], function () {
    
      // the model to be loaded on startup of the page
      /* this name must match the name of the model that the backend loaded */
      const DEFAULT_MODEL = 'mcg_iris_map';
    
      // the model server to use for PQL queries
      /* Make sure that all aspects are correct:
      
           <protocol>://<ip/hostname>:<port>/<directory>
      
           * hostname/ip: e.g. 127.0.0.1
           * protocol: https or http ??
           * port: e.g. 8080
           * directory on host (if any)
       */  
      const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:52104';
    
      return {
        DEFAULT_MODEL,
        DEFAULT_SERVER_ADDRESS
      }
    });

### Using it

 * make sure the `modelbase` backend is running and hosting the correct models that you'd like to explore.
 * if DEFAULT_MODEL is set to "" all existing models are displayed.
 
Open `<path>/index.html` in your browser. Using chrome is recommended, since it - by far - provides the best performance. 


---

## Development Setup ###
1. Do the steps as described in the Setup section above.
2. recommended IDE is [WebStorm](https://www.jetbrains.com/webstorm/download/)
3. Install [node-js](https://nodejs.org/en/download/). For questions refer to the [getting started guide](https://docs.npmjs.com/getting-started/what-is-npm).
4. Update npm (part of node-js): `sudo npm install -g npm`
5. Install all npm-dependencies as provided by the projects `package.json`:
    * run from `<path>`: `npm install`
6. make sure you have the following packages installed (preferably) globally:
    * TODO !?

---

### Trouble Shooting ###

#### When open lumen in my browser I get the error message: "Could not load remote model from server!" ####
 
 1. Confirm that the backend server actually running
 2. Check the developer console log of the browser where you are loading the front-end. If it shows something like:
 
     ```Failed to load http://127.0.0.1:5000/webservice: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'null' that is not equal to the supplied origin. Origin 'null' is therefore not allowed access.```
 
 Then your probably run into some CORS issue because you serve the file directly from the file system, instead from a webserver running locally. See here for the issues:
   * [problem description: answer 1, point 2 ](https://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin)
 
 Solutions:
  * serve it from a local webservice (preferred)
  * [disable CORS control in chrome](https://stackoverflow.com/questions/3102819/disable-same-origin-policy-in-chrome) (kind of hacky)
 

#### I get the error message: "Could not load remote model 'XXXX' from server 'XXXX' !" ####
 1. Confirm that the backend server is actually running
 2. Did the backend server load the particular model that you are trying to retrieve? Loaded models are listed in the terminal output of the backend server on its start up.

------------

### Contact ###

For any questions, feedback, bug reports, feature requests, spam, etc please contact: [philipp.lucas@dlr.de](philipp.lucas@dlr.de).

### Copyright and Licence ###

© 2016-2020 Philipp Lucas (philipp.lucas@dlr.de)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
