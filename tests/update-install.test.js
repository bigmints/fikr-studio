const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_STORAGE_SETTLE_MS,
  installDownloadedUpdate,
} = require('../lib/update-install');

test('flushes renderer storage and cookies before installing an update', async () => {
  const events = [];

  await installDownloadedUpdate({
    session: {
      flushStorageData() {
        events.push('storage');
      },
      cookies: {
        async flushStore() {
          events.push('cookies');
        },
      },
    },
    async wait(ms) {
      events.push(`wait:${ms}`);
    },
    quitAndInstall() {
      events.push('install');
    },
  });

  assert.deepEqual(events, [
    'storage',
    'cookies',
    `wait:${DEFAULT_STORAGE_SETTLE_MS}`,
    'install',
  ]);
});

test('reports flush failures but still installs the downloaded update', async () => {
  const errors = [];
  let installed = false;

  await installDownloadedUpdate({
    session: {
      flushStorageData() {
        throw new Error('storage flush failed');
      },
      cookies: {
        async flushStore() {
          throw new Error('cookie flush failed');
        },
      },
    },
    wait: async () => {},
    quitAndInstall() {
      installed = true;
    },
    onFlushError(error) {
      errors.push(error.message);
    },
  });

  assert.deepEqual(errors, ['storage flush failed', 'cookie flush failed']);
  assert.equal(installed, true);
});
