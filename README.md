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

Open `index.html` in your browser (preferably Chrome) and navigate to `prototype` or directly open `html/prototype.html`.

Note that a ModelBase server is expected to run at 'localhost:5000/webservice'. You can get it from [here](https://bitbucket.org/phlpp/modelbase).

### Other Notes ###

* 'daphne' is a separate side project. you can safely ignore it entirely.

### Contact ###

For any questions, feedback, bug reports, feature requests, spam, etc please contact: [philipp.lucas@uni-jena.de](philipp.lucas@uni-jena.de) or come and see me in my office #3311.

### Copyright ###

© 2016 Philip Lucas All Rights Reserved