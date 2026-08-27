const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('creation title belongs to editable Markdown instead of fixed app chrome', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'creations-page.tsx'), 'utf8');
  const detailToolbar = component.match(/<header[^>]*data-testid="creation-toolbar"[\s\S]*?<\/header>/)?.[0] ?? '';
  const documentHeader = component.match(/<header[^>]*data-testid="creation-document-header"[\s\S]*?<\/header>/)?.[0] ?? '';

  assert.notEqual(detailToolbar, '');
  assert.notEqual(documentHeader, '');
  assert.doesNotMatch(detailToolbar, /<h[1-6][^>]*>[\s\S]*selected\.name/);
  assert.doesNotMatch(documentHeader, /selected\.name|selectedTitle/);
  assert.match(component, /ensureCreationDocument\(editingCreation\.outputMarkdown/);
  assert.match(component, /onUpdateCreation\(editingCreation\.id, documentMarkdown, title\)/);
  assert.match(component, /\{selectedDocumentMarkdown\}/);
});

test('creation sidebar rows omit body descriptions', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'creations-page.tsx'), 'utf8');

  assert.match(component, /line-clamp-2[^>]*>\{creationDisplayTitle\(creation\)\}/);
  assert.match(component, /text-sm font-semibold leading-5 text-foreground\/95/);
  assert.match(component, /text-xs font-medium tabular-nums text-muted-foreground/);
  assert.match(component, /inline-flex shrink-0 items-center gap-1\.5 text-xs font-medium text-muted-foreground/);
  assert.doesNotMatch(component, /text-base font-bold[^>]*>\{creationDisplayTitle\(creation\)\}/);
  assert.doesNotMatch(component, /Saved creation/);
});

test('share modal selects render their portal above the dialog layer', () => {
  const creations = fs.readFileSync(path.join(__dirname, '..', 'components', 'creations-page.tsx'), 'utf8');
  const select = fs.readFileSync(path.join(__dirname, '..', 'components', 'ui', 'select.tsx'), 'utf8');
  const dialog = fs.readFileSync(path.join(__dirname, '..', 'components', 'ui', 'dialog.tsx'), 'utf8');

  assert.match(creations, /aria-label="Share destination"/);
  assert.match(creations, /aria-label="Cover format"/);
  assert.match(select, /<SelectPrimitive\.Portal>/);
  assert.match(select, /relative z-\[600\]/);
  assert.match(dialog, /z-\[300\]/);
  assert.doesNotMatch(select, /relative z-50 /);
});

test('workspace hydration cannot persist an initial empty creations ref', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');
  const refSync = page.indexOf('studioProjectsRef.current = studioProjects;');
  const persistenceEffect = page.indexOf('// 2. Persistence: Save on Change');
  const diskHydration = page.match(/if \(ipc && Array\.isArray\(diskData\?\.studioProjects\)\)[\s\S]*?setStudioProjects\(reset\);/)?.[0] ?? '';
  const cloudHydration = page.match(/hasOwnProperty\.call\(workspace, "studioProjects"\)[\s\S]*?setStudioProjects\(syncedStudioProjects\);/)?.[0] ?? '';

  assert.ok(refSync >= 0 && refSync < persistenceEffect);
  assert.match(diskHydration, /studioProjectsRef\.current = reset;/);
  assert.match(cloudHydration, /studioProjectsRef\.current = syncedStudioProjects;/);
});

test('persisted creation drafts remain visible but cannot be shared empty', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'creations-page.tsx'), 'utf8');

  assert.match(component, /const visible = useMemo\(\(\) => creations, \[creations\]\);/);
  assert.match(component, /if \(!creation\.outputMarkdown\?\.trim\(\)\) return "Draft";/);
  assert.match(component, /aria-label="Share creation"[\s\S]*?disabled=\{!selectedHasContent\}/);
  assert.match(component, /aria-label=\{copiedId === selected\.id \? "Creation copied" : "Copy creation"\}[\s\S]*?disabled=\{!selectedHasContent\}/);
});
