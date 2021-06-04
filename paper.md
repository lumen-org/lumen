---
title: 'Lumen: A software for the interactive visualization of probabilistic models together with data'

tags:  
  - Probabilistic Modelling
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

date: 19th April 2021
bibliography: paper.bib
---

# Summary

Research in machine learning and applied statistics has led to the development of a plethora of different types of models.
*Lumen* aims to make a particular yet broad class of models, namely, probabilistic models, more easily accessible to humans. 
*Lumen* does so by providing an interactive web application for the visual exploration, comparison, and validation of probabilistic models together with underlying data. 
As the main feature of *Lumen* a user can rapidly and incrementally build flexible and potentially complex interactive visualizations of both the probabilistic model and the data that the model was trained on. 

Many classic machine learning methods learn models that predict the value of some target variable(s) given the value of some input variable(s).
*Probabilistic* models go beyond this point estimation by predicting instead of a particular value a probability distribution over the target variable(s).
This allows, for instance, to estimate the prediction's uncertainty, a highly relevant quantity.
For a demonstrative example consider a model predicts that an image of a suspicious skin area does _not_ show a malignant tumor.
Here it would be extremely valuable to additionally know whether the model is sure to 99.99% or just 51%, that is, to know the uncertainty in the model's prediction.

*Lumen* is build on top of the [*modelbase*](https://github.com/lumen-org/modelbase) back-end, which provides a SQL-like interface for querying models and its data [@Lucas:2021:modelbase].

# Statement of need

A major challenge for both the application and development of machine learning/modelling methods is their accessibility to a human analyst, that is, the amount of hurdles that one must overcome to practically make use and benefit from them.
*Lumen* aims to improve accessibility of probabilistic machine learning models with respect to multiple aspects as follows:

_Model Building:_
Building a statistical/machine learning model is often an iterative, analyst-driven process.
This is particularly true for the field of probabilistic programming, a modelling approach where the analyst explicitly declares the likelihood of the observed data as a probability density function.
The analyst typically starts with an exploration of the data.
Based on insights gained from data exploration and on the analyst's domain knowledge, the analyst creates an initial simple model involving only some data.
Subsequently, this model is iteratively made more complex [@Gelman:2013; @Gabry:2019] until it meets the expert's goals.
In particular, the model must be validated after each iteration.
*Lumen* supports this model building process by (i) enabling visual-interactive data exploration, (ii) supporting model validation by means of a visual comparison of data queries to semantically equivalent model queries, and (iii) enabling a direct comparison of model iterates.

_Debugging:_
Even for a machine learning expert it may be hard to know whether a model has been trained on the data as expected.
Possible reasons for artifacts in a model include an inappropriate application of the machine learning method, implementation bugs in the machine learning method, and issues in the training data.
Direct visual inspection of the probabilistic model provides an approach to model debugging that enables the analyst to literally spot model artifacts that may cause degrading performance.
Classical approaches to validation would rely on aggregating measures like information criterions or preditictive accuracy scores.

_Education:_
By its intuitive visual representations of models, *Lumen* aims to promote understanding of the underlying modelling techniques. 
For instance, the effect of varying a parameter value for a modelling method on the probabilistic model can be observed visually rather than remaining an abstract description in a textbook.
Similarily, the differences between models/model types can be visually illustrated  by plotting them side by side.
Also, probabilistic concepts such as conditioning or marginalization, which are often difficult to grasp, can be tried out interactively, providing immediate feedback.

# Software

*Lumen's* interface is inspired by the academic Polaris project and its commercial successor Tableau [@Stolte:2002]. 
However, while Polaris/Tableau is for _data only_, *Lumen* provides a uniform visual language and interactions for both data and probabilistic models.
\autoref{fig:LumenUI} shows an screenshot of *Lumen* to illustrate the user interface. 
The Schema panel (left) contains the random variables of the probabilistic model that the user has currently selected.
Users can drag'n'drop variables onto the visual channels of the Specification panel (middle-left).
This reconfigures the currently active visualization on the dashboard (middle to right), triggers execution of corresponding data and model queries, and finally updates and re-renders the visualization.
To foster comparison of multiple models (for instance from different classes of models or from iterates of an incremental model building process) Lumen allows users to create as many visualizations of as many models as desired.
All visualization support basic interactions like panning, zoom, or selections and are resizable as well as freely movable on the dashboard.

![The Web-based interface of *Lumen* displaying a variety of visualizatons as created in the process of incrementally building a probabilistic model on the socio-economic ALLBUS data set [@Allbus:2016]: 
(1) Marginal data density. 
(2) Marginal model density (pink) versus observed data density (grey). 
(3) Both plots show the same queries but from (a) to (b) the underlying model was improved to better capture the correlation of the `income` variable and the `sex` variable.
Again, data are shown as histograms and model densities as line plots. 
(4) Connected dots show the model's point predictions of `income` given `age` and `sex`.
Marks in the background as well as the marginal plots at the side represent observed data.
(5) Similar to (4) but visualizing the model's predictions of `income` as well as of `happiness` given `age` and place of origin (`eastwest`). 
Again, the background marks show observed data.\label{fig:LumenUI}](joss/example.png){ width=95% }

While *Lumen* handles all user facing aspects (such as visualizations and interactions) most computational aspects (such as execution of model or data queries that are triggered by a user interaction) are delegated to a dedicated back-end. 
The back-end is implemented in the *modelbase* project [@Lucas:2021:modelbase].
This separation follows a classic client-server architecture where *Lumen* is the web-client and *modelbase* the web-service.
For the standard usage scenario both client and server would be installed locally on the same machine. 
However, they can, of course, also be separated on different machines across a network.

*Lumen* is model-agnostic in the sense that it can be used with models of any class of probabilistic models as long as this model class implements the common, abstract API in the *modelbase* back end. 
The API essentially requires that a model class 

 * contains only quantitative and categorical random variables, i.e. Lumen has no native support for images, time series, or vector-valued random variables, 
 * supports marginalization of random variables, i.e. the operation to remove/integrate out any subset of random variables of the model, 
 * supports conditioning of random variables on values of its domain, i.e. the operation to fix the value of random variables to particular values, and
 * supports density queries, i.e. the operation to ask for the value of the model's probability density function at any point of its domain.

In fact *Lumen* does not depend on any specific properties of a particular model class and we regard this genericity as one of *Lumens* major features. 
Among the model classes that we have used *Lumen* with are Sum-Product-Networks [@Poon:2011; @Molina2019:SPFlow], Condional-Gaussian Distributions [@Olkin:1961:CG; @Nussbaum:2020:paper], Probabilistic Progams based on PyMC3 [@Salvatier:2016:PyMC3], and Kernel-Density-Estimators [@Parzen:1962:KDE; @SciPy:2020].

# Acknowledgements

We thank Andreas Goral, Jonas Aaron Gütter, Laines Schmalwasser, Julien Klaus and Christian Lengert for their steady and patient interest in trying out Lumen, for their valuable feedback and our discussions, as well as for the features they contributed to Lumen.
Philipp Lucas was partially supported by Stiftung der Deutschen Wirtschaft (sdw). 

# References
