const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'studio-connector',
  service: 'fikr-apps-service',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const listProjectsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListProjects', inputVars);
}
listProjectsRef.operationName = 'ListProjects';
exports.listProjectsRef = listProjectsRef;

exports.listProjects = function listProjects(dcOrVars, vars) {
  return executeQuery(listProjectsRef(dcOrVars, vars));
};

const createProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateProject', inputVars);
}
createProjectRef.operationName = 'CreateProject';
exports.createProjectRef = createProjectRef;

exports.createProject = function createProject(dcOrVars, vars) {
  return executeMutation(createProjectRef(dcOrVars, vars));
};

const renameProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RenameProject', inputVars);
}
renameProjectRef.operationName = 'RenameProject';
exports.renameProjectRef = renameProjectRef;

exports.renameProject = function renameProject(dcOrVars, vars) {
  return executeMutation(renameProjectRef(dcOrVars, vars));
};

const archiveProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ArchiveProject', inputVars);
}
archiveProjectRef.operationName = 'ArchiveProject';
exports.archiveProjectRef = archiveProjectRef;

exports.archiveProject = function archiveProject(dcOrVars, vars) {
  return executeMutation(archiveProjectRef(dcOrVars, vars));
};

const getProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetProject', inputVars);
}
getProjectRef.operationName = 'GetProject';
exports.getProjectRef = getProjectRef;

exports.getProject = function getProject(dcOrVars, vars) {
  return executeQuery(getProjectRef(dcOrVars, vars));
};

const getNotesByProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotesByProject', inputVars);
}
getNotesByProjectRef.operationName = 'GetNotesByProject';
exports.getNotesByProjectRef = getNotesByProjectRef;

exports.getNotesByProject = function getNotesByProject(dcOrVars, vars) {
  return executeQuery(getNotesByProjectRef(dcOrVars, vars));
};

const getGhostNotesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGhostNotes', inputVars);
}
getGhostNotesRef.operationName = 'GetGhostNotes';
exports.getGhostNotesRef = getGhostNotesRef;

exports.getGhostNotes = function getGhostNotes(dcOrVars, vars) {
  return executeQuery(getGhostNotesRef(dcOrVars, vars));
};

const createNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNote', inputVars);
}
createNoteRef.operationName = 'CreateNote';
exports.createNoteRef = createNoteRef;

exports.createNote = function createNote(dcOrVars, vars) {
  return executeMutation(createNoteRef(dcOrVars, vars));
};

const updateNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateNote', inputVars);
}
updateNoteRef.operationName = 'UpdateNote';
exports.updateNoteRef = updateNoteRef;

exports.updateNote = function updateNote(dcOrVars, vars) {
  return executeMutation(updateNoteRef(dcOrVars, vars));
};

const deleteNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteNote', inputVars);
}
deleteNoteRef.operationName = 'DeleteNote';
exports.deleteNoteRef = deleteNoteRef;

exports.deleteNote = function deleteNote(dcOrVars, vars) {
  return executeMutation(deleteNoteRef(dcOrVars, vars));
};

const setNoteCollapsedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SetNoteCollapsed', inputVars);
}
setNoteCollapsedRef.operationName = 'SetNoteCollapsed';
exports.setNoteCollapsedRef = setNoteCollapsedRef;

exports.setNoteCollapsed = function setNoteCollapsed(dcOrVars, vars) {
  return executeMutation(setNoteCollapsedRef(dcOrVars, vars));
};

const deleteNotesByProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteNotesByProject', inputVars);
}
deleteNotesByProjectRef.operationName = 'DeleteNotesByProject';
exports.deleteNotesByProjectRef = deleteNotesByProjectRef;

exports.deleteNotesByProject = function deleteNotesByProject(dcOrVars, vars) {
  return executeMutation(deleteNotesByProjectRef(dcOrVars, vars));
};
