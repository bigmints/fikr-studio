import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { FORBIDDEN_INFO_KEYS } from './after-pack.js';

const appPath = path.resolve(process.argv[2] || path.join('dist', 'mac-arm64', 'Fikr Studio.app'));
if (!existsSync(appPath)) throw new Error(`App bundle not found: ${appPath}`);

function directoryBytes(entry) {
  const stat = lstatSync(entry);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(entry).reduce((sum, child) => sum + directoryBytes(path.join(entry, child)), 0);
}

const bytes = directoryBytes(appPath);
if (bytes > 300 * 1024 * 1024) throw new Error(`App bundle exceeds 300 MB: ${bytes} bytes`);

const plist = path.join(appPath, 'Contents', 'Info.plist');
const executable = path.join(appPath, 'Contents', 'MacOS', 'Fikr Studio');
const asarRoot = path.join(appPath, 'Contents', 'Resources', 'app.asar');
const readPlist = key => execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();
if (readPlist('CFBundleIdentifier') !== 'com.fikr.studio') throw new Error('Unexpected bundle identifier');
if (readPlist('CFBundleShortVersionString') !== pkg.version) throw new Error('Bundle version does not match package.json');
if (readPlist('CFBundleURLTypes:0:CFBundleURLSchemes:0') !== 'fikr-studio') {
  throw new Error('Missing fikr-studio authentication URL scheme');
}

for (const key of FORBIDDEN_INFO_KEYS) {
  try {
    readPlist(key);
    throw new Error(`Forbidden Info.plist permission remains: ${key}`);
  } catch (error) {
    if (error.message?.startsWith('Forbidden')) throw error;
  }
}

const runtimeModules = [
  'lib/agent-runtime.js',
  'lib/agent-mcp-config.js',
  'lib/external-workspace-ops.js',
  'lib/file-export.js',
].map((entry) => path.join(asarRoot, entry));
const runtimeSmoke = `${runtimeModules.map((entry) => `require(${JSON.stringify(entry)});`).join('')}process.stdout.write('ok');`;
const runtimeOutput = execFileSync(executable, ['-e', runtimeSmoke], {
  encoding: 'utf8',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
if (runtimeOutput !== 'ok') throw new Error('Packaged runtime smoke did not complete');

console.log(`macOS package and runtime passed (${bytes} bytes)`);
