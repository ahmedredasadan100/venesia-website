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
const requiredRoleActions = [
  ["public", "revoke"],
  ["anon", "revoke"],
  ["authenticated", "revoke"],
  ["service_role", "grant"],
];
const coordinationParameterTypes = new Set(currentSignatures.flatMap((signature) =>
  splitParameters(signature.slice(signature.indexOf("(") + 1, -1))));

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
      replace: /^create\s+or\s+replace\b/i.test(match[0]),
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

function parseFunctionDrops(source, migrationOrder) {
  // Ignore rollback comments and function-body strings without changing offsets.
  const statements = source.replace(
    /--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\$([a-z0-9_]*)\$[\s\S]*?\$\1\$/gi,
    (value) => value.replace(/[^\r\n]/g, " "),
  );
  const drops = [];
  const pattern = /\bdrop\s+(?:function|routine)\s+(?:if\s+exists\s+)?([^;]+);/gi;
  for (const match of statements.matchAll(pattern)) {
    for (const target of splitParameters(match[1].replace(/\s+(?:cascade|restrict)\s*$/i, ""))) {
      const identity = target.match(/^(public\.[a-z0-9_]+)\s*(?:\(([\s\S]*)\))?$/i);
      if (!identity) throw new Error(`FAIL unsupported DROP function identity: ${target}`);
      const parameters = identity[2] === undefined ? null : splitParameters(identity[2]).map((parameter) => {
        // OUT parameters do not belong to PostgreSQL's input identity. This
        // bounded guard rejects them instead of mistaking a no-op DROP for removal.
        if (/^out\s+/i.test(parameter)) return null;
        const type = normalizeParameterType(parameter);
        if (coordinationParameterTypes.has(type)) return type;
        // DROP permits optional argument names and modes. Recognize the existing
        // contract's types; unfamiliar type syntax must fail closed for this name.
        const named = parameter.replace(/^(?:inout|in|out|variadic)\s+/i, "")
          .match(/^[a-z_][a-z0-9_]*\s+([\s\S]+)$/i);
        const namedType = named && normalizeParameterType(named[1]);
        return coordinationParameterTypes.has(namedType) ? namedType : null;
      });
      drops.push({
        name: identity[1].toLowerCase(),
        signature: parameters === null || parameters.includes(null)
          ? null
          : normalizeSignature(`${identity[1]}(${parameters.join(", ")})`),
        unsupported: parameters?.includes(null) ?? false,
        order: migrationOrder * 1_000_000_000 + match.index,
      });
    }
  }
  return drops;
}

function resolveFunctionAcl(signature, definitions, drops, aclEvents) {
  const name = signature.slice(0, signature.indexOf("("));
  const events = [
    ...definitions.map((event) => ({ ...event, kind: "definition" })),
    ...drops.map((event) => ({ ...event, kind: "drop" })),
    ...aclEvents.map((event) => ({ ...event, kind: "acl" })),
  ].filter((event) => event.signature === signature
    || (event.kind === "drop" && event.signature === null && event.name === name))
    .sort((left, right) => left.order - right.order);
  let exists = false;
  let defined = false;
  let removedByDrop = false;
  let unsupportedDrop = false;
  const roleActions = new Map();
  for (const event of events) {
    if (event.kind === "drop") {
      if (event.unsupported) {
        unsupportedDrop = true;
        continue;
      }
      exists = false;
      removedByDrop = defined;
      // Retain the historical ACL policy even for removed identities. A DROP
      // parsed from comment text must never erase or bypass a browser grant.
    } else if (event.kind === "definition") {
      // PostgreSQL preserves ACL only when OR REPLACE replaces the same object.
      // Initial creation, another overload, and DROP/recreation need their own ACL.
      if (!event.replace || !exists) roleActions.clear();
      exists = true;
      defined = true;
      removedByDrop = false;
    } else if (defined) {
      roleActions.set(event.role, event.action);
    }
  }
  return { exists, removedByDrop, unsupportedDrop, roleActions };
}

