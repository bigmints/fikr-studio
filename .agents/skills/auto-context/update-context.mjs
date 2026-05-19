import fs from 'fs';
import path from 'path';

const WORKLOG_PATH = path.join(process.cwd(), '.agents/context/worklog.toon');

const args = process.argv.slice(2);
const msg = args.join(' ');

if (!msg || msg === '--help') {
  console.log('Usage: node update-context.mjs "<message>"');
  process.exit(msg === '--help' ? 0 : 1);
}

// Extract changed files if passed (used by git hook)
let finalMsg = msg;
let files = [];
const filesMatch = msg.match(/FILES:(.*)/s);
if (filesMatch) {
  finalMsg = msg.replace(/FILES:.*/s, '').trim();
  files = filesMatch[1]
    .trim()
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

const date = new Date().toISOString().replace('T', ' ').substring(0, 19);
const filesLine = files.length > 0 ? `\n    files: "${files.join(', ')}"` : '';

// Append a new YAML-compatible entry to worklog.toon
// Format is compatible with both toon decoder and plain reading
const newEntry = `  - date: "${date}"\n    message: "${finalMsg}"${filesLine}\n`;

fs.mkdirSync(path.dirname(WORKLOG_PATH), { recursive: true });

// Read existing content — append after the last entry
let existing = '';
if (fs.existsSync(WORKLOG_PATH)) {
  existing = fs.readFileSync(WORKLOG_PATH, 'utf8');
}

// If file starts with 'entries:', append to it; otherwise prepend header
if (existing.trim().startsWith('entries:')) {
  fs.writeFileSync(WORKLOG_PATH, existing.trimEnd() + '\n' + newEntry);
} else {
  // Treat existing content as pre-entries preamble; append to it
  fs.writeFileSync(WORKLOG_PATH, existing.trimEnd() + '\n' + newEntry);
}

console.log('Worklog updated at .agents/context/worklog.toon');
