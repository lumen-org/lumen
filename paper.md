---
title: 'Lumen: An interactive software for the visual exploration of probabilistic models together with data'

tags:
  - Probabilistic Modeling
  - Model Criticism, Model Validation
  - Model Understanding
  - Visual-Interactive Exploration
  - Web-Interface

authors:
  - name: Philipp Lucas^[corresponding author]
    orcid: 0000-0002-6687-8209
    affiliation: 1
  - name: Joachim Giesen
    affiliation: 2

affiliations:
 - name: Institute of Data Science, German Aerospace Center
   index: 1
 - name: Friedrich-Schiller-University Jena
   index: 2

date: 25th February 2021
bibliography: paper.bib
---

# Summary

[comment]: # (**introduction: say what it does: accessibility to humans for probabilistic models.**)

Research in machine learning has led to the development of a plethora of different types of models.
Lumen aims to make a particular yet broad class of models, namely probabilistic models, more easily accessible to human analysts. 
[comment]: # (**add one or two more sentences about what it provides**)
It does so by providing an interactive web application for the visual exploration, comparison, and validation of probabilistic models together with its data. 
As the main feature of Lumen a user can rapidly and incrementally build flexible and potentially complex interactive visualizations of both the probabilistic model and the data that the model was trained on. 

[comment]: # (**what is a probabilistic model? explain by comparison to classic ML**)

Many classic machine learning methods learn models that predict the value of some target variable(s) given the value of some input variable(s).
*Probabilistic* models go beyond this _point estimation_ by predicting instead of a particular value a probability distribution over the target variable(s).
This allows, for instance, to also estimate the prediction's uncertainty, a quantity that is very relevant.
[comment]: # (**make an example**)
For a demonstrative example imagine a model predicts that an image of a suspicious skin area does _not_ show a malignant tumor. Here it is extremely valuable to additionally know whether the model is sure to 99.99% or just 51%.

[comment]: # (**accessibility as key challenge**)

# Statement of need

A major challenge for both the development and application of machine learning methods is their accessibility to a human analyst, that is, the amount of hurdles that one has to take in order to practically make use and benefit from it.
Lumen aims to improve accessibility of probabilistic machine learning models with respect to multiple aspects as follows:

Learning: 
By providing visual and intuitive representations of models Lumen aims to foster understanding of the underlying modelling techniques. For instance, the effect of varying the value of a parameter for some modelling method can be studied and seen visually instead of remaining an abstract description in a text book. Likewise the differences between models can been demonstrated visually by plotting them side by side. Also, difficult to grasp probabilistic concepts like conditioning or marginalization can be tried out interactively, providing immediate feedback on ones expectations.

Debugging: 
Even for a machine learning expert it may be hard to know whether a model has been trained on the data as expected.
The reasons for artifacts in a model may include implementation bugs in the machine learning method, inappropriate application of the method, and issues in the training data. 
Visual inspection of the probabilistic model provides an alternative approach to model debugging.
It enables the analyst to literally spot model artifacts that may cause degrading performance. 

Model Building/Validation: 
Building a statistical/machine learning model for a given task is often an iterative, analyst-driven process.
This is particularly true for the field of probabilistic programming, a modelling approach where the analyst explicitly and mathematically declares the likelihood of the observed data as a probability density function. The analyst typically starts with little data and a simple model, subsequently making it more complex and powerful in an iterative manner [@Gelman:2013; @Gabry:2019].
At each iteration the model has to validated.
Lumen supports this validation and also a comparison to previous model iterates. For instance, it can plot many views of models side-by-side the data they are trained on.

# Tool

[comment]: # (**Interface**)

Lumen's interface is inspired by the academic Polaris project and its commercial successor Tableau. 
However, while Tableau is for _data only_, Lumen provides a uniform visual language and interactions for data _and_ probabilistic models.
Figure \autoref{fig:LumenUI} shows an example screenshot of Lumen.
The Schema (left) contains the random variables of a probabilistic model. 
Users can drag'n'drop variables onto the visual channels of the Specification (middle).
Doing so reconfigures the currently active visualization on the dashboard (right).
This triggers the fetching of respective data and model queries, and finally updates and re-renders the visualization.
To foster comparison of multiple models (for instance stemming from different classes of models, or from iterates of an incremental model building process) Lumen allows users to create as many visualizations of as many models as they like.
All visualization are interactive themselves (panning, zoom, selections), as well as resizable and freely movable on the dashboard.

![The web-interface of Lumen with (1) t .\label{fig:example}](LumenUI.png){ width=85% }

[comment]: # (**Architecture**)

While Lumen takes care of all user facing aspects (such as visualizations and interactions) most computational aspects (such as execution of model or data queries that are triggered by a user interaction) are delegated to a dedicated back-end.
This back-end is implemented in the modelbase project [@Lucas:2021:modelbase].
In this separation we follow a classic client-server architecture where Lumen is the web-client and modelbase the web-service.
For the standard usage scenario you would install both client and server locally on the same machine. 
However, they can of course be separated and hosted/run on different machine across a network.

[comment]: # (**Supported classes of probabilistic models**)

Lumen is model-agnostic in the sense that it can be used with models of any class of probabilistic models as long as this model class implements a common API in the modelbase back end. 
In mathematical terms it essentially boils down to the following conditions that the supported model class 

 * contains only quantitative and/or categorical random variables, i.e. there is no native support for images, time series or vector-valued random variables, 
 * supports marginalization of random variables, i.e. the operation to remove of any subset of random variables of the model, 
 * supports conditioning of random variables on values of its domain, i.e. the operation to fix the value of random variables to particular values, and
 * supports density queries, i.e. the operation to ask for the value of the models probability density function at any point of its domain.

In fact Lumen does not depend on any specificity of a particular class of models and we regard this genericity as one of Lumens major features. 
Among the model classes that we have used Lumen with are Sum-Product-Networks [@Poon:11; @Molina:2019:SPFlow], Condional-Gaussian Distributions [Olkin:1961:CG; Nussbaum:2020:paper], Probabilistic Progams based on PyMC3 [Salvatier:2016:PyMC3], and Kernel-Density-Estimators [@Parzen:1962:KDE; @SciPy:2020].

# Acknowledgments

We thank Jonas Aaron Gütter, Julien Klaus and Christian Lengert for their contributions to the modelbase back end.
We also thank Andreas Goral for his early and steady interest in trying out Lumen as well as the helpful feedback he provided.
Philipp Lucas was partially supported by Stiftung der Deutschen Wirtschaft (sdw). 

# References
