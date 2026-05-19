import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface ArchiveProjectData {
  studioProject_update?: StudioProject_Key | null;
}

export interface ArchiveProjectVariables {
  id: UUIDString;
}

export interface CreateNoteData {
  studioNote_insert: StudioNote_Key;
}

export interface CreateNoteVariables {
  projectId: UUIDString;
  userId: string;
  text: string;
  contentType?: string | null;
  category?: string | null;
  annotation?: string | null;
  confidence?: number | null;
  isEnriching?: boolean | null;
  isGhostNote?: boolean | null;
  fromMcp?: boolean | null;
  fromSkill?: boolean | null;
}

export interface CreateProjectData {
  studioProject_insert: StudioProject_Key;
}

export interface CreateProjectVariables {
  userId: string;
  name: string;
}

export interface DeleteNoteData {
  studioNote_delete?: StudioNote_Key | null;
}

export interface DeleteNoteVariables {
  id: UUIDString;
}

export interface DeleteNotesByProjectData {
  studioNote_deleteMany: number;
}

export interface DeleteNotesByProjectVariables {
  projectId: UUIDString;
}

export interface GetGhostNotesData {
  studioNotes: ({
    id: UUIDString;
    text: string;
    contentType?: string | null;
    category?: string | null;
    annotation?: string | null;
    confidence?: number | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioNote_Key)[];
}

export interface GetGhostNotesVariables {
  projectId: UUIDString;
}

export interface GetNotesByProjectData {
  studioNotes: ({
    id: UUIDString;
    text: string;
    contentType?: string | null;
    category?: string | null;
    annotation?: string | null;
    confidence?: number | null;
    isEnriching: boolean;
    isError: boolean;
    fromMcp: boolean;
    fromSkill: boolean;
    collapsedInProject: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioNote_Key)[];
}

export interface GetNotesByProjectVariables {
  projectId: UUIDString;
}

export interface GetProjectData {
  studioProject?: {
    id: UUIDString;
    name: string;
    userId: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioProject_Key;
}

export interface GetProjectVariables {
  id: UUIDString;
}

export interface ListProjectsData {
  studioProjects: ({
    id: UUIDString;
    name: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioProject_Key)[];
}

export interface ListProjectsVariables {
  userId: string;
}

export interface RenameProjectData {
  studioProject_update?: StudioProject_Key | null;
}

export interface RenameProjectVariables {
  id: UUIDString;
  name: string;
}

export interface SetNoteCollapsedData {
  studioNote_update?: StudioNote_Key | null;
}

export interface SetNoteCollapsedVariables {
  id: UUIDString;
  collapsed: boolean;
}

export interface StudioNote_Key {
  id: UUIDString;
  __typename?: 'StudioNote_Key';
}

export interface StudioProject_Key {
  id: UUIDString;
  __typename?: 'StudioProject_Key';
}

export interface UpdateNoteData {
  studioNote_update?: StudioNote_Key | null;
}

export interface UpdateNoteVariables {
  id: UUIDString;
  text: string;
  contentType?: string | null;
  category?: string | null;
  annotation?: string | null;
  confidence?: number | null;
  isEnriching?: boolean | null;
  isError?: boolean | null;
}

interface ListProjectsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListProjectsVariables): QueryRef<ListProjectsData, ListProjectsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListProjectsVariables): QueryRef<ListProjectsData, ListProjectsVariables>;
  operationName: string;
}
export const listProjectsRef: ListProjectsRef;

export function listProjects(vars: ListProjectsVariables): QueryPromise<ListProjectsData, ListProjectsVariables>;
export function listProjects(dc: DataConnect, vars: ListProjectsVariables): QueryPromise<ListProjectsData, ListProjectsVariables>;

interface CreateProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateProjectVariables): MutationRef<CreateProjectData, CreateProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateProjectVariables): MutationRef<CreateProjectData, CreateProjectVariables>;
  operationName: string;
}
export const createProjectRef: CreateProjectRef;

export function createProject(vars: CreateProjectVariables): MutationPromise<CreateProjectData, CreateProjectVariables>;
export function createProject(dc: DataConnect, vars: CreateProjectVariables): MutationPromise<CreateProjectData, CreateProjectVariables>;

interface RenameProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RenameProjectVariables): MutationRef<RenameProjectData, RenameProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RenameProjectVariables): MutationRef<RenameProjectData, RenameProjectVariables>;
  operationName: string;
}
export const renameProjectRef: RenameProjectRef;

export function renameProject(vars: RenameProjectVariables): MutationPromise<RenameProjectData, RenameProjectVariables>;
export function renameProject(dc: DataConnect, vars: RenameProjectVariables): MutationPromise<RenameProjectData, RenameProjectVariables>;

