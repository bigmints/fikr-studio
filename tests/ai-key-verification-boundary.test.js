const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('provider keys are verified before secure storage is updated', () => {
  const main = source('main.js');
  const preload = source('preload.js');
  const handler = main.match(/ipcMain\.handle\('fikr-studio:verify-and-set-ai-key'[\s\S]*?ipcMain\.handle\('fikr-studio:request-ai'/)?.[0] ?? '';

  assert.match(preload, /verifyAndSetAiKey: \(provider, apiKey\) => ipcRenderer\.invoke\("fikr-studio:verify-and-set-ai-key", provider, apiKey\)/);
  assert.match(handler, /const result = await verifyAiKey/);
  assert.match(handler, /if \(!result\.ok\) return result/);
  assert.match(handler, /writeSecureAiKeys\(keys\)/);
  assert.ok(handler.indexOf('verifyAiKey') < handler.indexOf('writeSecureAiKeys'));
});
