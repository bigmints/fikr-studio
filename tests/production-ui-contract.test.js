const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("Chat Knowledge and Creations share the production Markdown renderer", () => {
  const chat = source("components/fikr-chat.tsx");
  const knowledge = source("components/note-detail-panel.tsx");
  const creations = source("components/creations-page.tsx");

  assert.match(chat, /<SharedMarkdown/);
  assert.match(knowledge, /<SharedMarkdown/);
  assert.match(knowledge, /boundedNoteTitle/);
  assert.match(knowledge, /\{displayTitle\}/);
  assert.match(creations, /<SharedMarkdown/);
  const styles = source("app/globals.css");
  const tableRule = styles.match(/\.fikr-chat-markdown table \{[^}]*\}/)?.[0] ?? "";
  assert.match(styles, /ul\.contains-task-list/);
  assert.match(tableRule, /table-layout: fixed/);
  assert.doesNotMatch(tableRule, /min-width:/);
});

test("mobile navigation and Knowledge detail preserve visible context", () => {
  const sidebar = source("components/project-sidebar.tsx");
  const detail = source("components/note-detail-panel.tsx");

  assert.match(sidebar, /bg-background\/92 text-foreground/);
  assert.match(sidebar, /setActiveSurface\("Chat"\); onSelectChatThread/);
  assert.match(detail, /Back to Notes/);
});

test("Settings uses a shadcn modal boundary and the API status strip is permanent", () => {
  const settings = source("components/settings-page.tsx");
  const page = source("app/page.tsx");
  const banner = source("components/api-key-banner.tsx");

  assert.match(settings, /<Dialog open=\{open\}/);
  assert.match(settings, /<DialogContent/);
  assert.match(settings, /min-w-max items-center justify-start/);
  assert.match(page, /showApiKeyBanner && <ApiKeyBanner/);
  assert.doesNotMatch(banner, /dismiss|onClose/i);
});

test("the shared UI hierarchy uses accessible Fikr actions and stronger titles", () => {
  const styles = source("app/globals.css");
  const buttons = source("components/ui/button.tsx");

  assert.match(styles, /--primary: #287D7D/);
  assert.match(styles, /\.fikr-page-title \{[^}]*font-size: var\(--text-3xl\)[^}]*font-weight: 700/s);
  assert.match(styles, /\.fikr-toolbar-title \{[^}]*font-weight: 700/s);
  assert.match(buttons, /bg-primary text-primary-foreground shadow-xs/);
  assert.match(buttons, /bg-primary\/10 text-primary hover:bg-primary\/16/);
});

test("generated chat outcomes use a prominent shadcn artifact card", () => {
  const chat = source("components/fikr-chat.tsx");
  assert.match(chat, /<Card[^>]*data-testid="social-artifact"/);
  assert.match(chat, /Open in Creations/);
  assert.match(chat, /expandedDetailIds/);
});
