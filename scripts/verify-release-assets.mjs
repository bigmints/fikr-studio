import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };

const [metadataPath, dmgPath, zipPath, checksumsPath] = process.argv.slice(2);
if (!metadataPath || !dmgPath || !zipPath) {
  throw new Error('Usage: verify-release-assets.mjs <latest-mac.yml> <dmg> <zip> [SHA256SUMS.txt]');
}

function digest(filePath, algorithm, encoding) {
  return createHash(algorithm).update(readFileSync(filePath)).digest(encoding);
}

function normalizedAssetName(filePath) {
  return path.basename(filePath).replaceAll(' ', '.');
}

function parseMetadata(source) {
  const version = source.match(/^version:\s*(\S+)$/m)?.[1];
  const pathValue = source.match(/^path:\s*(\S+)$/m)?.[1];
  const topSha512 = source.match(/^sha512:\s*(\S+)$/m)?.[1];
  const releaseDate = source.match(/^releaseDate:\s*'([^']+)'$/m)?.[1];
  const files = [];
  const filePattern = /^\s{2}- url:\s*(\S+)\n\s{4}sha512:\s*(\S+)\n\s{4}size:\s*(\d+)$/gm;
  for (const match of source.matchAll(filePattern)) {
    files.push({ url: match[1], sha512: match[2], size: Number(match[3]) });
  }
  return { version, path: pathValue, sha512: topSha512, releaseDate, files };
}

function assertMetadata() {
  const metadata = parseMetadata(readFileSync(metadataPath, 'utf8'));
  if (metadata.version !== pkg.version) throw new Error(`Update metadata version is ${metadata.version}, expected ${pkg.version}`);
  if (!metadata.releaseDate || Number.isNaN(Date.parse(metadata.releaseDate))) throw new Error('Update metadata releaseDate is invalid');
  if (metadata.files.length !== 2) throw new Error(`Update metadata must contain exactly two files, found ${metadata.files.length}`);

  const expectedArtifacts = [zipPath, dmgPath].map((filePath) => ({
    url: normalizedAssetName(filePath),
    sha512: digest(filePath, 'sha512', 'base64'),
    size: statSync(filePath).size,
  }));

  for (const expected of expectedArtifacts) {
    const actual = metadata.files.find((file) => file.url === expected.url);
    if (!actual) throw new Error(`Update metadata is missing ${expected.url}`);
    if (actual.sha512 !== expected.sha512) throw new Error(`Update metadata sha512 mismatch for ${expected.url}`);
    if (actual.size !== expected.size) throw new Error(`Update metadata size mismatch for ${expected.url}`);
  }

  const zip = expectedArtifacts[0];
  if (metadata.path !== zip.url || metadata.sha512 !== zip.sha512) {
    throw new Error('Update metadata primary OTA ZIP fields do not match the ZIP artifact');
  }
}

function assertChecksums() {
  if (!checksumsPath) return;
  const checksumDir = path.dirname(checksumsPath);
  const lines = readFileSync(checksumsPath, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) throw new Error('Checksum manifest is empty');
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64}) {2}([^/]+)$/);
    if (!match) throw new Error(`Invalid checksum line: ${line}`);
    const [, expected, name] = match;
    if (seen.has(name)) throw new Error(`Duplicate checksum entry: ${name}`);
    seen.add(name);
    const actual = digest(path.join(checksumDir, name), 'sha256', 'hex');
    if (actual !== expected) throw new Error(`SHA-256 mismatch for ${name}`);
  }
}

assertMetadata();
assertChecksums();
console.log('Update metadata and release checksums verified');
