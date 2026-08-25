const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('insight and knowledge-note drafts both use the Markdown renderer', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const insightSection = component.match(/data-testid="insight-output"[\s\S]*?data-testid="knowledge-note-output"/)?.[0] ?? '';

  assert.match(insightSection, /<SharedMarkdown[^>]*>\{message\.insightDraft\.content\}<\/SharedMarkdown>/);
  assert.doesNotMatch(insightSection, /<p[^>]*>\{message\.insightDraft\.content\}<\/p>/);

  assert.match(component, /<SharedMarkdown[^>]*>\{message\.noteDraft\.content\}<\/SharedMarkdown>/);
  assert.match(component, /import \{ SharedMarkdown \} from "@\/components\/shared-markdown"/);
});
