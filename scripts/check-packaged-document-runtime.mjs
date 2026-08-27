import { createRequire } from 'node:module';
import path from 'node:path';

const resourcesPath = path.resolve(process.argv[2] || path.join('dist', 'mac-arm64', 'Fikr Studio.app', 'Contents', 'Resources'));
const appAsar = path.join(resourcesPath, 'app.asar');
const require = createRequire(import.meta.url);
const { createBundledEnglishOcrWorker } = require(path.join(appAsar, 'lib', 'document-extractor.js'));
const { createCanvas } = require(path.join(appAsar, 'node_modules', '@napi-rs', 'canvas'));

const canvas = createCanvas(1_000, 240);
const context = canvas.getContext('2d');
context.fillStyle = 'white';
context.fillRect(0, 0, canvas.width, canvas.height);
context.fillStyle = 'black';
context.font = 'bold 60px Arial';
context.fillText('FIKR PACKAGED OCR', 45, 145);

const worker = await createBundledEnglishOcrWorker();
try {
  const result = await worker.recognize(await canvas.encode('png'));
  if (!/FIKR PACKAGED OCR/i.test(result.data.text)) {
    throw new Error('Packaged OCR returned unexpected text');
  }
} finally {
  await worker.terminate();
}

console.log('Packaged document runtime passed');
