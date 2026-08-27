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
  '/lib/agent-runtime.js',
  '/lib/document-extractor.js',
  '/lib/fikr-skills.js',
  '/lib/web-fetch.js',
  '/lib/linkedom-worker.js',
  '/lib/linkedom-LICENSE.txt',
  '/lib/agent-mcp-config.js',
  '/lib/mcp-auth.js',
  '/lib/mcp-validation.js',
  '/lib/json-config-store.js',
  '/lib/local-data.js',
  '/lib/cloud-seed.js',
  '/lib/external-workspace-ops.js',
  '/lib/file-export.js',
  '/lib/relevance-vectors.js',
  '/lib/studio-cloud.js',
  '/lib/workspace-path.js',
  '/lib/workspace-lock.js',
  '/lib/workspace-store.js',
  '/lib/update-status.js',
  '/skills/social-media-writer/manifest.json',
  '/skills/social-media-writer/SKILL.md',
  '/node_modules/unpdf/dist/index.cjs',
  '/node_modules/unpdf/dist/pdfjs.mjs',
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
const unpacked = `${asar}.unpacked`;
const canvasPackage = process.arch === 'arm64' ? 'canvas-darwin-arm64' : 'canvas-darwin-x64';
const canvasBinary = process.arch === 'arm64' ? 'skia.darwin-arm64.node' : 'skia.darwin-x64.node';
const requiredUnpacked = [
  path.join('node_modules', '@napi-rs', canvasPackage, canvasBinary),
  path.join('node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
  path.join('node_modules', 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm'),
  path.join('node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
];
for (const file of requiredUnpacked) {
  if (!existsSync(path.join(unpacked, file))) throw new Error(`Required unpacked document runtime file missing: ${file}`);
}
console.log(`app.asar passed (${files.length} files, ${asarBytes} bytes)`);
