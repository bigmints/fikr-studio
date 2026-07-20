const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FORBIDDEN_INFO_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSAppTransportSecurity',
];

function walk(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, results);
    else if (entry.name === 'Info.plist') results.push(fullPath);
  }
  return results;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  for (const plist of walk(context.appOutDir)) {
    for (const key of FORBIDDEN_INFO_KEYS) {
      spawnSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plist], { stdio: 'ignore' });
    }
  }
};

exports.FORBIDDEN_INFO_KEYS = FORBIDDEN_INFO_KEYS;
