import test from "node:test";
import assert from "node:assert/strict";

import { mergeHybridSearchResults, textSearch } from "../lib/search-domain.mjs";

test("global text search ranks an exact note heading above incidental body mentions", () => {
  const results = textSearch("Xtara", [
    { id: "saveaday", text: "# SaveADay architecture\nA later comparison mentions Xtara.", contentType: "note" },
    { id: "xtara", text: "# Xtara Product Vision\nTrusted career navigation.", contentType: "thesis" },
  ]);

  assert.deepEqual(results.map((result) => result.blockId), ["xtara", "saveaday"]);
  assert.equal(results[0].score > results[1].score, true);
});

test("semantic-only matches cannot bury an exact lexical result", () => {
  const merged = mergeHybridSearchResults(
    [{ blockId: "exact", score: 1 }],
    [{ blockId: "unrelated-semantic", score: 0.99 }],
  );

  assert.deepEqual(merged.map((result) => result.blockId), ["exact", "unrelated-semantic"]);
  assert.equal(merged[1].score <= 0.5, true);
});
