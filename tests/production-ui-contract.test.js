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
  const list = source("components/list-area.tsx");

  assert.match(sidebar, /bg-background\/92 text-foreground/);
  assert.match(sidebar, /setActiveSurface\("Chat"\); onSelectChatThread/);
  assert.match(detail, /Back to Notes/);
  assert.match(list, /flex w-full min-w-0 items-start gap-2\.5/);
  assert.match(list, /<time className="ml-auto shrink-0[^"]*text-right/);
});

test("Settings uses a shadcn modal boundary and the API status strip is permanent", () => {
  const settings = source("components/settings-page.tsx");
  const page = source("app/page.tsx");
  const banner = source("components/api-key-banner.tsx");
  const dialog = source("components/ui/dialog.tsx");

  assert.match(settings, /<Dialog open=\{open\}/);
  assert.match(settings, /<DialogContent/);
  assert.match(settings, /min-w-max items-center justify-start/);
  assert.match(settings, /No AI provider added/);
  assert.match(settings, /Add provider/);
  assert.match(settings, /<Dialog open=\{providerDialogOpen\}/);
  assert.match(settings, /\{NAV\.map\(\(\{ id, label, description, Icon \}\) => \(/);
  assert.doesNotMatch(settings, /NAV\.filter\([^\n]*isManagedPlan/);
  assert.match(settings, /verifyAndSetAiKey/);
  assert.match(settings, /Verify and save/);
  assert.match(settings, /SECURE_KEY_MASK/);
  assert.match(settings, /showApiKeyBanner && <ApiKeyBanner[\s\S]*data-testid="settings-layout"/);
  assert.match(settings, /data-testid="settings-layout"[^>]*className="flex min-h-0 flex-1 flex-col md:flex-row"|className="flex min-h-0 flex-1 flex-col md:flex-row" data-testid="settings-layout"/);
  assert.match(settings, /<Card className="gap-0 overflow-hidden border-0 bg-transparent py-0 shadow-none">/);
  assert.match(page, /const \[isAuthResolved, setIsAuthResolved\] = useState\(false\)/);
  assert.match(page, /const isLaunchReady = isLoaded && isHydrated && isAuthResolved/);
  assert.match(page, /const showApiKeyBanner = isAuthResolved\s*&& isHydrated/);
  assert.match(page, /data-testid="app-launch-gate"/);
  assert.match(page, /Mounted during launch so authentication resolves before the workspace is revealed/);
  const authFlow = settings.match(/onIdTokenChanged\(auth,[\s\S]*?return \(\) => unsub/)?.[0] ?? "";
  assert.ok(authFlow.indexOf("onAuthChange?.(u, token, plan)") < authFlow.indexOf("ipc?.getAccount"));
  assert.match(page, /showApiKeyBanner && <ApiKeyBanner[\s\S]*data-testid="workspace-layout"/);
  assert.match(page, /className="flex min-h-0 flex-1" data-testid="workspace-layout"/);
  assert.doesNotMatch(banner, /dismiss|onClose/i);
  assert.match(dialog, /rounded-lg bg-background p-6 shadow-lg/);
  assert.doesNotMatch(dialog, /rounded-lg border bg-background/);
});

test("the shared UI hierarchy uses accessible Fikr actions and stronger titles", () => {
  const styles = source("app/globals.css");
  const buttons = source("components/ui/button.tsx");
  const cards = source("components/ui/card.tsx");

  assert.match(styles, /--primary: #287D7D/);
  assert.match(styles, /\.fikr-page-title \{[^}]*font-size: var\(--text-3xl\)[^}]*font-weight: 700/s);
  assert.match(styles, /\.fikr-toolbar-title \{[^}]*font-weight: 700/s);
  assert.match(buttons, /bg-primary text-primary-foreground shadow-xs/);
  assert.match(buttons, /bg-primary\/10 text-primary hover:bg-primary\/16/);
  assert.match(cards, /border border-border\/50 bg-card/);
});

test("generated chat outcomes use a prominent shadcn artifact card", () => {
  const chat = source("components/fikr-chat.tsx");
  assert.match(chat, /<Card[^>]*data-testid="social-artifact"/);
  assert.match(chat, /Open in Creations/);
  assert.match(chat, /expandedDetailIds/);
});
