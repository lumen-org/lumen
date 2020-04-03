#!usr/bin/python
# -*- coding: utf-8 -*-import string

import numpy as np
import pandas as pd
import pymc3 as pm
import theano
import theano.tensor as tt

import math

from mb_modelbase.models_core.pyMC3_model import ProbabilisticPymc3Model
from mb_modelbase.utils.data_type_mapper import DataTypeMapper

allbus_backward_map = {
	'eastwest' : {0: 'East', 1: 'West'},
	'lived_abroad' : {0: 'No', 1: 'Yes'},
	'sex' : {0 : 'Female', 1: 'Male'},
	'spectrum' : {0: 'Left', 1: 'Center-left', 2: 'Center', 3: 'Center-right', 4: 'Right'}
}
allbus_forward_map = {
	'eastwest' : {'East' : 0, 'West' : 1},
	'lived_abroad' : {'No' : 0, 'Yes' : 1},
	'sex' : {'Female' : 0, 'Male' : 1},
	'spectrum' : {'Left' :0 , 'Center-left' : 1, 'Center' : 2, 'Center-right' : 3, 'Right' : 4}
}
dtm = DataTypeMapper()
for name, map_ in allbus_backward_map.items():
    dtm.set_map(forward=allbus_forward_map[name], backward=map_, name=name)

allbus_backward_map_educ = {
	'eastwest' : {0: 'East', 1: 'West'},
	'lived_abroad' : {0: 'No', 1: 'Yes'},
	'sex' : {0 : 'Female', 1: 'Male'},
	'spectrum' : {0: 'Left', 1: 'Center-left', 2: 'Center', 3: 'Center-right', 4: 'Right'},
	'educ' : {0: '_0', 1 : '_1', 2: '_2', 3: '_3', 4: '_4'}
}
allbus_forward_map_educ = {
	'eastwest' : {'East' : 0, 'West' : 1},
	'lived_abroad' : {'No' : 0, 'Yes' : 1},
	'sex' : {'Female' : 0, 'Male' : 1},
	'spectrum' : {'Left' :0 , 'Center-left' : 1, 'Center' : 2, 'Center-right' : 3, 'Right' : 4},
	'educ' : {'_0': 0, '_1': 1, '_2': 2, '_3': 3, '_4': 4}
}
dtme = DataTypeMapper()
for name, map_ in allbus_backward_map_educ.items():
    dtme.set_map(forward=allbus_forward_map_educ[name], backward=map_, name=name)

def create_allbus_issue83(filename='allbus_simplified.csv', modelname='allbus_issue83', fit=True):
    if fit:
        modelname = modelname+'_fitted'
    # Load and prepare data
    data = pd.read_csv(filename, index_col=0, sep=',')
    data = data.drop(['lived_abroad', 'spectrum', 'age', 'income', 'health', 'happiness', 'eastwest'], axis=1)
    # Reduce size of data to improve performance
    data = data.sample(n=500, random_state=1)
    data.sort_index(inplace=True)
    
    # Set up shared variables
    educ = theano.shared(np.array(data['educ']))

    # transform categorical variable
    sex_transformed = [allbus_forward_map['sex'][x] for x in data['sex']]

    allbus_model = pm.Model()
    with allbus_model:
        sex_p = pm.Dirichlet('sex_p', np.ones(2), shape=2)
        sex = pm.Categorical('sex', p=sex_p, observed=sex_transformed, shape=1)

    shared_vars = {
    	'educ': educ
    }
    m = ProbabilisticPymc3Model(modelname, allbus_model, shared_vars=shared_vars, data_mapping=dtm)
    
    if fit:
        m.fit(data)
    return data, m