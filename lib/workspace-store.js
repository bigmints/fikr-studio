const path = require('path');

function createWorkspaceStore({ fs, directory, primaryFile, backupFile, logger = console, pid = process.pid }) {
  function ensureDirectory() {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(directory, 0o700);
  }

  function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function load() {
    ensureDirectory();
    try {
      if (fs.existsSync(primaryFile)) return readJson(primaryFile);
    } catch (error) {
      logger.error('[Fikr Studio] Failed to load workspace:', error);
      try {
        if (fs.existsSync(backupFile)) {
          const backup = readJson(backupFile);
          logger.warn('[Fikr Studio] Loaded the last valid workspace backup');
          return backup;
        }
      } catch (backupError) {
        logger.error('[Fikr Studio] Failed to load workspace backup:', backupError);
      }
    }
    return null;
  }

  function syncFile(file) {
    const descriptor = fs.openSync(file, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  }

  function syncDirectory() {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  }

  function save(data) {
    ensureDirectory();
    const tempFile = path.join(directory, `${path.basename(primaryFile)}.${pid}.tmp`);
    let descriptor = null;
    try {
      descriptor = fs.openSync(tempFile, 'w', 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(data, null, 2), 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;

      if (fs.existsSync(primaryFile)) {
        fs.copyFileSync(primaryFile, backupFile);
        fs.chmodSync(backupFile, 0o600);
        syncFile(backupFile);
      }
      fs.renameSync(tempFile, primaryFile);
      fs.chmodSync(primaryFile, 0o600);
      syncDirectory();
      return true;
    } catch (error) {
      logger.error('[Fikr Studio] Failed to save workspace:', error);
      return false;
    } finally {
      if (descriptor !== null) {
        try { fs.closeSync(descriptor); } catch {}
      }
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }

  return { ensureDirectory, load, save };
}

module.exports = { createWorkspaceStore };
