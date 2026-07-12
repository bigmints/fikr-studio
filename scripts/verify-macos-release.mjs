import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { FORBIDDEN_INFO_KEYS } from './after-pack.js';

const [builtApp, dmgPath, zipPath] = process.argv.slice(2);
if (!builtApp || !dmgPath || !zipPath) {
  throw new Error('Usage: verify-macos-release.mjs <built-app> <dmg> <ota-zip>');
}
for (const artifact of [builtApp, dmgPath, zipPath]) {
  if (!existsSync(artifact)) throw new Error(`Artifact not found: ${artifact}`);
}

const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });
const capture = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return `${result.stdout || ''}${result.stderr || ''}`;
};
const plistValue = (appPath, key) => run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(appPath, 'Contents', 'Info.plist')], {
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

function assertApp(appPath, label) {
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath], { stdio: 'inherit' });
  run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], { stdio: 'inherit' });
  run('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' });

  const signatureDetails = capture('codesign', ['-dv', '--verbose=4', appPath]);
  const entitlements = capture('codesign', ['-d', '--entitlements', '-', appPath]);
  if (!signatureDetails.includes('TeamIdentifier=FBG8NKYPUJ')) throw new Error(`${label}: wrong signing team`);
  if (!signatureDetails.includes('flags=0x10000(runtime)')) throw new Error(`${label}: hardened runtime missing`);
  if (!entitlements.includes('com.apple.security.cs.allow-jit')) throw new Error(`${label}: JIT entitlement missing`);
  if (entitlements.includes('com.apple.security.cs.disable-library-validation')) throw new Error(`${label}: library validation is disabled`);
  if (plistValue(appPath, 'CFBundleIdentifier') !== 'com.fikr.studio') throw new Error(`${label}: wrong bundle identifier`);
  if (plistValue(appPath, 'CFBundleShortVersionString') !== pkg.version) throw new Error(`${label}: wrong version`);
  if (plistValue(appPath, 'CFBundleURLTypes:0:CFBundleURLSchemes:0') !== 'fikr-studio') {
    throw new Error(`${label}: missing fikr-studio authentication URL scheme`);
  }

  for (const key of FORBIDDEN_INFO_KEYS) {
    try {
      plistValue(appPath, key);
      throw new Error(`${label}: forbidden Info.plist key ${key}`);
    } catch (error) {
      if (error.message?.includes('forbidden Info.plist')) throw error;
    }
  }
}

assertApp(builtApp, 'build app');
run('xcrun', ['stapler', 'validate', dmgPath], { stdio: 'inherit' });
run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', dmgPath], { stdio: 'inherit' });

const temp = mkdtempSync(path.join(os.tmpdir(), 'fikr-release-verify-'));
const mountPoint = path.join(temp, 'dmg');
const zipOutput = path.join(temp, 'zip');
try {
  run('mkdir', ['-p', mountPoint, zipOutput]);
  run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath], { stdio: 'inherit' });
  assertApp(path.join(mountPoint, 'Fikr Studio.app'), 'DMG app');
  run('hdiutil', ['detach', mountPoint], { stdio: 'inherit' });
  run('ditto', ['-x', '-k', zipPath, zipOutput]);
  assertApp(path.join(zipOutput, 'Fikr Studio.app'), 'OTA ZIP app');
} finally {
  try { run('hdiutil', ['detach', mountPoint], { stdio: 'ignore' }); } catch {}
  rmSync(temp, { recursive: true, force: true });
}

const checksums = run('shasum', ['-a', '256', dmgPath, zipPath]);
process.stdout.write(checksums);
console.log('Exact DMG and OTA ZIP verification passed');
