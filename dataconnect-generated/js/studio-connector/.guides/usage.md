# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { listProjects, createProject, renameProject, archiveProject, getProject, getNotesByProject, getGhostNotes, createNote, updateNote, deleteNote } from '@studio-connector/default';


// Operation ListProjects:  For variables, look at type ListProjectsVars in ../index.d.ts
const { data } = await ListProjects(dataConnect, listProjectsVars);

// Operation CreateProject:  For variables, look at type CreateProjectVars in ../index.d.ts
const { data } = await CreateProject(dataConnect, createProjectVars);

// Operation RenameProject:  For variables, look at type RenameProjectVars in ../index.d.ts
const { data } = await RenameProject(dataConnect, renameProjectVars);

// Operation ArchiveProject:  For variables, look at type ArchiveProjectVars in ../index.d.ts
const { data } = await ArchiveProject(dataConnect, archiveProjectVars);

// Operation GetProject:  For variables, look at type GetProjectVars in ../index.d.ts
const { data } = await GetProject(dataConnect, getProjectVars);

// Operation GetNotesByProject:  For variables, look at type GetNotesByProjectVars in ../index.d.ts
const { data } = await GetNotesByProject(dataConnect, getNotesByProjectVars);

// Operation GetGhostNotes:  For variables, look at type GetGhostNotesVars in ../index.d.ts
const { data } = await GetGhostNotes(dataConnect, getGhostNotesVars);

// Operation CreateNote:  For variables, look at type CreateNoteVars in ../index.d.ts
const { data } = await CreateNote(dataConnect, createNoteVars);

// Operation UpdateNote:  For variables, look at type UpdateNoteVars in ../index.d.ts
const { data } = await UpdateNote(dataConnect, updateNoteVars);

// Operation DeleteNote:  For variables, look at type DeleteNoteVars in ../index.d.ts
const { data } = await DeleteNote(dataConnect, deleteNoteVars);


```