const DEFAULT_STORAGE_SETTLE_MS = 500;

function waitForStorageSettle(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function installDownloadedUpdate({
  session,
  quitAndInstall,
  wait = waitForStorageSettle,
  settleMs = DEFAULT_STORAGE_SETTLE_MS,
  onFlushError = () => {},
}) {
  try {
    session?.flushStorageData?.();
  } catch (error) {
    onFlushError(error);
  }

  try {
    await session?.cookies?.flushStore?.();
  } catch (error) {
    onFlushError(error);
  }

  await wait(settleMs);
  quitAndInstall();
}

module.exports = {
  DEFAULT_STORAGE_SETTLE_MS,
  installDownloadedUpdate,
};
