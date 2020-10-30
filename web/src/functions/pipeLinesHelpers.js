import { toastr } from 'react-redux-toastr';
import ExperimentsApi from 'apis/experimentApi';
import DataPipelineApi from 'apis/DataPipelineApi';
import {
  Adjectives,
  CANCELED,
  EXPIRED,
  FAILED,
  Nouns,
  PENDING,
  RUNNING,
  SKIPPED,
  SUCCESS,
} from '../dataTypes';
import Attention from '../images/Pipeline_Attention.png';
import Loading from '../images/Pipeline_Loading.png';
import Success from '../images/Pipeline_Success.png';
import Fail from '../images/Pipeline_Fail.png';

const dataPipelineApi = new DataPipelineApi();

export const createPipelineInProject = (
  backendId,
  branchName,
  pipelineType,
  filesSelectedInModal,
  dataOperationsSelected,
) => {
  const dataOperations = dataOperationsSelected?.map((dataOp) => ({
    slug: dataOp.slug,
    parameters: dataOp?.parameters?.map(({
      name, value, default_value: defaultValue,
    }) => ({
      name,
      value: value || defaultValue,
    })),
  }));

  const pipelineBody = {
    source_branch: branchName,
    pipeline_type: pipelineType,
    input_files: filesSelectedInModal.map((file) => ({
      location: file.path,
    })),
    data_operations: dataOperations,
  };

  dataPipelineApi.create(
    backendId,
    pipelineBody,
  ).then(() => toastr.success('Success', 'The pipeline has started'));
};

/**
 *
 * @param {*} dataOperationsSelected: opeartions selected by user to  be executed on data
 * @param {*} backendId: backend project id is the id that backend assign to a gitlab project
 * @param {*} branchName: new branch name that will contain the output
 * @param {*} branchSelected: gitlab branch in which files will be read
 * @param {*} filesSelectedInModal: files that will be used as input for models or operations
 */
const createExperimentInProject = (
  dataOperationsSelected,
  backendId,
  branchName,
  branchSelected,
  filesSelectedInModal,
) => {
  const expApi = new ExperimentsApi();
  const experimentData = dataOperationsSelected[0];
  const { parameters, slug } = experimentData;
  const experimentBody = {
    slug: branchName, // slug is NOT the branch name, it needs replacement
    name: branchName,
    source_branch: branchSelected,
    target_branch: branchName,
    input_files: filesSelectedInModal
      .map((file) => ({ location: file.path, location_type: file.type === 'blob' ? 'PATH_FILE' : 'PATH_FOLDER' })),
    processing: {
      slug,
      parameters: parameters.map(({
        name, value, type, required, description, default_value: defaultValue,
      }) => ({
        name,
        value: value || defaultValue,
        type,
        required,
        description,
      })),
    },
  };
  expApi.createExperiment(backendId, experimentBody)
    .then((experiment) => {
      toastr.success('Success', 'Experiment was generated');
      expApi.startExperiment(backendId, experiment.id)
        .then((res) => {
          if (res.ok) {
            toastr.success('Success', 'Experiment was started');
          } else {
            return Promise.reject(res);
          }
          return null;
        });
    })
    .catch((err) => {
      toastr.error('Error', err);
    });
};

export default createExperimentInProject;

/* ----------------------------  ----------------------------------  -------------------------------*/

/**
 * Utility to generate names for branches principally
 */
export const randomNameGenerator = () => {
  const randomFirstName = Math.floor(Math.random() * Adjectives.length);
  const randomLastName = Math.floor(Math.random() * Nouns.length);
  const currentDate = new Date();
  const date = currentDate.getDate();
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const dateString = `${date}${month + 1}${year}`;
  return `${Adjectives[randomFirstName]}-${Nouns[randomLastName]}_${dateString}`;
};

export const classifyPipeLines = (pipelinesToClassify, arrayOfBranches, dataPipelines) => {
  const pipelinesClassified = pipelinesToClassify.filter((pipe) => pipe.status !== SKIPPED);
  const infoPipelinesComplemented = arrayOfBranches.map((branch) => {
    const pipeBranch = pipelinesClassified.filter((pipe) => pipe.ref === branch.name)[0];
    const backendPipeline = dataPipelines
      .filter((pipe) => pipeBranch?.ref.includes(pipe.name))[0];
    if (pipeBranch && backendPipeline) {
      return {
        id: pipeBranch.id,
        status: pipeBranch.status,
        name: branch.name,
        authorName: branch.commit.author_name,
        createdAt: branch.commit.created_at,
        commit: branch.commit,
        backendPipeline,
      };
    }

    return null;
  }).filter((pipeline) => pipeline !== null);
  return [
    {
      status: RUNNING,
      values: infoPipelinesComplemented
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((exp) => exp.status === RUNNING.toLowerCase() || exp.status === PENDING.toLowerCase()),
    },
    {
      status: SUCCESS,
      values: infoPipelinesComplemented
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((exp) => exp.status === SUCCESS.toLowerCase()),
    },
    {
      status: CANCELED,
      values: infoPipelinesComplemented
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((exp) => exp.status === CANCELED.toLowerCase()),
    },
    {
      status: FAILED,
      values: infoPipelinesComplemented
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((exp) => exp.status === FAILED.toLowerCase()),
    },
    {
      status: EXPIRED,
      values: infoPipelinesComplemented
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .filter((exp) => exp.status === EXPIRED.toLowerCase()),
    },
  ];
};

