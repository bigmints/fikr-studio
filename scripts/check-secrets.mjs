import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  ['GitHub token', new RegExp(`\\b(?:${'gh' + 'p_'}[A-Za-z0-9]{30,}|${'github' + '_pat_'}[A-Za-z0-9_]{30,})\\b`, 'g')],
  ['Google service-account private key', new RegExp(['-----BEGIN', 'PRIVATE KEY-----'].join(' '), 'g')],
  ['Firebase service-account key id', new RegExp(`"${'private' + '_key_id'}"\\s*:\\s*"[a-f0-9]{20,}"`, 'g')],
];

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(file => !file.startsWith('dist/') && !file.startsWith('out/'));
const findings = [];
for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}
if (findings.length) {
  console.error(`Secret scan failed:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} files)`);
