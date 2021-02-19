---
title: 'Lumen: A visual-interactive framework for probabilistic models'
title: 'Lumen: An extensible Framework for interactive visual exploration of probabilistic models together with data'

tags:
  - Python
  - Probabilistic Modelling
  - Model Criticism
  - Visual-Interactive Exploration
  - Web-Interface

authors:
  - name: Philipp Lucas^[corresponding author]
    orcid: 0000-0002-6687-8209
    affiliation: 1
  - name: Jonas Aaron Gütter
    orcid: XXXX
    affiliation: 1
  - name: Joachim Giesen
    affiliation: 2

affiliations:
 - name: Institute of Data Science, German Aerospace Center
   index: 1
 - name: Friedrich-Schiller-University Jena
   index: 2

date: 19 February 2021
bibliography: paper.bib

# Optional fields if submitting to a AAS journal too, see this blog post:
# https://blog.joss.theoj.org/2018/12/a-new-collaboration-with-aas-publishing
# aas-doi: 10.3847/xxxxx <- update this with the DOI from AAS once you know it.
# aas-journal: Astrophysical Journal <- The name of the AAS journal.
---

# old stuff

//Probability distributions are fundamental mathematical objects that are used for systematically describing random phenomena in a plethora of methods in statistical modelling and machine learning.
//A probabilistic model describes a set of target variables by means of a probability density function.

# Summary

**introduction: say what it does: accessibilty to humans for probabilistic models.**
Machine Learning is a broad field with a plethora of different types of models available.
Lumen aims to make a specific, yet broad class of models, namely probabilistic models, more easily accessible to human analysts. 

**add one or two more sentences about what it provides**
It does so by providing an interactive web application for the visual exploration, comparison and validation of probabilistic models together with its data. 
As the main feature of the web-application a user can rapidly and incrementally build flexible and potentially complex visualizations of both the probabilistic machine learning model and the data that the model is trained on. 

**what is a probabilistic model? explain by comparison to classic ML**
Many classic machine learning methods predict the value of some target variable(s) given the value of some input variable(s).
Probabilistic models go beyond this 'point estimation' by instead of a particular value predicting a probability distribution over the target variable(s).
This allows, for instance, to also provide an estimation of the uncertainty of a prediction. 

While many classic Machine Learning methods can only predict a particular value of the target variable(s), probabilistic models instead capture the distribution of values of the target variables. 
This allows, for instance, to also provide an estimation of the prediction's uncertainty, a quanitity that is very relevant.

**make an example**
Imagine a model predicted that some image of suspicious skin does _not_ show a malignant tumor, it is extremely value to aditionally know whether the model is sure to 99.99% or just 51%.

**accessibility as key challenge**
A major challenge for both the development and application of Machine Learning methods is their accessibility to a human analyst, that is, the amount of hurdles that one has to take in order to practically make use and get a benefit of some method.
Lumen aims to improve accessibility for probabilistic machine learning models with respect to multiple aspects as follows:

(1) Education: By providing visual and intuitive representations of models Lumen may fosters understanding of the underlying modelling techniques. For instance

(2) Usage: 

(3) Debugging: Spotting artifacs

**architecture**
Lumen takes care of all user facing aspects, such as visualizations and interactions.
All computational aspects, that is any queries that need to be computed for a user-requested visualization, are delegated to a dedicated, python3/flask-based backend, namely `modelbase`.
This follows a standard client-server architecture. While for the standard use-case you would install both client and server locally on the same machine, they can be separated and hosted as webservice (modelbase) and web-application (lumen). 

extentionable architecture

User interactions are translated into declarative query langauge for visualizations, which is then turned into SQL queries for data and alike statement for model queries.


# Supported classes models

Lumen is model-agnostic in the sense that it works with any class of probabilistic models that:

 * contains only quantitative and categorical random variables (i.e. no native support for images, time series or vector values variables)
 * supports marginalization of random variables
 * supports conditioning of random variables on values of its domain
 * supports density queries

# interface

Lumen's  web-interface is inspired by the Polaris project and its commercial successor Tableau.
Note, however, that Lumen work for probabilistic models _and_ data, whereas Tableau is for the analysis of data only.
Figure \autoref{fig:LumenUI} shows an example screenshot of Lumen.
The Schema (left) contains the random variables of a probabilistic model. Users can drag'n'drop variables onto the visual channels of the Specification (middle).
Doing so will reconfigure the currently active visualization, that is, it will trigger the fetching of respective data and model queries from the modelbase backend and finally update and rerender the visualization.
To foster comparison of multiple models (for instance stemming from different classes of models, or from iterates of an incremental model building process) Lumen allows user to create as many visualizations of as many different models as they like.
Visualization are interactive themselves, and also resizable and freely movable on the plotting canvas.

![The web-interface of Lumen with (1) t .\label{fig:example}](LumenUI.png){ width=85% }

# Acknowledgements

....

# References



# Citations

Citations to entries in paper.bib should be in
[rMarkdown](http://rmarkdown.rstudio.com/authoring_bibliographies_and_citations.html)
format.

If you want to cite a software repository URL (e.g. something on GitHub without a preferred
citation) then you can do it with the example BibTeX entry below for @fidgit.

For a quick reference, the following citation commands can be used:
- `@author:2001`  ->  "Author et al. (2001)"
- `[@author:2001]` -> "(Author et al., 2001)"
- `[@author1:2001; @author2:2001]` -> "(Author1 et al., 2001; Author2 et al., 2002)"

# Acknowledgements

# References
