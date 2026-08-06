import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dist = path.resolve('dist');
const dmg = path.join(dist, `Fikr Studio-${pkg.version}-arm64.dmg`);
const zip = path.join(dist, `Fikr Studio-${pkg.version}-arm64-mac.zip`);

await buildBlockMap(dmg, 'gzip', `${dmg}.blockmap`);

function artifact(file) {
  return {
    url: path.basename(file).replaceAll(' ', '.'),
    sha512: createHash('sha512').update(readFileSync(file)).digest('base64'),
    size: statSync(file).size,
  };
}

const zipArtifact = artifact(zip);
const dmgArtifact = artifact(dmg);
const yaml = [
  `version: ${pkg.version}`,
  'files:',
  `  - url: ${zipArtifact.url}`,
  `    sha512: ${zipArtifact.sha512}`,
  `    size: ${zipArtifact.size}`,
  `  - url: ${dmgArtifact.url}`,
  `    sha512: ${dmgArtifact.sha512}`,
  `    size: ${dmgArtifact.size}`,
  `path: ${zipArtifact.url}`,
  `sha512: ${zipArtifact.sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n');

writeFileSync(path.join(dist, 'latest-mac.yml'), yaml, 'utf8');
console.log('Refreshed macOS blockmap and update metadata from final artifacts');
