const path = require('path');

function defaultIsProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function createWorkspaceLock({ fs, filePath, pid = process.pid, now = Date.now, isProcessAlive = defaultIsProcessAlive }) {
  let held = false;

  function writeLock() {
    const descriptor = fs.openSync(filePath, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, JSON.stringify({ version: 1, pid, startedAt: now() }), 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.chmodSync(filePath, 0o600);
    held = true;
  }

  function readOwner() {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Number.isSafeInteger(value?.pid) && value.pid > 0 ? value.pid : null;
    } catch {
      return null;
    }
  }

  function acquire() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.chmodSync(path.dirname(filePath), 0o700);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        writeLock();
        return { acquired: true, ownerPid: pid };
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const ownerPid = readOwner();
        if (ownerPid && isProcessAlive(ownerPid)) return { acquired: false, ownerPid };
        fs.unlinkSync(filePath);
      }
    }
    return { acquired: false, ownerPid: readOwner() };
  }

  function release() {
    if (!held) return false;
    try {
      if (readOwner() !== pid) return false;
      fs.unlinkSync(filePath);
      held = false;
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') held = false;
      return false;
    }
  }

  return { acquire, release };
}

module.exports = { createWorkspaceLock, defaultIsProcessAlive };
