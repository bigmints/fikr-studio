#!/usr/bin/env node

/**
 * Inspect the authenticated user's Studio cloud workspace through the same
 * production API used by the desktop. Never loads Firebase Admin credentials.
 */

const token = process.env.FIKR_ID_TOKEN;
const apiBase = process.env.FIKR_API_BASE_URL || 'https://fikr.one';

if (!token) {
  console.error('FIKR_ID_TOKEN is required. Use a short-lived Firebase ID token.');
  process.exit(1);
}

const response = await fetch(`${apiBase}/api/studio/workspace`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Workspace request failed (${response.status}): ${payload.error || 'Unknown error'}`);
  process.exit(1);
}

const workspace = payload.workspace ?? {};
const projects = Array.isArray(workspace.projects) ? workspace.projects : [];
console.log(`Projects: ${projects.length}`);
for (const project of projects) {
  const blocks = Array.isArray(project.blocks) ? project.blocks : [];
  const ghostNotes = Array.isArray(project.ghostNotes) ? project.ghostNotes : [];
  console.log(`\n${project.name} [${project.id}] — ${blocks.length} notes, ${ghostNotes.length} insights`);
  for (const note of blocks) {
    const preview = String(note.title || note.text || '').replace(/\s+/g, ' ').slice(0, 100);
    console.log(`  [${note.id}] ${preview}`);
  }
}

const studioProjects = Array.isArray(workspace.studioProjects) ? workspace.studioProjects : [];
console.log(`\nStudio generation projects: ${studioProjects.length}`);
for (const project of studioProjects) {
  const versions = Array.isArray(project.versions) ? project.versions.length : 0;
  console.log(`  ${project.name} [${project.id}] — ${project.platform || 'unknown'}, ${project.status || 'unknown'}, ${versions} versions`);
}