interface ArchiveProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ArchiveProjectVariables): MutationRef<ArchiveProjectData, ArchiveProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ArchiveProjectVariables): MutationRef<ArchiveProjectData, ArchiveProjectVariables>;
  operationName: string;
}
export const archiveProjectRef: ArchiveProjectRef;

export function archiveProject(vars: ArchiveProjectVariables): MutationPromise<ArchiveProjectData, ArchiveProjectVariables>;
export function archiveProject(dc: DataConnect, vars: ArchiveProjectVariables): MutationPromise<ArchiveProjectData, ArchiveProjectVariables>;

interface GetProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
  operationName: string;
}
export const getProjectRef: GetProjectRef;

export function getProject(vars: GetProjectVariables): QueryPromise<GetProjectData, GetProjectVariables>;
export function getProject(dc: DataConnect, vars: GetProjectVariables): QueryPromise<GetProjectData, GetProjectVariables>;

interface GetNotesByProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotesByProjectVariables): QueryRef<GetNotesByProjectData, GetNotesByProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetNotesByProjectVariables): QueryRef<GetNotesByProjectData, GetNotesByProjectVariables>;
  operationName: string;
}
export const getNotesByProjectRef: GetNotesByProjectRef;

export function getNotesByProject(vars: GetNotesByProjectVariables): QueryPromise<GetNotesByProjectData, GetNotesByProjectVariables>;
export function getNotesByProject(dc: DataConnect, vars: GetNotesByProjectVariables): QueryPromise<GetNotesByProjectData, GetNotesByProjectVariables>;

interface GetGhostNotesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGhostNotesVariables): QueryRef<GetGhostNotesData, GetGhostNotesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetGhostNotesVariables): QueryRef<GetGhostNotesData, GetGhostNotesVariables>;
  operationName: string;
}
export const getGhostNotesRef: GetGhostNotesRef;

export function getGhostNotes(vars: GetGhostNotesVariables): QueryPromise<GetGhostNotesData, GetGhostNotesVariables>;
export function getGhostNotes(dc: DataConnect, vars: GetGhostNotesVariables): QueryPromise<GetGhostNotesData, GetGhostNotesVariables>;

interface CreateNoteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNoteVariables): MutationRef<CreateNoteData, CreateNoteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNoteVariables): MutationRef<CreateNoteData, CreateNoteVariables>;
  operationName: string;
}
export const createNoteRef: CreateNoteRef;

export function createNote(vars: CreateNoteVariables): MutationPromise<CreateNoteData, CreateNoteVariables>;
export function createNote(dc: DataConnect, vars: CreateNoteVariables): MutationPromise<CreateNoteData, CreateNoteVariables>;

interface UpdateNoteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNoteVariables): MutationRef<UpdateNoteData, UpdateNoteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateNoteVariables): MutationRef<UpdateNoteData, UpdateNoteVariables>;
  operationName: string;
}
export const updateNoteRef: UpdateNoteRef;

export function updateNote(vars: UpdateNoteVariables): MutationPromise<UpdateNoteData, UpdateNoteVariables>;
export function updateNote(dc: DataConnect, vars: UpdateNoteVariables): MutationPromise<UpdateNoteData, UpdateNoteVariables>;

interface DeleteNoteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteNoteVariables): MutationRef<DeleteNoteData, DeleteNoteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteNoteVariables): MutationRef<DeleteNoteData, DeleteNoteVariables>;
  operationName: string;
}
export const deleteNoteRef: DeleteNoteRef;

export function deleteNote(vars: DeleteNoteVariables): MutationPromise<DeleteNoteData, DeleteNoteVariables>;
export function deleteNote(dc: DataConnect, vars: DeleteNoteVariables): MutationPromise<DeleteNoteData, DeleteNoteVariables>;

interface SetNoteCollapsedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SetNoteCollapsedVariables): MutationRef<SetNoteCollapsedData, SetNoteCollapsedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SetNoteCollapsedVariables): MutationRef<SetNoteCollapsedData, SetNoteCollapsedVariables>;
  operationName: string;
}
export const setNoteCollapsedRef: SetNoteCollapsedRef;

export function setNoteCollapsed(vars: SetNoteCollapsedVariables): MutationPromise<SetNoteCollapsedData, SetNoteCollapsedVariables>;
export function setNoteCollapsed(dc: DataConnect, vars: SetNoteCollapsedVariables): MutationPromise<SetNoteCollapsedData, SetNoteCollapsedVariables>;

interface DeleteNotesByProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteNotesByProjectVariables): MutationRef<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteNotesByProjectVariables): MutationRef<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;
  operationName: string;
}
export const deleteNotesByProjectRef: DeleteNotesByProjectRef;

export function deleteNotesByProject(vars: DeleteNotesByProjectVariables): MutationPromise<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;
export function deleteNotesByProject(dc: DataConnect, vars: DeleteNotesByProjectVariables): MutationPromise<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;

