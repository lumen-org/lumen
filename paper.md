---
title: 'Lumen: An interactive tool for the visual exploration of probabilistic models together with data'

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
---

# Summary

**introduction: say what it does: accessibilty to humans for probabilistic models.**

Research in Machine Learning has led to the development of a plethora of different types of models.
Lumen aims to make a particular yet broad class of models, namely probabilistic models, more easily accessible to human analysts. 

**add one or two more sentences about what it provides**

It does so by providing an interactive web application for the visual exploration, comparison and validation of probabilistic models together with its data. 
As the main feature of Lumen a user can rapidly and incrementally build flexible and potentially complex interactive visualizations of both the probabilistic model and the data that the model was trained on. 

**what is a probabilistic model? explain by comparison to classic ML**

Many classic machine learning methods predict the value of some target variable(s) given the value of some input variable(s).
*Probabilistic* models go beyond this 'point estimation' by instead of a particular value predicting  a probability distribution over the target variable(s).
This allows, for instance, to also estimate the prediction's uncertainty, a quanitity that is very relevant.

**make an example**

For example imagine a model predicts that an image of a suspicious skin area does _not_ show a malignant tumor. Here it is extremely valuable to aditionally know whether the model is sure to 99.99% or just 51%.

**accessibility as key challenge**

A major challenge for both the development and application of Machine Learning methods is their accessibility to a human analyst, that is, the amount of hurdles that one has to take in order to practically make use and benefit from it.
Lumen aims to improve accessibility of probabilistic machine learning models with respect to multiple aspects as follows:

(1) Education: By providing visual and intuitive representations of models Lumen may fosters understanding of the underlying modelling techniques. For instance

(2) Usage: 

(3) Debugging: Spotting artifacs

**Interface**

Lumen's interface is inspired by the academic Polaris project and its commercial successor Tableau. 
However, while Tableau is for _data only_, Lumen provides a uniform visual langauge and interactions for data _and_ probabilistic models.
Figure \autoref{fig:LumenUI} shows an example screenshot of Lumen.
The Schema (left) contains the random variables of a probabilistic model. 
Users can drag'n'drop variables onto the visual channels of the Specification (middle).
Doing so will reconfigure the currently active visualization on the dashboard (right).
This triggers the fetching of respective data and model queries and finally update and rerender the visualization.
To foster comparison of multiple models (for instance stemming from different classes of models, or from iterates of an incremental model building process) Lumen allows user to create as many visualizations of as many models as they like.
All visualization are interactive themselves, as well as resizable and freely movable on the plotting canvas.

![The web-interface of Lumen with (1) t .\label{fig:example}](LumenUI.png){ width=85% }

**Architecture**

While Lumen takes care of all user facing aspects (such as visualizations and interactions) most computational aspects (such as model or data queries that are triggered by a user interactions) are delegated to a dedicated, python3/flask-based backend.
This backend is implemented in the modelbase project [@Lucas:2021:modelbase].
Here we follow a classic client-server architecture where Lumen is the web-client and modelbase the web-service.
For the standard usage scenario you would install both client and server locally on the same machine. 
However, they can of course be separated and hosted/run on different machinent across a network.

**Supported classes of probabilistic models**

Lumen is model-agnostic in the sense that it can be used with models of any class of probabilistic models as long as this model class implements a common API *in the modelbase backend*. 
In mathematical terms it essentially boils down to the following conditions that the supported model class

 * contains only quantitative and/or categorical random variables, i.e. there is no native support for images, time series or vector-valued random variables, 
 * supports marginalization of random variables, i.e. the operation to remove of any subset of random variables of the model, 
 * supports conditioning of random variables on values of its domain, i.e. the operation to fix the value of random variables to particular values, and
 * supports density queries.

In fact Lumen makes no use of any specificity of a particular class of models and we regard this genericity as one of Lumens major features. 
Among the model classes that we have used Lumen with are Sum-Product-Networks [@Poon:11; @Molina:2019:SPFlow], Condional-Gaussian Distributions [Olkin:1961:CG; Nussbaum:2020:paper], Probabilistic Progams based on PyMC3 [Salvatier:2016:PyMC3], and Kernel-Density-Estimators [@Parzen:1962:KDE; @SciPy:2020].

# Acknowledgements

We thank Jonas Aaron Gütter and Julien Klaus for their contributions.
We also thank Andreas Goral for his early and steady interest in trying out Lumen as well as the helpful feedback he provided.
Philipp Lucas was partially supported by Stiftung der Deutschen Wirtschaft (sdw). 

# References
