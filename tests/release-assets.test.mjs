import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import pkg from '../package.json' with { type: 'json' };

const verifier = path.resolve('scripts/verify-release-assets.mjs');
const checksumWriter = path.resolve('scripts/write-release-checksums.mjs');

function sha512(filePath) {
  return createHash('sha512').update(readFileSync(filePath)).digest('base64');
}

test('verifies updater metadata and every downloaded release asset checksum', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fikr-release-assets-'));
  try {
    const dmg = path.join(temp, `Fikr.Studio-${pkg.version}-arm64.dmg`);
    const zip = path.join(temp, `Fikr.Studio-${pkg.version}-arm64-mac.zip`);
    const blockmap = `${zip}.blockmap`;
    const metadata = path.join(temp, 'latest-mac.yml');
    const checksums = path.join(temp, 'SHA256SUMS.txt');
    writeFileSync(dmg, 'signed dmg fixture');
    writeFileSync(zip, 'signed zip fixture');
    writeFileSync(blockmap, 'blockmap fixture');
    writeFileSync(metadata, [
      `version: ${pkg.version}`,
      'files:',
      `  - url: ${path.basename(zip)}`,
      `    sha512: ${sha512(zip)}`,
      `    size: ${readFileSync(zip).length}`,
      `  - url: ${path.basename(dmg)}`,
      `    sha512: ${sha512(dmg)}`,
      `    size: ${readFileSync(dmg).length}`,
      `path: ${path.basename(zip)}`,
      `sha512: ${sha512(zip)}`,
      `releaseDate: '${new Date().toISOString()}'`,
      '',
    ].join('\n'));

    execFileSync(process.execPath, [checksumWriter, checksums, dmg, zip, blockmap, metadata]);
    execFileSync(process.execPath, [verifier, metadata, dmg, zip, checksums]);
    writeFileSync(zip, 'tampered zip fixture');
    assert.throws(
      () => execFileSync(process.execPath, [verifier, metadata, dmg, zip, checksums], { stdio: 'ignore' }),
      /Command failed/,
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
