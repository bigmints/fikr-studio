import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const knownFingerprints = new Map([
  ['31ee702bd1da357f7db0201ba3a62ba3b14a07506e219c7825d6c14360dfe2da', 'known exposed GitHub token'],
  ['3987f6bea2d3cb37114f8dca2048d699fda3ec91575c737a1d8486cb7a9b0e59', 'known Firebase private key id'],
]);

const githubPrefixes = ['gh' + 'p_', 'github' + '_pat_'];
const privateKeyField = 'private' + '_key_id';
const pemMarker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const patterns = [
  ['GitHub token assignment', new RegExp(`\\bGH_TOKEN\\s*=\\s*["']?([^"'\\s]+)`, 'g'), 1],
  ['GitHub token', new RegExp(`\\b(?:${githubPrefixes.join('|')})[A-Za-z0-9_]{30,}\\b`, 'g'), 0],
  ['Firebase private key id', new RegExp(`["']${privateKeyField}["']\\s*:\\s*["']([a-f0-9]{20,})["']`, 'g'), 1],
  ['Private key material', new RegExp(pemMarker.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g'), null],
];

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

let history;
try {
  history = execFileSync('git', [
    // A release is authorized by the ancestry of its checked-out commit. Other
    // local branches may retain quarantined legacy history and must not make a
    // clean release branch impossible to validate.
    'log', '-p', 'HEAD', '--full-history', '--no-ext-diff',
    '--format=__FIKR_COMMIT__%H',
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
} catch (error) {
  console.error(`History secret scan could not read Git history: ${error.message}`);
  process.exit(2);
}

let commit = 'unknown';
let file = 'unknown';
const findings = new Map();

for (const line of history.split('\n')) {
  if (line.startsWith('__FIKR_COMMIT__')) {
    commit = line.slice('__FIKR_COMMIT__'.length);
    file = 'unknown';
    continue;
  }
  if (line.startsWith('diff --git ')) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    file = match?.[2] || 'unknown';
    continue;
  }
  if ((!line.startsWith('+') && !line.startsWith('-')) || line.startsWith('+++') || line.startsWith('---')) continue;

  const content = line.slice(1);
  for (const [label, pattern, capture] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const candidate = capture == null ? null : match[capture];
      const known = candidate ? knownFingerprints.get(fingerprint(candidate)) : null;
      const isToken = label.startsWith('GitHub') && candidate && (
        candidate.startsWith(githubPrefixes[0]) || candidate.startsWith(githubPrefixes[1]) || candidate.length === 40
      );
      const shouldReport = label === 'Private key material' || label === 'GitHub token' ||
        label === 'Firebase private key id' || Boolean(known) || Boolean(isToken);
      if (!shouldReport) continue;
      const type = known || label;
      findings.set(`${commit}:${file}:${type}`, { commit, file, type });
    }
  }
}

if (findings.size) {
  console.error(`Git history secret scan failed (${findings.size} finding${findings.size === 1 ? '' : 's'}):`);
  for (const finding of findings.values()) {
    console.error(`${finding.commit.slice(0, 12)} ${finding.file}: ${finding.type}`);
  }
  console.error('Rewrite the affected history and rotate every exposed credential before release.');
  process.exit(1);
}

console.log('Git history secret scan passed');
