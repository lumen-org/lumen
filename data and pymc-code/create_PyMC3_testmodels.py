import numpy as np
import pandas as pd
import pymc3 as pm
from mb_modelbase.models_core.models import Model
from mb_modelbase.models_core.pyMC3_model import ProbabilisticPymc3Model
from mb_modelbase.models_core.empirical_model import EmpiricalModel
import theano
#from scripts.run_conf import cfg as user_cfg

import os
import timeit
import scipy.stats
import math

# issues examples:
import pymc_models_issues

######################################
# function template
#####################################
def create_example_model(modelname='my_name', fit=True):
    if fit:
        modelname = modelname+'_fitted'
    ## Load data as pandas df
    #data = pd.read_csv(...)
    example_model = pm.Model()
    ## Specify  your model
    # with example_model:
    # ...
    m = ProbabilisticPymc3Model(modelname, example_model)
    if fit:
        m.fit(data)
    return data, m

######################################
# pymc3_testcase_model
#####################################
def create_pymc3_simplest_model(modelname='pymc3_simplest_model', fit=True):
    if fit:
        modelname = modelname+'_fitted'
    np.random.seed(2)
    size = 100
    mu = np.random.normal(0, 1, size=size)
    sigma = 1
    X = np.random.normal(mu, sigma, size=size)
    data = pd.DataFrame({'X': X})

    basic_model = pm.Model()
    with basic_model:
        sigma = 1
        mu = pm.Normal('mu', mu=0, sd=sigma)
        X = pm.Normal('X', mu=mu, sd=sigma, observed=data['X'])
    m = ProbabilisticPymc3Model(modelname, basic_model)
    if fit:
        m.fit(data)
    return data, m

######################################
# Call all model generating functions
######################################
if __name__ == '__main__':

    start = timeit.default_timer()

    try:
        testcasemodel_path = '../models'
        testcasedata_path = '../models'
    except KeyError:	
        print('Specify a test_model_directory and a test_data_direcory in run_conf.py')
        raise

    # This list specifies which models are created when the script is run. If you only want to create
    # specific models, adjust the list accordingly
    create_functions = [
        pymc_models_issues.create_allbus_issue83

    ]

    for func in create_functions:
        data, m = func(fit=False)
        data, m_fitted = func(fit=True)

        # create empirical model
        name = "emp_" + m.name
        m.set_empirical_model_name(name)
        m_fitted.set_empirical_model_name(name)
        emp_model = EmpiricalModel(name=name)
        emp_model.fit(df=data)

        m_fitted.save(testcasemodel_path)
        m.save(testcasemodel_path)
        emp_model.save(testcasemodel_path)

        data.to_csv(os.path.join(testcasedata_path, m.name + '.csv'), index=False)

    stop = timeit.default_timer()
    print('Time: ', stop - start)