/* ----------------------------  ----------------------------------  -------------------------------*/

const sortingByDateFunc = (a, b) => new Date(b.pipelineJobInfo.createdAt) - new Date(a.pipelineJobInfo.createdAt);

/**
 *
 * @param {*}  experiments: unsorted experiments
 */
export const classifyExperiments = (experiments) => [
  {
    status: RUNNING,
    values: experiments
      .sort(sortingByDateFunc)
      .filter((exp) => exp.status === RUNNING || exp.status === PENDING),
  },
  {
    status: SUCCESS,
    values: experiments
      .sort(sortingByDateFunc)
      .filter((exp) => exp.status === SUCCESS),
  },
  {
    status: CANCELED,
    values: experiments
      .sort(sortingByDateFunc)
      .filter((exp) => exp.status === CANCELED),
  },
  {
    status: FAILED,
    values: experiments
      .sort(sortingByDateFunc)
      .filter((exp) => exp.status === FAILED),
  },
  {
    status: EXPIRED,
    values: experiments
      .sort(sortingByDateFunc)
      .filter((exp) => exp.status === EXPIRED),
  },
];

export const getPipelineIcon = (status) => {
  let pipelineIcon = Attention;
  if (status === RUNNING || status === PENDING) pipelineIcon = Loading;
  else if (status === SUCCESS) pipelineIcon = Success;
  else if (status === FAILED) pipelineIcon = Fail;

  return pipelineIcon;
};

export const getInfoFromStatus = (pipelineStatus) => {
  let statusTitle = pipelineStatus;
  let statusColor = '';
  switch (pipelineStatus) {
    case RUNNING:
      statusTitle = 'In progress';
      statusColor = 'success';
      break;
    case SUCCESS:
      statusTitle = 'Success';
      statusColor = 'success';
      break;
    case PENDING:
      statusTitle = 'In progress';
      statusColor = 'warning';
      break;
    case FAILED:
      statusTitle = 'Failed';
      statusColor = 'danger';
      break;
    case CANCELED:
      statusTitle = 'Canceled';
      statusColor = 'danger';
      break;
    default:
      return 'lessWhite';
  }

  return { statusTitle, statusColor };
};

export const filterPipelinesOnStatus = (e, allPipelines) => {
  let filteredInstances = allPipelines;
  if (e) {
    e.target.parentNode.childNodes.forEach((childNode) => {
      if (childNode.id !== e.target.id) {
        childNode.classList.remove('active');
      }
    });
    e.target.classList.add('active');

    if (e.target.id === 'InProgress') {
      filteredInstances = allPipelines.filter((exp) => exp.status === RUNNING);
    } else if (e.target.id === 'Success') {
      filteredInstances = allPipelines.filter((exp) => exp.status === SUCCESS);
    } else if (e.target.id === 'Failed') {
      filteredInstances = allPipelines.filter((exp) => exp.status === FAILED);
    } else if (e.target.id === 'Canceled') {
      filteredInstances = allPipelines.filter((exp) => exp.status === CANCELED);
    }
  }
  return filteredInstances;
};

export const determineJobClass = (type) => {
  let jobClass = 'experiment';
  if (type === 'DATA') jobClass = 'data-ops';
  else if (type === 'VISUALIZATION') jobClass = 'visualization';

  return jobClass;
};

export const goToPipelineView = ({
  backendPipeline,
  setPreconfOps,
  selectedProject,
  history,
  routeType,
}) => {
  const { dataOperations, inputFiles } = backendPipeline;
  const { namespace, slug } = selectedProject;
  const configuredOperations = {
    dataOperatorsExecuted: dataOperations,
    inputFiles,
    pipelineBackendId: backendPipeline.id,
  };
  setPreconfOps(configuredOperations);
  history.push(`/${namespace}/${slug}/-${routeType}`);
};

/* ----------------------------  ----------------------------------  -------------------------------*/
