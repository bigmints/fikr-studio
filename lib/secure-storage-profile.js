const path = require('path');

const PRODUCTION_SAFE_STORAGE_NAME = 'Fikr Studio';
const DEVELOPMENT_SAFE_STORAGE_NAME = 'Fikr Studio Development';

function configureSafeStorageProfile(app, isDev) {
  const userDataPath = app.getPath('userData');
  const appName = isDev ? DEVELOPMENT_SAFE_STORAGE_NAME : PRODUCTION_SAFE_STORAGE_NAME;

  // Electron derives the macOS Keychain service used by safeStorage from the
  // application name. Keep development and signed production builds isolated,
  // while preserving the existing userData directory used by the MCP bridge.
  app.setName(appName);
  app.setPath('userData', userDataPath);

  const keyFileName = isDev
    ? 'ai-keys-development-v2.secure'
    : 'ai-keys-v2.secure';

  return {
    appName,
    userDataPath,
    secureAiKeysFile: path.join(userDataPath, keyFileName),
  };
}

module.exports = {
  DEVELOPMENT_SAFE_STORAGE_NAME,
  PRODUCTION_SAFE_STORAGE_NAME,
  configureSafeStorageProfile,
};
