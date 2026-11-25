// No browser, network requests, database or new test dependencies.
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, after } from "node:test";
import { build } from "esbuild";

const temporary = await mkdtemp(path.join(tmpdir(), "category-import-tests-"));
after(() => rm(temporary, { recursive: true, force: true }));
const output = path.join(temporary, "imports.mjs");
await build({
  stdin: { contents: 'export * from "./src/lib/categoryImport"; export * from "./src/lib/businessImport";', resolveDir: process.cwd(), loader: "ts" },
  outfile: output, bundle: true, platform: "node", format: "esm", tsconfig: "tsconfig.app.json",
  define: { "import.meta.env": JSON.stringify({ VITE_API_URL: "https://unused.invalid/api" }) },
});
const { mergeDefinitions, prepareCategoryImport, prepareImport, baseDefinitions, categoryDocument } = await import(pathToFileURL(output).href);
const group = { key: "test-group", name: "گروه نمونه" };
const child = { key: "test-child", name: "دسته نمونه", primary_parent_key: group.key, parent_keys: [group.key] };
const file = (doc, name = "test.json") => new File([JSON.stringify(doc)], name, { type: "application/json" });
const document = (suggestions = { parents: [], categories: [] }) => ({
  schema_version: "1.0", category_suggestions: suggestions, skipped: [],
  sources: [{ source_ref: "p", raw_text: "Original" }],
  businesses: [{ service: { name: "Business", source: "telegram", external_id: "example:42:1" },
    category_assignments: [{ category_key: "restaurants", is_primary: true }],
    metadata: { source_ref: "p" } }],
});

test("standalone import needs no businesses; duplicate definitions merge and export round-trips", async () => {
  const input = { schema_version: "1.0", parents: [group], categories: [child] };
  const defs = await prepareCategoryImport([file(input), file(input, "again.json")]);
  assert.equal(defs.length, 2);
  assert.deepEqual(await prepareCategoryImport([file(categoryDocument(defs))]), defs);
});

test("invalid hierarchy, duplicate conflicts, malformed parents and blank names are rejected", () => {
  for (const input of [
    { parents: [group], categories: [{ ...child, parent_keys: [] }] },
    { parents: [group], categories: [child, { ...child, name: "Conflicting" }] },
    { parents: [group], categories: [child, { ...child, key: "third", primary_parent_key: child.key, parent_keys: [child.key] }] },
    { parents: [{ key: "blank", name: " " }], categories: [] },
    { parents: [group], categories: [{ ...child, parent_keys: "test-group" }] },
  ]) assert.throws(() => mergeDefinitions([input]));
});

test("combined import keeps the entire base catalogue and unused suggestions", async () => {
  const base = baseDefinitions();
  const existingChild = base.find(d => d.parent_keys?.length);
  const doc = document({ parents: [group], categories: [child] });
  doc.businesses[0].category_assignments[0].category_key = existingChild.key;
  const prepared = await prepareImport([file(doc)]);
  assert.equal(prepared.definitions.length, base.length + 2);
  assert(prepared.definitions.some(d => d.key === child.key));
  assert.equal(prepared.rows.length, 1);
  assert.equal(prepared.rows[0].sources[0].raw_text, "Original");
});

test("category-only import extracts suggestions without importing businesses", async () => {
  const defs = await prepareCategoryImport([file(document({ parents: [group], categories: [child] }))]);
  assert.equal(defs.length, 2);
  assert.equal(defs[1].key, child.key);
});

test("businesses cannot select a first-level group", async () => {
  const doc = document({ parents: [group], categories: [child] });
  doc.businesses[0].category_assignments[0].category_key = group.key;
  await assert.rejects(prepareImport([file(doc)]));
});

test("category keys normalize before duplicate and parent matching", () => {
  const defs = mergeDefinitions([{ parents: [{ key: "TEST_GROUP", name: group.name }], categories: [{ ...child, key: "TEST_CHILD", parent_keys: ["Test Group"], primary_parent_key: "test_group" }] }]);
  assert.equal(defs[0].key, group.key);
  assert.equal(defs[1].key, child.key);
  assert.deepEqual(defs[1].parent_keys, [group.key]);
});

test("optional extraction fixtures prepare and export as one reusable catalogue", { skip: !process.env.IMPORT_FIXTURES_DIR }, async () => {
  const directory = process.env.IMPORT_FIXTURES_DIR;
  const filenames = (await readdir(directory)).filter(n => n.endsWith(".json"));
  const files = await Promise.all(filenames.map(async n => new File([await readFile(path.join(directory, n))], n)));
  const prepared = await prepareImport(files);
  assert(prepared.rows.length > 0);
  const exported = await prepareCategoryImport([file(categoryDocument(prepared.definitions))]);
  assert.deepEqual(exported, prepared.definitions);
  console.log(`Validated ${prepared.rows.length} businesses and ${exported.length} category definitions from ${files.length} files.`);
});
