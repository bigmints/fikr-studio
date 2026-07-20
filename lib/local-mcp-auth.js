const path = require('path');

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function isValidToken(value) {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

function writeTokenFile({ fs, filePath, token, pid = process.pid }) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${pid}.tmp`;

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify({ version: 1, token })}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } finally {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // The temp file is normally moved into place.
    }
  }
}

function loadOrCreateLocalMcpAuthToken({ fs, filePath, randomBytes, pid }) {
  try {
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (saved.version === 1 && isValidToken(saved.token)) {
      fs.chmodSync(filePath, 0o600);
      return saved.token;
    }
  } catch {
    // Invalid or missing state is rotated below without touching legacy Keychain ciphertext.
  }

  const token = randomBytes(32).toString('hex');
  if (!isValidToken(token)) {
    throw new Error('Failed to generate a valid MCP authentication token');
  }

  writeTokenFile({ fs, filePath, token, pid });
  return token;
}

module.exports = {
  isValidToken,
  loadOrCreateLocalMcpAuthToken,
};
