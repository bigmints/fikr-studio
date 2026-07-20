const test = require('node:test');
const assert = require('node:assert/strict');
const {
  UPDATE_STATUS_CHANNEL,
  sendUpdateStatus,
} = require('../lib/update-status');

test('sends the exact in-app checking state to a live renderer', () => {
  const messages = [];
  const window = {
    isDestroyed: () => false,
    webContents: {
      send(channel, payload) {
        messages.push({ channel, payload });
      },
    },
  };

  assert.equal(sendUpdateStatus(window, true), true);
  assert.equal(sendUpdateStatus(window, false), true);
  assert.deepEqual(messages, [
    { channel: UPDATE_STATUS_CHANNEL, payload: { checking: true } },
    { channel: UPDATE_STATUS_CHANNEL, payload: { checking: false } },
  ]);
});

test('does not send update state to an absent or destroyed renderer', () => {
  assert.equal(sendUpdateStatus(null, true), false);
  assert.equal(sendUpdateStatus({ isDestroyed: () => true }, true), false);
});
