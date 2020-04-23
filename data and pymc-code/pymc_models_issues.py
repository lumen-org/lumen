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
    
def create_allbus_model_A2(filename='allbus_simplified.csv', modelname='allbus_model_A2', fit=True):
    # changed distribution of income to gamma

    if fit:
        modelname = modelname+'_fitted'
    # Load and prepare data
    data = pd.read_csv(filename, index_col=0, sep=',')
    data = data.drop(['eastwest', 'lived_abroad', 'spectrum', 'sex', 'happiness', 'health'], axis=1)
    # Reduce size of data to improve performance
    data = data.sample(n=500, random_state=1)
    data.sort_index(inplace=True)
    
    # Set up shared variables
    age = theano.shared(np.array(data['age']))
    age_min = np.min(data['age'])
    age_max = np.max(data['age'])
    age_diff = age_max-age_min
    educ = theano.shared(np.array(data['educ']))

    allbus_model = pm.Model()
    with allbus_model:
        # priors
        inc_mu_base = pm.Uniform('inc_mu_base', 1, 3000)
        inc_mu_age = pm.Uniform('inc_mu_age', 1, 3000)
        inc_mu = inc_mu_base + inc_mu_age*(age-age_min)/age_diff

        inc_sigma_base = pm.Uniform('inc_sigma_base', 1, 3000)
        inc_sigma_age = pm.Uniform('inc_sigma_age', 1, 3000)
        inc_sigma = inc_sigma_base + inc_sigma_age*(age-age_min)/age_diff

        # likelihood
        income = pm.Gamma('income', mu=inc_mu, sigma=inc_sigma, observed=data['income'])

    m = ProbabilisticPymc3Model(modelname, allbus_model, shared_vars={'age' : age, 'educ': educ}, data_mapping=dtm)
    
    if fit:
        m.fit(data)
    return data, m

def create_allbus_model_A3(filename='allbus_simplified.csv', modelname='allbus_model_A3', fit=True):
    # add dependencies of income on education, gender and location

    if fit:
        modelname = modelname+'_fitted'
    # Load and prepare data
    data = pd.read_csv(filename, index_col=0, sep=',')
    data = data.drop(['lived_abroad', 'spectrum', 'happiness', 'health'], axis=1)
    # Reduce size of data to improve performance
    data = data.sample(n=500, random_state=1)
    data.sort_index(inplace=True)
    
    # Set up shared variables
    age = theano.shared(np.array(data['age']))
    age_min = np.min(data['age'])
    age_max = np.max(data['age'])
    age_diff = age_max-age_min

    educ_diff = 4
    
    sex_transformed = [allbus_forward_map['sex'][x] for x in data['sex']]
    eastwest_transformed = [allbus_forward_map['eastwest'][x] for x in data['eastwest']]

    allbus_model = pm.Model()
    with allbus_model:
        age_mu = pm.Uniform('age_mu', age_min, age_max)
        age_sigma = pm.Uniform('age_sigma', 1, 50)
        age = pm.TruncatedNormal('age', mu=age_mu, sigma=age_sigma, lower=age_min, upper=age_max, observed=data['age'])

        educ_p = pm.Dirichlet('educ_p', np.ones(5), shape=5)
        educ = pm.Categorical('educ', p=educ_p, observed=data["educ"], shape=1)

        sex_p = pm.Dirichlet('sex_p', 0.5*np.ones(2), shape=2)
        sex = pm.Categorical('sex', p=sex_p, observed=sex_transformed, shape=1)

        eastwest_p = pm.Dirichlet('eastwest_p', 0.5*np.ones(2), shape=2)
        eastwest = pm.Categorical('eastwest', p=eastwest_p, observed=eastwest_transformed, shape=1)

        # priors
        inc_mu_base = pm.Uniform('inc_mu_base', 1, 1000)
        inc_mu_age = pm.Uniform('inc_mu_age', 1, 1000)
        inc_mu_educ = pm.Uniform('inc_mu_educ', 1, 2000)
        inc_mu_sex = pm.Uniform('inc_mu_sex', 1, 1000)
        inc_mu_eastwest = pm.Uniform('inc_mu_eastwest', 1, 1000)
        inc_mu = (
            inc_mu_base +
            inc_mu_age*(age-age_min)/age_diff + 
            inc_mu_educ*educ/educ_diff +
            inc_mu_sex*sex + 
            inc_mu_eastwest*eastwest
            )
        inc_sigma_base = pm.Uniform('inc_sigma_base', 100, 1000)
        inc_sigma_age = pm.Uniform('inc_sigma_age', 1, 1000)
        #inc_sigma_age_max = pm.Uniform('inc_sigma_age_max', 10,90)
        inc_sigma_educ = pm.Uniform('inc_sigma_educ', 1, 1000)
        inc_sigma_sex = pm.Uniform('inc_sigma_sex', 1, 2000)
        inc_sigma_eastwest = pm.Uniform('inc_sigma_eastwest', 1, 2000)
        inc_sigma = (
            inc_sigma_base +
            inc_sigma_age*(age-age_min)/age_diff + 
            inc_sigma_educ*educ/educ_diff + 
            inc_sigma_sex*sex + 
            inc_sigma_eastwest*eastwest
            )

        # likelihood
        income = pm.Gamma('income', mu=inc_mu, sigma=inc_sigma, observed=data['income'])

    m = ProbabilisticPymc3Model(modelname, allbus_model, shared_vars={}, data_mapping=dtm)
    
    if fit:
        m.fit(data)
    return data, m