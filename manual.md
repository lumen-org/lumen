
This document is intended as a user manual explaining the structure of the user interface (UI) of *Lumen* and the interactions that users can do.

In a few sentences it could be summarized as follows:

*Lumen* allows you to visually explore probabilistic models and their data.
You, the user, assigns attributes of the data / random variables of the model to visual variables
by drag'n' drop interactions to specify what part of the model/data you would like to see and how this model/data is visually encoded. 



# Overview

These are the five main components and their most important function

 1. Toolbar: load models and create new visualizations
 2. Schema panel: Shows the data attributes / variables of the model shown in the active visualization.
 3. Specification panel: Let's you modify the assignment of data attributes  / variables of the model to visual variables in order to change the active visualization.
 4. Dashboard: a pannable container that holds all your visualizations
 5. Visualizations (contained in the dashboard): 

At several points above it said 'active' visualization.
At any point there is exactly one 'active' visualization, and as a user you can change the active visualization by simply clicking on it in the dashboard.

To keep things simple each visualization is associated to exactly one model and its data.
Put differently: you cannot mix multiple models in one visualization.
However, of course, you can create multiple visulizations and each visulization parts of a different model!


## Toolbar

The toolbar is located on the top edge of the UI.

![Toolbar in Lumen's UI](doc/img/Toolbar.png)

### Loading models / creating new visualizations

Most importantly you can create new visualizations using the toolbar.
Go to the drop-down menu on the left, select among the available models and then hit "Go!" to get a brand new, empty visualization of the selected model in the 
The newly created visualization is automatically activated, that is, the schema is represents the 
Note that _Lumen_ connects to a back-end ([modelbase](https://github.com/lumen-org/modelbase/)), which manages the models itself and executes queries on it.

### Clone Button

You can use the clone button to duplicate the currently selected visualization. 
A new visualization with identical content is created and can be used and modifying on its own.

### Clear button

The Clear button will remove all assignments to the 

### Query button

Hitting the query button will trigger of recomputation of all the queries and a recreation of teh currently selected visualization.
It's comparable to refreshing a page and skipping the cache, in case something just went wrong.. 

### Details

This will toggle a little panel to the right that shows some more details about the current model and allows you to download the data shown in the active visualization.

### Config

Toggles another panel that shows advanced configurations to change colors, opacity, strokes and much more. 







Most importantly with the toolbar located on the top edge of the UI you can load new models and

The toolbar provides



: The UI consists of a Schema

The
