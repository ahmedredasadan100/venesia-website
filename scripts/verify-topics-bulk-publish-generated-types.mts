import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryTypesPath = path.resolve("src/lib/database.types.ts");
const generatedTypesInput =
  process.env.TOPICS_BULK_PUBLISH_GENERATED_TYPES_PATH?.trim();

if (!generatedTypesInput) {
  throw new Error(
    "TOPICS_BULK_PUBLISH_GENERATED_TYPES_PATH is required and must point to Supabase-generated types from the disposable PostgreSQL 17 schema.",
  );
}

const generatedTypesPath = path.resolve(generatedTypesInput);
assert.notEqual(
  generatedTypesPath,
  repositoryTypesPath,
  "Generated provenance input must be a fresh artifact, not the checked-in contract.",
);

const normalize = (value: string) =>
  value.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");

const generatedTypes = normalize(readFileSync(generatedTypesPath, "utf8"));
const repositoryTypes = normalize(readFileSync(repositoryTypesPath, "utf8"));
const marker = "      admin_publish_topics_atomically: {";

function extractRpcEntry(source: string, label: string) {
  const first = source.indexOf(marker);
  assert.notEqual(first, -1, `${label} is missing ${marker.trim()}.`);
  assert.equal(
    source.indexOf(marker, first + marker.length),
    -1,
    `${label} contains more than one admin_publish_topics_atomically entry.`,
  );

  const openingBrace = source.indexOf("{", first);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(first, index + 1);
  }

  throw new Error(`${label} has an unterminated RPC type entry.`);
}

const generatedEntry = extractRpcEntry(generatedTypes, "generated types");
const repositoryEntry = extractRpcEntry(repositoryTypes, "repository types");
assert.equal(
  repositoryEntry,
  generatedEntry,
  "Checked-in database.types.ts must contain the fresh generated RPC entry byte-for-byte, with no local override.",
);

console.log(
  "PASS Topics bulk-publish generated-types provenance: fresh Supabase generator output and checked-in RPC Args/Return match byte-for-byte.",
);
