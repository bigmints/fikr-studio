# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `studio-connector`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListProjects*](#listprojects)
  - [*GetProject*](#getproject)
  - [*GetNotesByProject*](#getnotesbyproject)
  - [*GetGhostNotes*](#getghostnotes)
- [**Mutations**](#mutations)
  - [*CreateProject*](#createproject)
  - [*RenameProject*](#renameproject)
  - [*ArchiveProject*](#archiveproject)
  - [*CreateNote*](#createnote)
  - [*UpdateNote*](#updatenote)
  - [*DeleteNote*](#deletenote)
  - [*SetNoteCollapsed*](#setnotecollapsed)
  - [*DeleteNotesByProject*](#deletenotesbyproject)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `studio-connector`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@studio-connector/default` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@studio-connector/default';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@studio-connector/default';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `studio-connector` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListProjects
You can execute the `ListProjects` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
listProjects(vars: ListProjectsVariables): QueryPromise<ListProjectsData, ListProjectsVariables>;

interface ListProjectsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListProjectsVariables): QueryRef<ListProjectsData, ListProjectsVariables>;
}
export const listProjectsRef: ListProjectsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listProjects(dc: DataConnect, vars: ListProjectsVariables): QueryPromise<ListProjectsData, ListProjectsVariables>;

interface ListProjectsRef {
  ...
  (dc: DataConnect, vars: ListProjectsVariables): QueryRef<ListProjectsData, ListProjectsVariables>;
}
export const listProjectsRef: ListProjectsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listProjectsRef:
```typescript
const name = listProjectsRef.operationName;
console.log(name);
```

### Variables
The `ListProjects` query requires an argument of type `ListProjectsVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListProjectsVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `ListProjects` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListProjectsData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListProjectsData {
  studioProjects: ({
    id: UUIDString;
    name: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioProject_Key)[];
}
```
### Using `ListProjects`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listProjects, ListProjectsVariables } from '@studio-connector/default';

// The `ListProjects` query requires an argument of type `ListProjectsVariables`:
const listProjectsVars: ListProjectsVariables = {
  userId: ..., 
};

// Call the `listProjects()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listProjects(listProjectsVars);
// Variables can be defined inline as well.
const { data } = await listProjects({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listProjects(dataConnect, listProjectsVars);

console.log(data.studioProjects);

// Or, you can use the `Promise` API.
listProjects(listProjectsVars).then((response) => {
  const data = response.data;
  console.log(data.studioProjects);
});
```

### Using `ListProjects`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listProjectsRef, ListProjectsVariables } from '@studio-connector/default';

// The `ListProjects` query requires an argument of type `ListProjectsVariables`:
const listProjectsVars: ListProjectsVariables = {
  userId: ..., 
};

// Call the `listProjectsRef()` function to get a reference to the query.
const ref = listProjectsRef(listProjectsVars);
// Variables can be defined inline as well.
const ref = listProjectsRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listProjectsRef(dataConnect, listProjectsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.studioProjects);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.studioProjects);
});
```

## GetProject
You can execute the `GetProject` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
getProject(vars: GetProjectVariables): QueryPromise<GetProjectData, GetProjectVariables>;

interface GetProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
}
export const getProjectRef: GetProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getProject(dc: DataConnect, vars: GetProjectVariables): QueryPromise<GetProjectData, GetProjectVariables>;

interface GetProjectRef {
  ...
  (dc: DataConnect, vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
}
export const getProjectRef: GetProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getProjectRef:
```typescript
const name = getProjectRef.operationName;
console.log(name);
```

### Variables
The `GetProject` query requires an argument of type `GetProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetProjectVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetProject` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetProjectData {
  studioProject?: {
    id: UUIDString;
    name: string;
    userId: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & StudioProject_Key;
}
```
### Using `GetProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getProject, GetProjectVariables } from '@studio-connector/default';

// The `GetProject` query requires an argument of type `GetProjectVariables`:
const getProjectVars: GetProjectVariables = {
  id: ..., 
};

// Call the `getProject()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getProject(getProjectVars);
// Variables can be defined inline as well.
const { data } = await getProject({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getProject(dataConnect, getProjectVars);

console.log(data.studioProject);

// Or, you can use the `Promise` API.
getProject(getProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioProject);
});
```

### Using `GetProject`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getProjectRef, GetProjectVariables } from '@studio-connector/default';

// The `GetProject` query requires an argument of type `GetProjectVariables`:
const getProjectVars: GetProjectVariables = {
  id: ..., 
};

// Call the `getProjectRef()` function to get a reference to the query.
const ref = getProjectRef(getProjectVars);
// Variables can be defined inline as well.
const ref = getProjectRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getProjectRef(dataConnect, getProjectVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.studioProject);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.studioProject);
});
```

## GetNotesByProject
You can execute the `GetNotesByProject` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
getNotesByProject(vars: GetNotesByProjectVariables): QueryPromise<GetNotesByProjectData, GetNotesByProjectVariables>;

interface GetNotesByProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotesByProjectVariables): QueryRef<GetNotesByProjectData, GetNotesByProjectVariables>;
}
export const getNotesByProjectRef: GetNotesByProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getNotesByProject(dc: DataConnect, vars: GetNotesByProjectVariables): QueryPromise<GetNotesByProjectData, GetNotesByProjectVariables>;

interface GetNotesByProjectRef {
  ...
  (dc: DataConnect, vars: GetNotesByProjectVariables): QueryRef<GetNotesByProjectData, GetNotesByProjectVariables>;
}
export const getNotesByProjectRef: GetNotesByProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getNotesByProjectRef:
```typescript
const name = getNotesByProjectRef.operationName;
console.log(name);
```

### Variables
The `GetNotesByProject` query requires an argument of type `GetNotesByProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetNotesByProjectVariables {
  projectId: UUIDString;
}
```
### Return Type
Recall that executing the `GetNotesByProject` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetNotesByProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetNotesByProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getNotesByProject, GetNotesByProjectVariables } from '@studio-connector/default';

// The `GetNotesByProject` query requires an argument of type `GetNotesByProjectVariables`:
const getNotesByProjectVars: GetNotesByProjectVariables = {
  projectId: ..., 
};

// Call the `getNotesByProject()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getNotesByProject(getNotesByProjectVars);
// Variables can be defined inline as well.
const { data } = await getNotesByProject({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getNotesByProject(dataConnect, getNotesByProjectVars);

console.log(data.studioNotes);

// Or, you can use the `Promise` API.
getNotesByProject(getNotesByProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioNotes);
});
```

### Using `GetNotesByProject`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getNotesByProjectRef, GetNotesByProjectVariables } from '@studio-connector/default';

// The `GetNotesByProject` query requires an argument of type `GetNotesByProjectVariables`:
const getNotesByProjectVars: GetNotesByProjectVariables = {
  projectId: ..., 
};

// Call the `getNotesByProjectRef()` function to get a reference to the query.
const ref = getNotesByProjectRef(getNotesByProjectVars);
// Variables can be defined inline as well.
const ref = getNotesByProjectRef({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getNotesByProjectRef(dataConnect, getNotesByProjectVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.studioNotes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNotes);
});
```

## GetGhostNotes
You can execute the `GetGhostNotes` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
getGhostNotes(vars: GetGhostNotesVariables): QueryPromise<GetGhostNotesData, GetGhostNotesVariables>;

interface GetGhostNotesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGhostNotesVariables): QueryRef<GetGhostNotesData, GetGhostNotesVariables>;
}
export const getGhostNotesRef: GetGhostNotesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getGhostNotes(dc: DataConnect, vars: GetGhostNotesVariables): QueryPromise<GetGhostNotesData, GetGhostNotesVariables>;

interface GetGhostNotesRef {
  ...
  (dc: DataConnect, vars: GetGhostNotesVariables): QueryRef<GetGhostNotesData, GetGhostNotesVariables>;
}
export const getGhostNotesRef: GetGhostNotesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getGhostNotesRef:
```typescript
const name = getGhostNotesRef.operationName;
console.log(name);
```

### Variables
The `GetGhostNotes` query requires an argument of type `GetGhostNotesVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetGhostNotesVariables {
  projectId: UUIDString;
}
```
### Return Type
Recall that executing the `GetGhostNotes` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetGhostNotesData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetGhostNotes`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getGhostNotes, GetGhostNotesVariables } from '@studio-connector/default';

// The `GetGhostNotes` query requires an argument of type `GetGhostNotesVariables`:
const getGhostNotesVars: GetGhostNotesVariables = {
  projectId: ..., 
};

// Call the `getGhostNotes()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getGhostNotes(getGhostNotesVars);
// Variables can be defined inline as well.
const { data } = await getGhostNotes({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getGhostNotes(dataConnect, getGhostNotesVars);

console.log(data.studioNotes);

// Or, you can use the `Promise` API.
getGhostNotes(getGhostNotesVars).then((response) => {
  const data = response.data;
  console.log(data.studioNotes);
});
```

### Using `GetGhostNotes`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getGhostNotesRef, GetGhostNotesVariables } from '@studio-connector/default';

// The `GetGhostNotes` query requires an argument of type `GetGhostNotesVariables`:
const getGhostNotesVars: GetGhostNotesVariables = {
  projectId: ..., 
};

// Call the `getGhostNotesRef()` function to get a reference to the query.
const ref = getGhostNotesRef(getGhostNotesVars);
// Variables can be defined inline as well.
const ref = getGhostNotesRef({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getGhostNotesRef(dataConnect, getGhostNotesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.studioNotes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNotes);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `studio-connector` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateProject
You can execute the `CreateProject` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
createProject(vars: CreateProjectVariables): MutationPromise<CreateProjectData, CreateProjectVariables>;

interface CreateProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateProjectVariables): MutationRef<CreateProjectData, CreateProjectVariables>;
}
export const createProjectRef: CreateProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createProject(dc: DataConnect, vars: CreateProjectVariables): MutationPromise<CreateProjectData, CreateProjectVariables>;

interface CreateProjectRef {
  ...
  (dc: DataConnect, vars: CreateProjectVariables): MutationRef<CreateProjectData, CreateProjectVariables>;
}
export const createProjectRef: CreateProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createProjectRef:
```typescript
const name = createProjectRef.operationName;
console.log(name);
```

### Variables
The `CreateProject` mutation requires an argument of type `CreateProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateProjectVariables {
  userId: string;
  name: string;
}
```
### Return Type
Recall that executing the `CreateProject` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateProjectData {
  studioProject_insert: StudioProject_Key;
}
```
### Using `CreateProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createProject, CreateProjectVariables } from '@studio-connector/default';

// The `CreateProject` mutation requires an argument of type `CreateProjectVariables`:
const createProjectVars: CreateProjectVariables = {
  userId: ..., 
  name: ..., 
};

// Call the `createProject()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createProject(createProjectVars);
// Variables can be defined inline as well.
const { data } = await createProject({ userId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createProject(dataConnect, createProjectVars);

console.log(data.studioProject_insert);

// Or, you can use the `Promise` API.
createProject(createProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioProject_insert);
});
```

### Using `CreateProject`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createProjectRef, CreateProjectVariables } from '@studio-connector/default';

// The `CreateProject` mutation requires an argument of type `CreateProjectVariables`:
const createProjectVars: CreateProjectVariables = {
  userId: ..., 
  name: ..., 
};

// Call the `createProjectRef()` function to get a reference to the mutation.
const ref = createProjectRef(createProjectVars);
// Variables can be defined inline as well.
const ref = createProjectRef({ userId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createProjectRef(dataConnect, createProjectVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioProject_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioProject_insert);
});
```

## RenameProject
You can execute the `RenameProject` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
renameProject(vars: RenameProjectVariables): MutationPromise<RenameProjectData, RenameProjectVariables>;

interface RenameProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RenameProjectVariables): MutationRef<RenameProjectData, RenameProjectVariables>;
}
export const renameProjectRef: RenameProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
renameProject(dc: DataConnect, vars: RenameProjectVariables): MutationPromise<RenameProjectData, RenameProjectVariables>;

interface RenameProjectRef {
  ...
  (dc: DataConnect, vars: RenameProjectVariables): MutationRef<RenameProjectData, RenameProjectVariables>;
}
export const renameProjectRef: RenameProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the renameProjectRef:
```typescript
const name = renameProjectRef.operationName;
console.log(name);
```

### Variables
The `RenameProject` mutation requires an argument of type `RenameProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RenameProjectVariables {
  id: UUIDString;
  name: string;
}
```
### Return Type
Recall that executing the `RenameProject` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RenameProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RenameProjectData {
  studioProject_update?: StudioProject_Key | null;
}
```
### Using `RenameProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, renameProject, RenameProjectVariables } from '@studio-connector/default';

// The `RenameProject` mutation requires an argument of type `RenameProjectVariables`:
const renameProjectVars: RenameProjectVariables = {
  id: ..., 
  name: ..., 
};

// Call the `renameProject()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await renameProject(renameProjectVars);
// Variables can be defined inline as well.
const { data } = await renameProject({ id: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await renameProject(dataConnect, renameProjectVars);

console.log(data.studioProject_update);

// Or, you can use the `Promise` API.
renameProject(renameProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioProject_update);
});
```

### Using `RenameProject`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, renameProjectRef, RenameProjectVariables } from '@studio-connector/default';

// The `RenameProject` mutation requires an argument of type `RenameProjectVariables`:
const renameProjectVars: RenameProjectVariables = {
  id: ..., 
  name: ..., 
};

// Call the `renameProjectRef()` function to get a reference to the mutation.
const ref = renameProjectRef(renameProjectVars);
// Variables can be defined inline as well.
const ref = renameProjectRef({ id: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = renameProjectRef(dataConnect, renameProjectVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioProject_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioProject_update);
});
```

## ArchiveProject
You can execute the `ArchiveProject` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
archiveProject(vars: ArchiveProjectVariables): MutationPromise<ArchiveProjectData, ArchiveProjectVariables>;

interface ArchiveProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ArchiveProjectVariables): MutationRef<ArchiveProjectData, ArchiveProjectVariables>;
}
export const archiveProjectRef: ArchiveProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
archiveProject(dc: DataConnect, vars: ArchiveProjectVariables): MutationPromise<ArchiveProjectData, ArchiveProjectVariables>;

interface ArchiveProjectRef {
  ...
  (dc: DataConnect, vars: ArchiveProjectVariables): MutationRef<ArchiveProjectData, ArchiveProjectVariables>;
}
export const archiveProjectRef: ArchiveProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the archiveProjectRef:
```typescript
const name = archiveProjectRef.operationName;
console.log(name);
```

### Variables
The `ArchiveProject` mutation requires an argument of type `ArchiveProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ArchiveProjectVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `ArchiveProject` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ArchiveProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ArchiveProjectData {
  studioProject_update?: StudioProject_Key | null;
}
```
### Using `ArchiveProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, archiveProject, ArchiveProjectVariables } from '@studio-connector/default';

// The `ArchiveProject` mutation requires an argument of type `ArchiveProjectVariables`:
const archiveProjectVars: ArchiveProjectVariables = {
  id: ..., 
};

// Call the `archiveProject()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await archiveProject(archiveProjectVars);
// Variables can be defined inline as well.
const { data } = await archiveProject({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await archiveProject(dataConnect, archiveProjectVars);

console.log(data.studioProject_update);

// Or, you can use the `Promise` API.
archiveProject(archiveProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioProject_update);
});
```

### Using `ArchiveProject`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, archiveProjectRef, ArchiveProjectVariables } from '@studio-connector/default';

// The `ArchiveProject` mutation requires an argument of type `ArchiveProjectVariables`:
const archiveProjectVars: ArchiveProjectVariables = {
  id: ..., 
};

// Call the `archiveProjectRef()` function to get a reference to the mutation.
const ref = archiveProjectRef(archiveProjectVars);
// Variables can be defined inline as well.
const ref = archiveProjectRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = archiveProjectRef(dataConnect, archiveProjectVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioProject_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioProject_update);
});
```

## CreateNote
You can execute the `CreateNote` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
createNote(vars: CreateNoteVariables): MutationPromise<CreateNoteData, CreateNoteVariables>;

interface CreateNoteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNoteVariables): MutationRef<CreateNoteData, CreateNoteVariables>;
}
export const createNoteRef: CreateNoteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNote(dc: DataConnect, vars: CreateNoteVariables): MutationPromise<CreateNoteData, CreateNoteVariables>;

interface CreateNoteRef {
  ...
  (dc: DataConnect, vars: CreateNoteVariables): MutationRef<CreateNoteData, CreateNoteVariables>;
}
export const createNoteRef: CreateNoteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNoteRef:
```typescript
const name = createNoteRef.operationName;
console.log(name);
```

### Variables
The `CreateNote` mutation requires an argument of type `CreateNoteVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateNote` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNoteData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNoteData {
  studioNote_insert: StudioNote_Key;
}
```
### Using `CreateNote`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNote, CreateNoteVariables } from '@studio-connector/default';

// The `CreateNote` mutation requires an argument of type `CreateNoteVariables`:
const createNoteVars: CreateNoteVariables = {
  projectId: ..., 
  userId: ..., 
  text: ..., 
  contentType: ..., // optional
  category: ..., // optional
  annotation: ..., // optional
  confidence: ..., // optional
  isEnriching: ..., // optional
  isGhostNote: ..., // optional
  fromMcp: ..., // optional
  fromSkill: ..., // optional
};

// Call the `createNote()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNote(createNoteVars);
// Variables can be defined inline as well.
const { data } = await createNote({ projectId: ..., userId: ..., text: ..., contentType: ..., category: ..., annotation: ..., confidence: ..., isEnriching: ..., isGhostNote: ..., fromMcp: ..., fromSkill: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNote(dataConnect, createNoteVars);

console.log(data.studioNote_insert);

// Or, you can use the `Promise` API.
createNote(createNoteVars).then((response) => {
  const data = response.data;
  console.log(data.studioNote_insert);
});
```

### Using `CreateNote`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNoteRef, CreateNoteVariables } from '@studio-connector/default';

// The `CreateNote` mutation requires an argument of type `CreateNoteVariables`:
const createNoteVars: CreateNoteVariables = {
  projectId: ..., 
  userId: ..., 
  text: ..., 
  contentType: ..., // optional
  category: ..., // optional
  annotation: ..., // optional
  confidence: ..., // optional
  isEnriching: ..., // optional
  isGhostNote: ..., // optional
  fromMcp: ..., // optional
  fromSkill: ..., // optional
};

// Call the `createNoteRef()` function to get a reference to the mutation.
const ref = createNoteRef(createNoteVars);
// Variables can be defined inline as well.
const ref = createNoteRef({ projectId: ..., userId: ..., text: ..., contentType: ..., category: ..., annotation: ..., confidence: ..., isEnriching: ..., isGhostNote: ..., fromMcp: ..., fromSkill: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNoteRef(dataConnect, createNoteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioNote_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNote_insert);
});
```

## UpdateNote
You can execute the `UpdateNote` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
updateNote(vars: UpdateNoteVariables): MutationPromise<UpdateNoteData, UpdateNoteVariables>;

interface UpdateNoteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNoteVariables): MutationRef<UpdateNoteData, UpdateNoteVariables>;
}
export const updateNoteRef: UpdateNoteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateNote(dc: DataConnect, vars: UpdateNoteVariables): MutationPromise<UpdateNoteData, UpdateNoteVariables>;

interface UpdateNoteRef {
  ...
  (dc: DataConnect, vars: UpdateNoteVariables): MutationRef<UpdateNoteData, UpdateNoteVariables>;
}
export const updateNoteRef: UpdateNoteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateNoteRef:
```typescript
const name = updateNoteRef.operationName;
console.log(name);
```

### Variables
The `UpdateNote` mutation requires an argument of type `UpdateNoteVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `UpdateNote` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateNoteData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateNoteData {
  studioNote_update?: StudioNote_Key | null;
}
```
### Using `UpdateNote`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateNote, UpdateNoteVariables } from '@studio-connector/default';

// The `UpdateNote` mutation requires an argument of type `UpdateNoteVariables`:
const updateNoteVars: UpdateNoteVariables = {
  id: ..., 
  text: ..., 
  contentType: ..., // optional
  category: ..., // optional
  annotation: ..., // optional
  confidence: ..., // optional
  isEnriching: ..., // optional
  isError: ..., // optional
};

// Call the `updateNote()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateNote(updateNoteVars);
// Variables can be defined inline as well.
const { data } = await updateNote({ id: ..., text: ..., contentType: ..., category: ..., annotation: ..., confidence: ..., isEnriching: ..., isError: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateNote(dataConnect, updateNoteVars);

console.log(data.studioNote_update);

// Or, you can use the `Promise` API.
updateNote(updateNoteVars).then((response) => {
  const data = response.data;
  console.log(data.studioNote_update);
});
```

### Using `UpdateNote`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateNoteRef, UpdateNoteVariables } from '@studio-connector/default';

// The `UpdateNote` mutation requires an argument of type `UpdateNoteVariables`:
const updateNoteVars: UpdateNoteVariables = {
  id: ..., 
  text: ..., 
  contentType: ..., // optional
  category: ..., // optional
  annotation: ..., // optional
  confidence: ..., // optional
  isEnriching: ..., // optional
  isError: ..., // optional
};

// Call the `updateNoteRef()` function to get a reference to the mutation.
const ref = updateNoteRef(updateNoteVars);
// Variables can be defined inline as well.
const ref = updateNoteRef({ id: ..., text: ..., contentType: ..., category: ..., annotation: ..., confidence: ..., isEnriching: ..., isError: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateNoteRef(dataConnect, updateNoteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioNote_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNote_update);
});
```

## DeleteNote
You can execute the `DeleteNote` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
deleteNote(vars: DeleteNoteVariables): MutationPromise<DeleteNoteData, DeleteNoteVariables>;

interface DeleteNoteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteNoteVariables): MutationRef<DeleteNoteData, DeleteNoteVariables>;
}
export const deleteNoteRef: DeleteNoteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteNote(dc: DataConnect, vars: DeleteNoteVariables): MutationPromise<DeleteNoteData, DeleteNoteVariables>;

interface DeleteNoteRef {
  ...
  (dc: DataConnect, vars: DeleteNoteVariables): MutationRef<DeleteNoteData, DeleteNoteVariables>;
}
export const deleteNoteRef: DeleteNoteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteNoteRef:
```typescript
const name = deleteNoteRef.operationName;
console.log(name);
```

### Variables
The `DeleteNote` mutation requires an argument of type `DeleteNoteVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteNoteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteNote` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteNoteData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteNoteData {
  studioNote_delete?: StudioNote_Key | null;
}
```
### Using `DeleteNote`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteNote, DeleteNoteVariables } from '@studio-connector/default';

// The `DeleteNote` mutation requires an argument of type `DeleteNoteVariables`:
const deleteNoteVars: DeleteNoteVariables = {
  id: ..., 
};

// Call the `deleteNote()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteNote(deleteNoteVars);
// Variables can be defined inline as well.
const { data } = await deleteNote({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteNote(dataConnect, deleteNoteVars);

console.log(data.studioNote_delete);

// Or, you can use the `Promise` API.
deleteNote(deleteNoteVars).then((response) => {
  const data = response.data;
  console.log(data.studioNote_delete);
});
```

### Using `DeleteNote`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteNoteRef, DeleteNoteVariables } from '@studio-connector/default';

// The `DeleteNote` mutation requires an argument of type `DeleteNoteVariables`:
const deleteNoteVars: DeleteNoteVariables = {
  id: ..., 
};

// Call the `deleteNoteRef()` function to get a reference to the mutation.
const ref = deleteNoteRef(deleteNoteVars);
// Variables can be defined inline as well.
const ref = deleteNoteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteNoteRef(dataConnect, deleteNoteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioNote_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNote_delete);
});
```

## SetNoteCollapsed
You can execute the `SetNoteCollapsed` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
setNoteCollapsed(vars: SetNoteCollapsedVariables): MutationPromise<SetNoteCollapsedData, SetNoteCollapsedVariables>;

interface SetNoteCollapsedRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SetNoteCollapsedVariables): MutationRef<SetNoteCollapsedData, SetNoteCollapsedVariables>;
}
export const setNoteCollapsedRef: SetNoteCollapsedRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
setNoteCollapsed(dc: DataConnect, vars: SetNoteCollapsedVariables): MutationPromise<SetNoteCollapsedData, SetNoteCollapsedVariables>;

interface SetNoteCollapsedRef {
  ...
  (dc: DataConnect, vars: SetNoteCollapsedVariables): MutationRef<SetNoteCollapsedData, SetNoteCollapsedVariables>;
}
export const setNoteCollapsedRef: SetNoteCollapsedRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the setNoteCollapsedRef:
```typescript
const name = setNoteCollapsedRef.operationName;
console.log(name);
```

### Variables
The `SetNoteCollapsed` mutation requires an argument of type `SetNoteCollapsedVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SetNoteCollapsedVariables {
  id: UUIDString;
  collapsed: boolean;
}
```
### Return Type
Recall that executing the `SetNoteCollapsed` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SetNoteCollapsedData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SetNoteCollapsedData {
  studioNote_update?: StudioNote_Key | null;
}
```
### Using `SetNoteCollapsed`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, setNoteCollapsed, SetNoteCollapsedVariables } from '@studio-connector/default';

// The `SetNoteCollapsed` mutation requires an argument of type `SetNoteCollapsedVariables`:
const setNoteCollapsedVars: SetNoteCollapsedVariables = {
  id: ..., 
  collapsed: ..., 
};

// Call the `setNoteCollapsed()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await setNoteCollapsed(setNoteCollapsedVars);
// Variables can be defined inline as well.
const { data } = await setNoteCollapsed({ id: ..., collapsed: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await setNoteCollapsed(dataConnect, setNoteCollapsedVars);

console.log(data.studioNote_update);

// Or, you can use the `Promise` API.
setNoteCollapsed(setNoteCollapsedVars).then((response) => {
  const data = response.data;
  console.log(data.studioNote_update);
});
```

### Using `SetNoteCollapsed`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, setNoteCollapsedRef, SetNoteCollapsedVariables } from '@studio-connector/default';

// The `SetNoteCollapsed` mutation requires an argument of type `SetNoteCollapsedVariables`:
const setNoteCollapsedVars: SetNoteCollapsedVariables = {
  id: ..., 
  collapsed: ..., 
};

// Call the `setNoteCollapsedRef()` function to get a reference to the mutation.
const ref = setNoteCollapsedRef(setNoteCollapsedVars);
// Variables can be defined inline as well.
const ref = setNoteCollapsedRef({ id: ..., collapsed: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = setNoteCollapsedRef(dataConnect, setNoteCollapsedVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioNote_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNote_update);
});
```

## DeleteNotesByProject
You can execute the `DeleteNotesByProject` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [studio-connector/index.d.ts](./index.d.ts):
```typescript
deleteNotesByProject(vars: DeleteNotesByProjectVariables): MutationPromise<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;

interface DeleteNotesByProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteNotesByProjectVariables): MutationRef<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;
}
export const deleteNotesByProjectRef: DeleteNotesByProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteNotesByProject(dc: DataConnect, vars: DeleteNotesByProjectVariables): MutationPromise<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;

interface DeleteNotesByProjectRef {
  ...
  (dc: DataConnect, vars: DeleteNotesByProjectVariables): MutationRef<DeleteNotesByProjectData, DeleteNotesByProjectVariables>;
}
export const deleteNotesByProjectRef: DeleteNotesByProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteNotesByProjectRef:
```typescript
const name = deleteNotesByProjectRef.operationName;
console.log(name);
```

### Variables
The `DeleteNotesByProject` mutation requires an argument of type `DeleteNotesByProjectVariables`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteNotesByProjectVariables {
  projectId: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteNotesByProject` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteNotesByProjectData`, which is defined in [studio-connector/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteNotesByProjectData {
  studioNote_deleteMany: number;
}
```
### Using `DeleteNotesByProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteNotesByProject, DeleteNotesByProjectVariables } from '@studio-connector/default';

// The `DeleteNotesByProject` mutation requires an argument of type `DeleteNotesByProjectVariables`:
const deleteNotesByProjectVars: DeleteNotesByProjectVariables = {
  projectId: ..., 
};

// Call the `deleteNotesByProject()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteNotesByProject(deleteNotesByProjectVars);
// Variables can be defined inline as well.
const { data } = await deleteNotesByProject({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteNotesByProject(dataConnect, deleteNotesByProjectVars);

console.log(data.studioNote_deleteMany);

// Or, you can use the `Promise` API.
deleteNotesByProject(deleteNotesByProjectVars).then((response) => {
  const data = response.data;
  console.log(data.studioNote_deleteMany);
});
```

### Using `DeleteNotesByProject`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteNotesByProjectRef, DeleteNotesByProjectVariables } from '@studio-connector/default';

// The `DeleteNotesByProject` mutation requires an argument of type `DeleteNotesByProjectVariables`:
const deleteNotesByProjectVars: DeleteNotesByProjectVariables = {
  projectId: ..., 
};

// Call the `deleteNotesByProjectRef()` function to get a reference to the mutation.
const ref = deleteNotesByProjectRef(deleteNotesByProjectVars);
// Variables can be defined inline as well.
const ref = deleteNotesByProjectRef({ projectId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteNotesByProjectRef(dataConnect, deleteNotesByProjectVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.studioNote_deleteMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.studioNote_deleteMany);
});
```

