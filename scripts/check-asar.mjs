import { listPackage } from '@electron/asar';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const asar = process.argv[2] || path.join('dist', 'mac-arm64', 'Fikr Studio.app', 'Contents', 'Resources', 'app.asar');
if (!existsSync(asar)) throw new Error(`app.asar not found: ${asar}`);
const asarBytes = statSync(asar).size;
if (asarBytes > 10 * 1024 * 1024) throw new Error(`app.asar exceeds 10 MB: ${asarBytes} bytes`);
const files = await listPackage(asar);
const required = [
  '/main.js',
  '/preload.js',
  '/lib/auth-callback.js',
  '/lib/ai-request.js',
  '/lib/mcp-auth.js',
  '/lib/mcp-validation.js',
  '/lib/json-config-store.js',
  '/lib/local-data.js',
  '/lib/cloud-seed.js',
  '/lib/relevance-vectors.js',
  '/lib/studio-cloud.js',
  '/lib/workspace-store.js',
];
const forbidden = [
  /service-account/i,
  /firebase-admin/i,
  /lib\/dataconnect\.js$/i,
  /lib\/studio-firestore\.js$/i,
  /scripts\/debug-firestore\.mjs$/i,
  /.agents\//i,
];
for (const file of required) {
  if (!files.includes(file)) throw new Error(`Required packaged file missing: ${file}`);
}
for (const file of files) {
  const rule = forbidden.find(pattern => pattern.test(file));
  if (rule) throw new Error(`Forbidden packaged file: ${file}`);
}
console.log(`app.asar passed (${files.length} files, ${asarBytes} bytes)`);
