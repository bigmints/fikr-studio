const UPDATE_STATUS_CHANNEL = 'fikr-studio:update-status';

function sendUpdateStatus(window, checking) {
  if (!window || window.isDestroyed?.()) return false;
  window.webContents.send(UPDATE_STATUS_CHANNEL, { checking: Boolean(checking) });
  return true;
}

module.exports = {
  UPDATE_STATUS_CHANNEL,
  sendUpdateStatus,
};
