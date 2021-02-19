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
  - name: Joachim Giesen
    affiliation: 2

affiliations:
 - name: Institute of Data Science, German Aerospace Center
   index: 1
 - name: Friedrich-Schiller-University Jena
   index: 2

date: 18 January 2021
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

*introduction: say what it does: accessibilty to humans for probabilistic models.
Machine Learning is a broad field with a plethora of different types of models available. Lumen aims to make a specific, yet broad class of models, namely probabilistic models, more easily accessible to human analysts. 

*add one or two more sentences about what it provides
It does so by providing an interactive web application for the visual exploration, comparison and validation of probabilistic models together with its data. As the main feature of the web-application a user can rapidly and incrementally build flexible and potentially complex visualizations of both the probabilistic machine learning model and the data that the model is trained on. 

*what is a probabilistic model? explain by comparison to classic ML
Many classic machine learning models predict the value of some target variable(s) given the value of some input variable(s). Probabilistic models go beyond this 'point estimation' by predicting instead of a particular value a probability distribution over the target variable(s). This allows, for instance, to also provide an estimation of the uncertainty of a prediction. 

While many classic Machine Learning methods can only predict a particular value of the target variable(s), probabilistic models instead capture the distribution of values of the target variables. This allows, for instance, to also provide an estimation of the prediction's uncertainty, a quanitity that is very relevant.
*make an example*
Imagine a model predicted that some image of suspicious skin does _not_ show a malignant tumor, it is extremely value to aditionally know whether the model is sure to 99.99% or just 51%.

*accessibility as key challenge
A major challenge for both the development and application of Machine Learning methods is their accessibility to a human analyst, that is, the amount of hurdles that one has to take in order to practically make use and get a benefit of some method. Lumen aims to improve accessibility for probabilistic machine learning models with respect to multiple aspects as follows:

(1) Education: By providing visual and intuitive representations of models Lumen may fosters understanding of the underlying modelling techniques. For instance

(2) Usage: 

(3) Debugging: Spotting artifacs



# architecture

Lumen 
Client-Server Architecture

client: web-based, 

server: python3 and an abstact

extentionable architecture

User interactions are translated into declarative query langauge for visualizations, which is then turned into SQL queries for data and alike statement for model queries.


# supported models

Lumen is model-agnostic in the sense that it works with any probabilistic model class which implements the `model` API of the `modelbase` backend. Essentially this boils down the following: 

 * the model class consists of only quantitative and categorical variables (i.e. no native support for images, time series or vector values variables)
 * the model class supports marginalization of variables
 * the model class supports conditioning of variables on values
 * the model class supports density queries

# interface

Lumen's  web-interface is inspired by the Polaris project and its commercial successor Tableau. Note, however, that Lumen work for probabilistic models _and_ data, whereas Tableau is for the analysis of data only. Figure \autoref{fig:LumenUI} shows an example screenshot of Lumen. The Schema (left) contains the random variables of a probabilistic model. Users can drag'n'drop variables onto the visual channels of the Specification (middle). Doing so will reconfigure the currently active visualization, that is, it will trigger the fetching of respective data and model queries from the modelbase backend and finally update and rerender the visualization. To foster comparison of multiple models (for instance stemming from different classes of models, or from iterates of an incremental model building process) Lumen allows user to create as many visualizations of as many different models as they like. Visualization are interactive themselves, and also resizable and freely movable on the plotting canvas.

![The web-interface of Lumen with (1) t .\label{fig:example}](LumenUI.png){ width=85% }

# Acknowledgements

....

# References



--------------------------------------------------------

#An associated challenge is the often insufficient accessibility and explainability of probabilistic models for the human analyst~\cite{TODO}.
#%How do two models compare to each other? How does the value of some meta parameter influence the models behaviour? Does the model behave in the intended way? 
#In a general sense an analyst would like to \textit{understand} the model in order to be able to interpret the validity of its outcome, explain its behaviour, or to improve its performance.










the understanding of teh 

has multiple multiple aspects making it technically easy to 