function parseBroadFunctionGrants(source) {
  const patterns = [
    /\bgrant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+all\s+(?:functions|routines)\s+in\s+schema\s+public\s+to\s+([^;]+);/gi,
    /\balter\s+default\s+privileges[\s\S]*?\bgrant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+(?:functions|routines)\s+to\s+([^;]+);/gi,
  ];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) =>
    match[1].replace(/\s+with\s+grant\s+option\s*$/i, "")
      .split(",")
      .map((role) => role.trim().toLowerCase())));
}

function grantsBrowserRole(roles) {
  return roles.some((role) => ["public", "anon", "authenticated"].includes(role));
}

function verifyAclLifecycleControls() {
  const signature = "public.acl_guard_fixture(text)";
  const overload = "public.acl_guard_fixture(bigint)";
  const create = (target = signature, replace = false) =>
    `create ${replace ? "or replace " : ""}function ${target} returns integer language sql security definer as $$ select 1 $$;`;
  const restrict = (target = signature) =>
    `revoke execute on function ${target} from public, anon, authenticated; grant execute on function ${target} to service_role;`;
  const initial = [create(), restrict()];
  const replacement = create(signature, true);
  const isSecure = (sources, target = signature) => {
    const definitions = sources.flatMap((source, order) =>
      parseFunctionDefinitions(source, `control-${order}.sql`, order));
    const drops = sources.flatMap((source, order) => parseFunctionDrops(source, order));
    const events = sources.flatMap((source, order) => parseAclEvents(source, order));
    const acl = resolveFunctionAcl(target, definitions, drops, events);
    return !acl.unsupportedDrop && (acl.exists || acl.removedByDrop)
      && requiredRoleActions.every(([role, action]) => acl.roleActions.get(role) === action)
      && !sources.some((source) => parseBroadFunctionGrants(source).some(grantsBrowserRole));
  };
  const controls = [
    ["initial creation requires its own complete ACL", initial, true],
    ["same-signature OR REPLACE preserves restricted ACL", [...initial, replacement], true],
    ["repeated OR REPLACE preserves restricted ACL", [...initial, replacement, replacement], true],
    ["initial CREATE retains unsafe default execution without ACL", [create()], false],
    ["OR REPLACE first creation cannot inherit an ACL", [replacement], false],
    ["ACL statements before creation cannot establish its ACL", [restrict(), replacement], false],
    ["new overload cannot inherit the original ACL", [...initial, create(overload, true)], false, overload],
    ["new overload leaves the original ACL intact", [...initial, create(overload, true)], true],
    ["DROP and CREATE cannot inherit the removed ACL", [...initial, `drop function ${signature};`, create()], false],
    ["DROP and OR REPLACE cannot inherit the removed ACL", [...initial, `drop function if exists ${signature};`, replacement], false],
    ["name-only DROP and OR REPLACE cannot inherit the removed ACL", [...initial, "drop function if exists public.acl_guard_fixture;", replacement], false],
    ["named/mode DROP arguments cannot preserve stale ACL", [...initial, "drop function public.acl_guard_fixture(IN arbitrary text);", replacement], false],
    ["unsupported DROP type syntax fails closed", [...initial, "drop function if exists public.acl_guard_fixture(int8);", replacement], false],
    ["unsupported DROP cannot hide a later unsafe grant", [...initial, "drop function if exists public.acl_guard_fixture(int8);", `grant execute on function ${signature} to anon;`], false],
    ["OUT-only DROP cannot hide a later unsafe grant on the input identity", [...initial, "drop function if exists public.acl_guard_fixture(OUT arbitrary text);", `grant execute on function ${signature} to authenticated;`], false],
    ["multi-signature DROP invalidates the matching identity", [...initial, `drop function if exists ${overload}, ${signature} cascade;`, replacement], false],
    ["DROP of another overload leaves the original ACL intact", [...initial, `drop function if exists ${overload};`, replacement], true],
    ["explicit DROP retains historical restrictive-policy validation", [...initial, `drop function ${signature};`], true],
    ["nested-comment DROP cannot hide an earlier unsafe grant", [...initial, `grant execute on function ${signature} to authenticated; /* outer /* inner */ drop function ${signature}; */`], false],
    ["nested-comment DROP cannot hide a later unsafe grant", [...initial, `/* outer /* inner */ drop function ${signature}; */ grant execute on function ${signature} to authenticated;`], false],
    ["real DROP cannot bypass missing historical ACL", [create(), `drop function ${signature};`], false],
    ["missing definitions cannot be treated as a safely removed identity", [restrict()], false],
    ["DROP IF EXISTS without a definition cannot establish a safe identity", [`drop function if exists ${signature};`], false],
    ["recreation with fresh restrictive ACL is accepted", [...initial, `drop function ${signature};`, replacement, restrict()], true],
    ["commented DROP cannot reset the live ACL", [...initial, `-- drop function ${signature};\n/* drop function ${signature}; */`, replacement], true],
    ["DROP text inside a function body cannot reset the live ACL", [...initial, `create function public.other_fixture() returns text language sql as $body$ select 'drop function ${signature};' $body$;`, replacement], true],
    ["missing explicit browser-role revokes remains rejected", [create(), `revoke execute on function ${signature} from public; grant execute on function ${signature} to service_role;`, replacement], false],
    ["service-role revocation after replacement remains rejected", [...initial, replacement, `revoke execute on function ${signature} from service_role;`], false],
    ["multi-role browser grants after replacement remain rejected", [...initial, replacement, `grant execute on function ${signature} to public, anon, authenticated;`], false],
    ["explicit restrictive repair after an unsafe grant is accepted", [...initial, replacement, `grant execute on function ${signature} to authenticated;`, restrict()], true],
  ];
  for (const role of ["public", "anon", "authenticated"]) {
    controls.push(
      [`${role} grant after replacement remains rejected`, [...initial, replacement, `grant execute on function ${signature} to ${role};`], false],
      [`${role} grant before replacement is not erased`, [...initial, `grant execute on function ${signature} to ${role};`, replacement], false],
      [`broad ${role} function grant remains rejected`, [...initial, replacement, `grant execute on all functions in schema public to ${role};`], false],
      [`default ${role} function grant remains rejected`, [...initial, replacement, `alter default privileges in schema public grant execute on functions to ${role};`], false],
    );
  }
  for (const [label, sources, expected, target] of controls) {
    check(isSecure(sources, target) === expected, `ACL lifecycle control: ${label}`);
  }
}

