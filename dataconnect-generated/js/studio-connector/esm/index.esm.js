import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'studio-connector',
  service: 'fikr-apps-service',
  location: 'us-central1'
};

export const listProjectsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListProjects', inputVars);
}
listProjectsRef.operationName = 'ListProjects';

export function listProjects(dcOrVars, vars) {
  return executeQuery(listProjectsRef(dcOrVars, vars));
}

export const createProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateProject', inputVars);
}
createProjectRef.operationName = 'CreateProject';

export function createProject(dcOrVars, vars) {
  return executeMutation(createProjectRef(dcOrVars, vars));
}

export const renameProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RenameProject', inputVars);
}
renameProjectRef.operationName = 'RenameProject';

export function renameProject(dcOrVars, vars) {
  return executeMutation(renameProjectRef(dcOrVars, vars));
}

export const archiveProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ArchiveProject', inputVars);
}
archiveProjectRef.operationName = 'ArchiveProject';

export function archiveProject(dcOrVars, vars) {
  return executeMutation(archiveProjectRef(dcOrVars, vars));
}

export const getProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetProject', inputVars);
}
getProjectRef.operationName = 'GetProject';

export function getProject(dcOrVars, vars) {
  return executeQuery(getProjectRef(dcOrVars, vars));
}

export const getNotesByProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotesByProject', inputVars);
}
getNotesByProjectRef.operationName = 'GetNotesByProject';

export function getNotesByProject(dcOrVars, vars) {
  return executeQuery(getNotesByProjectRef(dcOrVars, vars));
}

export const getGhostNotesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGhostNotes', inputVars);
}
getGhostNotesRef.operationName = 'GetGhostNotes';

export function getGhostNotes(dcOrVars, vars) {
  return executeQuery(getGhostNotesRef(dcOrVars, vars));
}

export const createNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNote', inputVars);
}
createNoteRef.operationName = 'CreateNote';

export function createNote(dcOrVars, vars) {
  return executeMutation(createNoteRef(dcOrVars, vars));
}

export const updateNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateNote', inputVars);
}
updateNoteRef.operationName = 'UpdateNote';

export function updateNote(dcOrVars, vars) {
  return executeMutation(updateNoteRef(dcOrVars, vars));
}

export const deleteNoteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteNote', inputVars);
}
deleteNoteRef.operationName = 'DeleteNote';

export function deleteNote(dcOrVars, vars) {
  return executeMutation(deleteNoteRef(dcOrVars, vars));
}

export const setNoteCollapsedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SetNoteCollapsed', inputVars);
}
setNoteCollapsedRef.operationName = 'SetNoteCollapsed';

export function setNoteCollapsed(dcOrVars, vars) {
  return executeMutation(setNoteCollapsedRef(dcOrVars, vars));
}

export const deleteNotesByProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteNotesByProject', inputVars);
}
deleteNotesByProjectRef.operationName = 'DeleteNotesByProject';

export function deleteNotesByProject(dcOrVars, vars) {
  return executeMutation(deleteNotesByProjectRef(dcOrVars, vars));
}