Hence, improving accessibility will help with the development of new methods but also with the application of existing ones. With Lumen we h

*detail aspects of accessibility

*contribution of lumen to solve such issues by describing the features
* -> use this as statement of need


Eine wesentliche Herausforderung für die Entwicklung und Anwendung dieser Methoden ist,
sie einfach zugänglich zu machen.

Diese Zugänglichmachen hat verschiedene Aspekte:
einfache Nutzung der Technik
    technische Hürden reduzieren um eine breiteres Publikum zu erreichen
    schnellere Iterationen im Modellierungprozess
Verständnis des Technik selbst
    Education? was macht eine Methode überhaupt? 
    Wie wirkt sich eine Veränderung aus, wie vergleichen sich Modelle, Parametrisierungen?
Verständnis der Ergebnisse einer Methode um sie zu bewerten: 
   Validität und Plausibilität der Ergebnisse
   


* no coding
* easy interaction
* cu

It aims to abstract the technical difficulties



odels of the probabilistic 

 - 


Accessibility 

#An associated challenge is the often insufficient accessibility and explainability of probabilistic models for the human analyst~\cite{TODO}.
#%How do two models compare to each other? How does the value of some meta parameter influence the models behaviour? Does the model behave in the intended way? 
#In a general sense an analyst would like to \textit{understand} the model in order to be able to interpret the validity of its outcome, explain its behaviour, or to improve its performance.

The forces on stars, galaxies, and dark matter under external gravitational
fields lead to the dynamical evolution of structures in the universe.

The orbits
of these bodies are therefore key to understanding the formation, history, and
future state of galaxies. 

The field of "galactic dynamics," which aims to model
the gravitating components of galaxies to study their structure and evolution,
is now well-established, commonly taught, and frequently used in astronomy.

Aside from toy problems and demonstrations, the majority of problems require
efficient numerical tools, many of which require the same base code (e.g., for
performing numerical orbit integration).

# Statement of need

`Gala` is an Astropy-affiliated Python package for galactic dynamics. Python
enables wrapping low-level languages (e.g., C) for speed without losing
flexibility or ease-of-use in the user-interface. The API for `Gala` was
designed to provide a class-based and user-friendly interface to fast (C or
Cython-optimized) implementations of common operations such as gravitational
potential and force evaluation, orbit integration, dynamical transformations,
and chaos indicators for nonlinear dynamics. `Gala` also relies heavily on and
interfaces well with the implementations of physical units and astronomical
coordinate systems in the `Astropy` package [@astropy] (`astropy.units` and
`astropy.coordinates`).

`Gala` was designed to be used by both astronomical researchers and by
students in courses on gravitational dynamics or astronomy. It has already been
used in a number of scientific publications [@Pearson:2017] and has also been
used in graduate courses on Galactic dynamics to, e.g., provide interactive
visualizations of textbook material [@Binney:2008]. The combination of speed,
design, and support for Astropy functionality in `Gala` will enable exciting
scientific explorations of forthcoming data releases from the *Gaia* mission
[@gaia] by students and experts alike.

# Mathematics

Single dollars ($) are required for inline mathematics e.g. $f(x) = e^{\pi/x}$

Double dollars make self-standing equations:

$$\Theta(x) = \left\{\begin{array}{l}
0\textrm{ if } x < 0\cr
1\textrm{ else}
\end{array}\right.$$

You can also use plain \LaTeX for equations
\begin{equation}\label{eq:fourier}
\hat f(\omega) = \int_{-\infty}^{\infty} f(x) e^{i\omega x} dx
\end{equation}
and refer to \autoref{eq:fourier} from text.

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

# Figures

Figures can be included like this:
![Caption for example figure.\label{fig:example}](figure.png)
and referenced from text using \autoref{fig:example}.

Figure sizes can be customized by adding an optional second parameter:
![Caption for example figure.](figure.png){ width=20% }

# Acknowledgements

We acknowledge contributions from Brigitta Sipocz, Syrtis Major, and Semyeong
Oh, and support from Kathryn Johnston during the genesis of this project.

# References
