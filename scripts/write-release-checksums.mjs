import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [outputPath, ...artifactPaths] = process.argv.slice(2);

if (!outputPath || artifactPaths.length === 0) {
  throw new Error('Usage: write-release-checksums.mjs <output> <artifact...>');
}

const names = artifactPaths.map((artifactPath) => path.basename(artifactPath));
if (new Set(names).size !== names.length) {
  throw new Error('Release artifact basenames must be unique');
}

const lines = artifactPaths.map((artifactPath) => {
  const digest = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
  return `${digest}  ${path.basename(artifactPath)}`;
});

writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${artifactPaths.length} release checksums to ${outputPath}`);
