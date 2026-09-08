import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryTypesPath = path.resolve("src/lib/database.types.ts");
const generatedTypesInput =
  process.env.TAXONOMY_CONSISTENCY_GENERATED_TYPES_PATH?.trim();

if (!generatedTypesInput) {
  throw new Error(
    "TAXONOMY_CONSISTENCY_GENERATED_TYPES_PATH is required and must point to Supabase-generated types from the disposable PostgreSQL 17 schema.",
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

const expectedEntries = {
  admin_create_topic_series: `      admin_create_topic_series: {
        Args: {
          p_actor_id: number
          p_category_id: number
          p_name: string
          p_slug: string
          p_status: string
        }
        Returns: Json
      }`,
  admin_update_topic_category: `      admin_update_topic_category: {
        Args: {
          p_actor_id: number
          p_category_id: number
          p_color_token: string
          p_expected_updated_at: string
          p_is_active: boolean
          p_name: string
          p_parent_id: number
        }
        Returns: Json
      }`,
  admin_update_topic_series: `      admin_update_topic_series: {
        Args: {
          p_actor_id: number
          p_category_id: number
          p_expected_updated_at: string
          p_name: string
          p_series_id: number
          p_status: string
        }
        Returns: Json
      }`,
} as const;

function extractRpcEntry(source: string, name: keyof typeof expectedEntries, label: string) {
  const marker = `      ${name}: {`;
  const first = source.indexOf(marker);
  assert.notEqual(first, -1, `${label} is missing ${name}.`);
  assert.equal(
    source.indexOf(marker, first + marker.length),
    -1,
    `${label} contains more than one ${name} entry.`,
  );

  const openingBrace = source.indexOf("{", first);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(first, index + 1);
  }

  throw new Error(`${label} has an unterminated ${name} RPC type entry.`);
}

for (const name of Object.keys(expectedEntries) as Array<
  keyof typeof expectedEntries
>) {
  const generatedEntry = extractRpcEntry(generatedTypes, name, "generated types");
  const repositoryEntry = extractRpcEntry(repositoryTypes, name, "repository types");
  assert.equal(
    generatedEntry,
    expectedEntries[name],
    `Fresh Supabase output changed the exact ${name} name, Args, nullability/type, or Returns contract. Unexpected overloads are not allowed.`,
  );
  assert.equal(
    repositoryEntry,
    generatedEntry,
    `Checked-in database.types.ts must contain the fresh ${name} entry byte-for-byte, with no local override.`,
  );
}

console.log(
  "PASS Taxonomy consistency generated-types provenance: three fresh Supabase RPC entries match exact names, Args, nullability/types, Returns, and contain no generated overload shape.",
);
