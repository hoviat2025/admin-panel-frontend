import test from "node:test";
import assert from "node:assert/strict";
import { parseDuplicateFile, readableDuplicateReport } from "../src/lib/businessDuplicates.ts";

const group = { keep_id: 3, remove_ids: [1, 2], confidence: "likely", reason: "نام و نشانی یکسان است." };
const file = groups => JSON.stringify({ schema_version: "1.0", groups });

test("accepts valid AI output, possible groups, empty results and a UTF-8 BOM", () => {
  assert.deepEqual(parseDuplicateFile("\uFEFF" + file([group])), [group]);
  assert.equal(parseDuplicateFile(file([{ ...group, confidence: "possible" }])).length, 1);
  assert.deepEqual(parseDuplicateFile(file([])), []);
});

test("rejects overlapping keepers/removals across the entire imported file", () => {
  for (const second of [{ ...group, keep_id: 4 }, { ...group, keep_id: 1, remove_ids: [5] }]) {
    assert.throws(() => parseDuplicateFile(file([group, second])));
  }
});

test("rejects malformed groups, invalid IDs and AI-supplied preview tokens", () => {
  for (const changed of [{ remove_ids: [] }, { keep_id: 1 }, { keep_id: "3" }, { keep_id: 0 },
    { keep_id: Number.MAX_SAFE_INTEGER + 1 }, { confidence: "certain" }, { reason: "" },
    { preview_token: "forged" }, { remove_ids: Array.from({ length: 20 }, (_, i) => i + 100) }]) {
    assert.throws(() => parseDuplicateFile(file([{ ...group, ...changed }])));
  }
  assert.throws(() => parseDuplicateFile("not json"));
  assert.throws(() => parseDuplicateFile(JSON.stringify({ schema_version: "2", groups: [] })));
});

test("downloadable text report retains full details and keep-only plan", () => {
  const report = readableDuplicateReport([{ ...group, action: "preview", records: [{ service: { id: 1, name: "Example", description: "full text" }, contacts: [], categories: [], bookmarks: [] }], plan: { operation: "keep_unchanged_archive_others", keep_id: 3, archive_ids: [1, 2], blocked: [] } }]);
  assert.match(report, /full text/);
  assert.match(report, /keep_unchanged_archive_others/);
  assert.match(report, /Example/);
});
