const path = require('path');

function updateJsonConfig({ fs, filePath, mutate, pid = process.pid }) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

  let config = {};
  if (fs.existsSync(filePath)) {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Configuration root must be an object');
    }
  }

  const updated = mutate(config) ?? config;
  if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
    throw new Error('Updated configuration root must be an object');
  }

  const tempFile = path.join(directory, `.${path.basename(filePath)}.${pid}.tmp`);
  let descriptor = null;
  try {
    descriptor = fs.openSync(tempFile, 'w', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(updated, null, 2), 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(tempFile, filePath);
    fs.chmodSync(filePath, 0o600);
    return updated;
  } finally {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch {}
    }
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
  }
}

module.exports = { updateJsonConfig };
