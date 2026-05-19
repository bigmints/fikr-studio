---
name: toon
description: Convert JSON to TOON format (Token-Oriented Object Notation) to reduce LLM token usage by ~30-60%. Use the CLI for files, the TypeScript SDK for code integration.
---

# TOON Context Optimization Skill

**Triggers:** "optimize this JSON context" | "convert to toon" | "compress this data for the LLM" | "check token savings"

**Best for:** Uniform arrays of objects (lists of users, logs, records). For deeply nested or non-uniform structures, stick with compact JSON.

---

## Actions

### Convert JSON → TOON (file)
```bash
npx @toon-format/cli input.json -o output.toon
```

### Convert TOON → JSON (file)
```bash
npx @toon-format/cli input.toon -o output.json
```

### Check token savings before committing
```bash
npx @toon-format/cli input.json --stats
```

### Pipe from stdin
```bash
cat data.json | npx @toon-format/cli
```

---

## TypeScript Integration (inside `fikr.one` API routes)

```bash
npm install @toon-format/toon
```

```typescript
import { encode, decode, encodeLines } from '@toon-format/toon';

// Encode before sending to LLM
const context = encode(data, { delimiter: '\t' }); // tab = fewer tokens

// Decode & validate LLM output
const result = decode(modelOutput, { strict: true }); // throws on malformed

// Stream large datasets
for (const line of encodeLines(largeData, { delimiter: '\t' })) {
  stream.write(`${line}\n`);
}
```

---

## LLM Prompting Rules

1. **Show, don't describe** — embed a 2-5 row example in a ` ```toon ` block; models learn the pattern from it.
2. **Explicit output header** — when asking the LLM to *generate* TOON, provide the header template: `users[N]{id,name,role}:` and instruct: "2-space indent, [N] must match row count."
3. **Always validate output** — `decode(output, { strict: true })` — never trust raw model TOON without parsing.
4. **Use tab delimiter** — `delimiter: '\t'` tokenizes more efficiently and avoids comma-escaping in text values.
5. **Stream big payloads** — use `encodeLines()` for thousands of records; use `decodeFromLines()` for streaming LLM responses.

### Prompt template for LLM input
```
Data is in TOON format (tab-separated, arrays show length and fields).
```toon
<paste toon here>
```
Task: <your instruction here>
```

### Prompt template for LLM output
```
Return results as TOON. Use the same header format: items[N]{field1,field2}:
Set [N] to match row count. Output only the code block.
```