verifyAclLifecycleControls();

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
const allDefinitions = migrationSources
  .flatMap(({ name, order, source }) => parseFunctionDefinitions(source, name, order));
const coordinationDefinitions = allDefinitions
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
const functionDrops = migrationSources.flatMap(({ order, source }) =>
  parseFunctionDrops(source, order));
for (const { name, source } of migrationSources) {
  for (const roles of parseBroadFunctionGrants(source)) {
    check(
      !grantsBrowserRole(roles),
      `architecture guard rejects broad browser-role function grants in ${name}`,
    );
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
  const acl = resolveFunctionAcl(signature, allDefinitions, functionDrops, aclEvents);
  check(!acl.unsupportedDrop, `architecture guard understands DROP identity history for ${signature}`);
  if (acl.removedByDrop) {
    check(acl.removedByDrop, `architecture guard confirms the obsolete function was explicitly dropped: ${signature}`);
  }
  check(acl.exists || acl.removedByDrop, `architecture guard resolves the protected function identity ${signature}`);
  for (const [role, requiredAction] of requiredRoleActions) {
    check(
      acl.roleActions.get(role) === requiredAction,
      `architecture guard leaves ${role} ${requiredAction} as the final ACL action for ${signature}`,
    );
  }
}

console.log(`verify-media-coordination-rpc-acl passed (${passed}/${passed}).`);
