const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  DEVELOPMENT_SAFE_STORAGE_NAME,
  PRODUCTION_SAFE_STORAGE_NAME,
  configureSafeStorageProfile,
} = require('../lib/secure-storage-profile');

function fakeApp(userDataPath) {
  return {
    name: 'fikr-studio',
    path: userDataPath,
    getPath(key) {
      assert.equal(key, 'userData');
      return this.path;
    },
    setName(value) {
      this.name = value;
      this.path = `/changed/by/${value}`;
    },
    setPath(key, value) {
      assert.equal(key, 'userData');
      this.path = value;
    },
  };
}

test('uses a stable production Keychain identity without moving user data', () => {
  const app = fakeApp('/existing/fikr-studio');
  const profile = configureSafeStorageProfile(app, false);

  assert.equal(app.name, PRODUCTION_SAFE_STORAGE_NAME);
  assert.equal(app.path, '/existing/fikr-studio');
  assert.equal(profile.secureAiKeysFile, path.join('/existing/fikr-studio', 'ai-keys-v2.secure'));
});

test('isolates development credentials from signed production credentials', () => {
  const app = fakeApp('/existing/fikr-studio');
  const profile = configureSafeStorageProfile(app, true);

  assert.equal(app.name, DEVELOPMENT_SAFE_STORAGE_NAME);
  assert.equal(app.path, '/existing/fikr-studio');
  assert.equal(profile.secureAiKeysFile, path.join('/existing/fikr-studio', 'ai-keys-development-v2.secure'));
});
