import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coordinationMigrationPath = path.join(
  repositoryRoot,
  "sql/migrations/20260725180000_media_delete_reservation_saga.sql",
);
const hardeningMigrationPath = path.join(
  repositoryRoot,
  "sql/migrations/20260726070000_media_coordination_rpc_acl_hardening.sql",
);
const liveQaGuardPath = path.join(
  repositoryRoot,
  "scripts/lib/media-live-qa-guard.mts",
);

const currentSignatures = [
  "public.assert_media_catalog_coordination_ready(text, text, text, text)",
  "public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text)",
  "public.complete_media_reference_write_lease(uuid, text)",
  "public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean)",
  "public.resolve_media_reference_write_lease(uuid, uuid, text, text)",
  "public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text)",
  "public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean)",
  "public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text)",
  "public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text)",
  "public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz)",
  "public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz)",
  "public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz)",
  "public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb)",
  "public.get_media_reference_provider_revision(text)",
  "public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text)",
  "public.replace_media_references_for_provider(text, jsonb, uuid, bigint)",
].map(normalizeSignature);

let passed = 0;

function check(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

function normalizeSignature(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sameSet(left, right) {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

function splitParameters(value) {
  const parameters = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      current += character;
      if (character === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parameters.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) parameters.push(current.trim());
  return parameters;
}

function normalizeParameterType(value) {
  const withoutDefault = value
    .replace(/\s+default\s+[\s\S]*$/i, "")
    .replace(/\s*=\s*[\s\S]*$/, "")
    .trim()
    .replace(/^(?:inout|in|out|variadic)\s+/i, "");
  const tokens = withoutDefault.split(/\s+/);
  const type = tokens[0]?.startsWith("p_") ? tokens.slice(1).join(" ") : withoutDefault;
  return type
    .toLowerCase()
    .replace(/timestamp\s+with\s+time\s+zone/g, "timestamptz")
    .replace(/timestamp\s+without\s+time\s+zone/g, "timestamp")
    .replace(/character\s+varying/g, "varchar")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFunctionDefinitions(source, migrationName, migrationOrder) {
  const definitions = [];
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+(public\.[a-z0-9_]+)\s*\(/gi;
  for (const match of source.matchAll(pattern)) {
    const openParenthesis = match.index + match[0].lastIndexOf("(");
    let depth = 0;
    let closeParenthesis = -1;
    let quote = null;
    for (let index = openParenthesis; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === quote && source[index - 1] !== "\\") quote = null;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          closeParenthesis = index;
          break;
        }
      }
    }
    if (closeParenthesis < 0) throw new Error(`FAIL unclosed function signature in ${migrationName}`);

    const parameters = splitParameters(
      source.slice(openParenthesis + 1, closeParenthesis),
    ).map(normalizeParameterType);
    const declarationTail = source.slice(closeParenthesis + 1);
    const bodyMarker = declarationTail.search(/\bas\s+\$[a-z0-9_]*\$/i);
    const declaration = declarationTail.slice(
      0,
      bodyMarker < 0 ? declarationTail.indexOf(";") : bodyMarker,
    );
    definitions.push({
      migrationName,
      name: match[1].toLowerCase(),
      signature: normalizeSignature(`${match[1]}(${parameters.join(", ")})`),
      order: migrationOrder * 1_000_000_000 + match.index,
      securityDefiner: /\bsecurity\s+definer\b/i.test(declaration),
    });
  }
  return definitions;
}

function parseAclEvents(source, migrationOrder) {
  const events = [];
  const pattern = /\b(grant|revoke)\s+(?:execute|all(?:\s+privileges)?)\s+on\s+(?:function|routine)\s+(public\.[^(;]+\([^;]*?\))\s+(?:to|from)\s+([^;]+);/gi;
  for (const match of source.matchAll(pattern)) {
    const roles = match[3]
      .replace(/\s+(?:with\s+grant\s+option|cascade|restrict)\s*$/i, "")
      .split(",")
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
    for (const role of roles) {
      events.push({
        action: match[1].toLowerCase(),
        signature: normalizeSignature(match[2]),
        role,
        order: migrationOrder * 1_000_000_000 + match.index,
      });
    }
  }
  return events;
}

const coordinationMigration = fs.readFileSync(coordinationMigrationPath, "utf8");
const hardeningMigration = fs.readFileSync(hardeningMigrationPath, "utf8");
const liveQaGuard = fs.readFileSync(liveQaGuardPath, "utf8");
const hardeningSha256 = createHash("sha256")
  .update(hardeningMigration.replace(/\r\n/g, "\n"), "utf8")
  .digest("hex")
  .toUpperCase();

check(
  liveQaGuard.includes(`MEDIA_COORDINATION_ACL_MIGRATION_VERSION = "20260726070000"`)
    && liveQaGuard.includes(`"${hardeningSha256}"`),
  "destructive QA authority is pinned to the exact corrective migration version and SHA-256",
);

const coordinationGrantSignatures = [...coordinationMigration.matchAll(
  /grant\s+execute\s+on\s+function\s+(public\.[^(;]+\([^;]+?\))\s+to\s+service_role\s*;/gi,
)].map((match) => normalizeSignature(match[1]));

check(currentSignatures.length === 16, "hardening contract names exactly 16 RPC signatures");
check(
  coordinationGrantSignatures.length === 16
    && sameSet(coordinationGrantSignatures, currentSignatures),
  "hardening signatures exactly match the coordination migration service-role RPC surface",
);

const executableSql = hardeningMigration
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const statements = executableSql
  .split(";")
  .map((statement) => statement.trim().replace(/\s+/g, " "))
  .filter(Boolean);

check(statements.length === 34, "hardening migration contains only one transaction and 32 ACL statements");
check(statements[0].toLowerCase() === "begin", "hardening migration begins atomically");
check(statements.at(-1)?.toLowerCase() === "commit", "hardening migration commits atomically");

const revokePattern = /^revoke execute on function (public\.[^(]+\([^)]*\)) from public, anon, authenticated$/i;
const grantPattern = /^grant execute on function (public\.[^(]+\([^)]*\)) to service_role$/i;
const revokeSignatures = [];
const grantSignatures = [];

for (const statement of statements.slice(1, -1)) {
  const revoke = statement.match(revokePattern);
  const grant = statement.match(grantPattern);
  check(Boolean(revoke || grant), `ACL-only statement: ${statement.split(" ").slice(0, 6).join(" ")}`);
  if (revoke) revokeSignatures.push(normalizeSignature(revoke[1]));
  if (grant) grantSignatures.push(normalizeSignature(grant[1]));
}

check(
  revokeSignatures.length === 16 && sameSet(revokeSignatures, currentSignatures),
  "every coordination RPC revokes PUBLIC, anon, and authenticated exactly once",
);
check(
  grantSignatures.length === 16 && sameSet(grantSignatures, currentSignatures),
  "every coordination RPC grants service_role exactly once",
);
check(
  !/alter\s+default\s+privileges|create\s+(?:or\s+replace\s+)?function|create\s+table|alter\s+table|drop\s+|insert\s+into|update\s+|delete\s+from|truncate\s+/i.test(executableSql),
  "hardening migration contains no function logic, schema, default-privilege, or data mutation",
);

const migrationDirectory = path.join(repositoryRoot, "sql/migrations");
const coordinationMigrationName = path.basename(coordinationMigrationPath);
const migrationSources = fs.readdirSync(migrationDirectory)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name) && name >= coordinationMigrationName)
  .sort()
  .map((name, order) => ({
    name,
    order,
    source: fs.readFileSync(path.join(migrationDirectory, name), "utf8"),
  }));
const coordinationDefinitions = migrationSources
  .flatMap(({ name, order, source }) => parseFunctionDefinitions(source, name, order))
  .filter((definition) =>
    definition.migrationName === coordinationMigrationName
      || (
        definition.securityDefiner
        && (
          definition.migrationName.toLowerCase().includes("media")
          || definition.name.includes("media")
        )
      ),
  );
const aclEvents = migrationSources.flatMap(({ order, source }) =>
  parseAclEvents(source, order));
const broadBrowserGrantPattern = /\bgrant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+all\s+(?:functions|routines)\s+in\s+schema\s+public\s+to\s+([^;]+);/gi;
const defaultBrowserGrantPattern = /\balter\s+default\s+privileges[\s\S]*?\bgrant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+(?:functions|routines)\s+to\s+([^;]+);/gi;
for (const { name, source } of migrationSources) {
  for (const pattern of [broadBrowserGrantPattern, defaultBrowserGrantPattern]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const roles = match[1]
        .replace(/\s+with\s+grant\s+option\s*$/i, "")
        .split(",")
        .map((role) => role.trim().toLowerCase());
      check(
        !roles.some((role) => ["public", "anon", "authenticated"].includes(role)),
        `architecture guard rejects broad browser-role function grants in ${name}`,
      );
    }
  }
}

check(
  sameSet(
    coordinationDefinitions
      .filter((definition) => definition.migrationName === coordinationMigrationName)
      .map((definition) => definition.signature),
    currentSignatures,
  ),
  "current coordination function definitions exactly match the protected 16-signature surface",
);
for (const signature of sortedUnique(
  coordinationDefinitions.map((definition) => definition.signature),
)) {
  const latestDefinitionOrder = Math.max(
    ...coordinationDefinitions
      .filter((definition) => definition.signature === signature)
      .map((definition) => definition.order),
  );
  for (const [role, requiredAction] of [
    ["public", "revoke"],
    ["anon", "revoke"],
    ["authenticated", "revoke"],
    ["service_role", "grant"],
  ]) {
    const finalEvent = aclEvents
      .filter((event) =>
        event.signature === signature
        && event.role === role
        && event.order > latestDefinitionOrder,
      )
      .sort((left, right) => left.order - right.order)
      .at(-1);
    check(
      finalEvent?.action === requiredAction,
      `architecture guard leaves ${role} ${requiredAction} as the final ACL action for ${signature}`,
    );
  }
}

console.log(`verify-media-coordination-rpc-acl passed (${passed}/${passed}).`);
