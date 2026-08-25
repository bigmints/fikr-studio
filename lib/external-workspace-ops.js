function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function noteKey(projectId, noteId) {
  return `note:${projectId}:${noteId}`;
}

function noteReflects(rawNote, expectedNote) {
  if (!rawNote || rawNote.id !== expectedNote.id) return false;
  return ["text", "contentType", "category", "annotation", "isEnriching"]
    .every((field) => rawNote[field] === expectedNote[field]);
}

function createExternalWorkspaceOpBuffer({ maxOperations = 1_000 } = {}) {
  const operations = new Map();

  const remember = (key, operation) => {
    operations.delete(key);
    operations.set(key, cloneValue(operation));
    while (operations.size > maxOperations) {
      operations.delete(operations.keys().next().value);
    }
  };

  const recordProjectCreated = (project) => {
    if (!project?.id) return;
    remember(`project:${project.id}`, { type: "project-created", project });
  };

  const recordNoteAdded = (projectId, note) => {
    if (!projectId || !note?.id) return;
    remember(noteKey(projectId, note.id), { type: "note-added", projectId, note });
  };

  const recordNoteUpdated = (projectId, note) => {
    if (!projectId || !note?.id) return;
    const key = noteKey(projectId, note.id);
    const previous = operations.get(key);
    remember(key, {
      type: previous?.type === "note-added" ? "note-added" : "note-updated",
      projectId,
      note: previous?.note ? { ...previous.note, ...note } : note,
    });
  };

  const recordNoteDeleted = (projectId, noteId) => {
    if (!projectId || !noteId) return;
    remember(noteKey(projectId, noteId), { type: "note-deleted", projectId, noteId });
  };

  const protect = (workspace) => {
    const projects = Array.isArray(workspace?.projects)
      ? workspace.projects.map((project) => ({
          ...project,
          blocks: Array.isArray(project.blocks) ? [...project.blocks] : [],
        }))
      : [];
    const protectedWorkspace = { ...workspace, projects };

    for (const [key, operation] of [...operations.entries()]) {
      if (operation.type === "project-created") {
        const existing = projects.find((project) => project.id === operation.project.id);
        if (existing) operations.delete(key);
        else projects.push(cloneValue(operation.project));
        continue;
      }

      const project = projects.find((candidate) => candidate.id === operation.projectId);
      if (!project) continue;
      const noteId = operation.note?.id ?? operation.noteId;
      const noteIndex = project.blocks.findIndex((note) => note.id === noteId);

      if (operation.type === "note-deleted") {
        if (noteIndex < 0) operations.delete(key);
        else project.blocks.splice(noteIndex, 1);
        continue;
      }

      if (noteIndex >= 0 && noteReflects(project.blocks[noteIndex], operation.note)) {
        operations.delete(key);
      } else if (noteIndex >= 0) {
        project.blocks[noteIndex] = { ...project.blocks[noteIndex], ...cloneValue(operation.note) };
      } else {
        project.blocks.push(cloneValue(operation.note));
      }
    }

    return protectedWorkspace;
  };

  return {
    recordProjectCreated,
    recordNoteAdded,
    recordNoteUpdated,
    recordNoteDeleted,
    protect,
    get pendingCount() {
      return operations.size;
    },
  };
}

module.exports = { createExternalWorkspaceOpBuffer };
