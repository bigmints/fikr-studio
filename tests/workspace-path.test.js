const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveWorkspaceDirectory } = require('../lib/workspace-path');

test('uses the normal home-backed workspace when no override is supplied', () => {
  assert.equal(
    resolveWorkspaceDirectory({ path, appHome: '/Users/example', override: '' }),
    '/Users/example/.fikr-studio',
  );
});

test('accepts an explicit absolute workspace directory for isolated QA', () => {
  assert.equal(
    resolveWorkspaceDirectory({
      path,
      appHome: '/Users/example',
      override: '/private/tmp/fikr-studio-qa/workspace',
    }),
    '/private/tmp/fikr-studio-qa/workspace',
  );
});

test('rejects relative and filesystem-root overrides', () => {
  assert.throws(
    () => resolveWorkspaceDirectory({ path, appHome: '/Users/example', override: 'relative/path' }),
    /absolute path/,
  );
  assert.throws(
    () => resolveWorkspaceDirectory({ path, appHome: '/Users/example', override: '/' }),
    /filesystem root/,
  );
});
