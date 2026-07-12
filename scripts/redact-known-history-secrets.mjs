import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const known = new Set([
  '31ee702bd1da357f7db0201ba3a62ba3b14a07506e219c7825d6c14360dfe2da',
  '3987f6bea2d3cb37114f8dca2048d699fda3ec91575c737a1d8486cb7a9b0e59',
]);
const githubPrefixes = ['gh' + 'p_', 'github' + '_pat_'];
const keyIdField = 'private' + '_key_id';
const patterns = [
  new RegExp(`(\\bGH_TOKEN\\s*=\\s*["']?)([^"'\\s]+)`, 'g'),
  new RegExp(`()\\b((?:${githubPrefixes.join('|')})[A-Za-z0-9_]{30,})\\b`, 'g'),
  new RegExp(`(["']${keyIdField}["']\\s*:\\s*["'])([a-f0-9]{20,})(["'])`, 'g'),
];

const digest = value => createHash('sha256').update(value).digest('hex');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let changed = 0;

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  let next = content;
  for (const pattern of patterns) {
    next = next.replace(pattern, (...match) => {
      const full = match[0];
      const prefix = match[1] || '';
      const candidate = match[2];
      const suffix = match[3] || '';
      return known.has(digest(candidate)) ? `${prefix}[REVOKED_AND_REMOVED]${suffix}` : full;
    });
  }
  if (next !== content) {
    writeFileSync(file, next, 'utf8');
    changed += 1;
  }
}

console.log(`Redacted known secret material from ${changed} tracked file${changed === 1 ? '' : 's'}`);
