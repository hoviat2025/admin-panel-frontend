import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewFiles, reviewZip } from "../src/lib/duplicateReviewExport.ts";
import { combineDuplicateFiles } from "../src/lib/businessDuplicates.ts";

const rec = (id, fresh) => ({ id, title: `Business ${id}`, city: "Berlin", address: null, phones: [],
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", description_excerpt: null,
  review_status: fresh ? "new" : "previously_checked" });
const options = { exportId: "run-1", checkedThrough: "2026-01-01T00:00:00Z", startedAt: "2026-01-02T00:00:00Z", maxRecords: 4, filters: { city: null, parent_id: null } };
const group = (keep, remove) => ({ keep_id: keep, remove_ids: remove, confidence: "likely", reason: "همان نام و نشانی" });
const result = (part, groups, total = 2, id = "run-1") => JSON.stringify({ schema_version: "1.0", export_id: id, part_number: part, total_parts: total, groups });

test("each new-old comparison is present exactly once; all new rows repeat and only part 1 checks new-new", () => {
  const records = [rec(10, true), rec(11, true), ...[1, 2, 3, 4, 5].map(id => rec(id, false))];
  const files = buildReviewFiles(records, options);
  const parts = files.slice(1).map(f => JSON.parse(f.content));
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map(p => p.review_context.include_new_new), [true, false, false]);
  const pairs = new Map();
  for (const p of parts) {
    assert(p.records.length <= 4);
    assert.deepEqual(p.records.filter(r => r.review_status === "new").map(r => r.id), [10, 11]);
    for (const old of p.records.filter(r => r.review_status === "previously_checked")) {
      for (const id of [10, 11]) pairs.set(`${id}:${old.id}`, (pairs.get(`${id}:${old.id}`) || 0) + 1);
    }
  }
  assert.equal(pairs.size, 10);
  assert([...pairs.values()].every(count => count === 1));
  assert.equal(JSON.parse(files[0].content).total_parts, 3);
});

test("empty new set, all-new set and over-budget new set are handled without dropping rows", () => {
  assert.deepEqual(buildReviewFiles([rec(1, false)], options), []);
  const files = buildReviewFiles([rec(1, true), rec(2, true)], { ...options, maxRecords: 2 });
  assert.equal(files.length, 2);
  assert.equal(JSON.parse(files[1].content).records.length, 2);
  assert.throws(() => buildReviewFiles([rec(1, true), rec(2, true), rec(3, false)], { ...options, maxRecords: 2 }));
  assert.throws(() => buildReviewFiles([rec(1, true), rec(1, false)], options));
  assert.throws(() => buildReviewFiles([{ ...rec(1, true), review_status: undefined }], options));
});

test("ZIP has valid offsets, UTF-8 body, known CRC-32 and central directory count", () => {
  const bytes = reviewZip([{ name: "ascii.txt", content: "123456789" }, { name: "part.json", content: JSON.stringify({ text: "فارسی" }) }]);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  const central = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(central, true), 0x02014b50);
  assert.equal(view.getUint32(central + 42, true), 0);
  const second = 30 + "ascii.txt".length + 9;
  const bodyStart = second + 30 + "part.json".length;
  const bodyLength = view.getUint32(second + 22, true);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes.slice(bodyStart, bodyStart + bodyLength))), { text: "فارسی" });
});

test("identical suggestions across sessions deduplicate and all-part coverage includes empty results", () => {
  const combined = combineDuplicateFiles([result(1, [group(10, [1])]), result(2, [group(10, [1])])]);
  assert.equal(combined.groups.length, 1);
  assert.deepEqual(combined.reviews, {});
  assert.equal(combined.coverage.complete, true);
  assert.equal(combineDuplicateFiles([result(1, [])]).coverage.complete, false);
  assert.equal(combineDuplicateFiles([result(1, []), result(2, [])]).coverage.complete, true);
});

test("cross-session overlap becomes possible with every original proposal retained; never automatic transitive deletion", () => {
  const combined = combineDuplicateFiles([result(1, [group(1, [10])]), result(2, [group(2, [10])])]);
  assert.equal(combined.groups.length, 1);
  assert.equal(combined.groups[0].confidence, "possible");
  assert.deepEqual([combined.groups[0].keep_id, ...combined.groups[0].remove_ids].sort((a,b) => a-b), [1, 2, 10]);
  assert.equal(Object.values(combined.reviews)[0].length, 2);
});

test("mixed exports, repeated part numbers, malformed metadata and overlapping IDs inside one AI file are rejected", () => {
  assert.throws(() => combineDuplicateFiles([result(1, []), result(2, [], 2, "run-2")]));
  assert.throws(() => combineDuplicateFiles([result(1, []), result(1, [])]));
  assert.throws(() => combineDuplicateFiles([result(1, []), result(2, [], 3)]));
  assert.throws(() => combineDuplicateFiles([JSON.stringify({ schema_version: "1.0", export_id: "x", groups: [] })]));
  assert.throws(() => combineDuplicateFiles([result(1, [group(1, [10]), group(2, [10])])]));
  assert.equal(combineDuplicateFiles([JSON.stringify({ schema_version: "1.0", groups: [group(1, [2])] })]).groups.length, 1);
});
