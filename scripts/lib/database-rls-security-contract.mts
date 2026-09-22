import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ts from "typescript";
import { assertMigrationSourceProvenance } from "./migration-provenance.mjs";

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
const VERSION = /^\d{14}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const TAG = "$venisia_security_contract$";
const TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];
const COLUMN_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "REFERENCES"];
const SEQUENCE_PRIVILEGES = ["SELECT", "UPDATE", "USAGE"];
const ALL_PRIVILEGES = [...new Set([...TABLE_PRIVILEGES, "USAGE", "CREATE", "EXECUTE"])];
type JsonObject = Record<string, unknown>;
export type SecurityGrantMap = Record<string, string[]>;
export type SecurityPolicy = { name: string; command: string; roles: string[]; permissive: boolean; using: string | null; withCheck: string | null };
export type SecurityRoleAttributeRule = "deny" | "require" | "allow";
export type SecurityRole = { name: string;
  classification: "application-public" | "application-server" | "platform-administration" | "platform-managed" | "postgres-built-in" | "conditional-platform-tooling";
  presence: "required" | "optional"; managedBy?: "supabase-cli-login-role";
  attributeRules: Record<"superuser" | "bypassRls" | "inherit" | "canLogin" | "createRole" | "createDb" | "replication", SecurityRoleAttributeRule> };
export type ObservedSecurityRole = { name: string; superuser: boolean; bypassRls: boolean; inherit: boolean; canLogin: boolean;
  createRole: boolean; createDb: boolean; replication: boolean };
export type SecurityMembership = { role: string; member: string; inheritOption: boolean; setOption: boolean; adminOption: boolean;
  presence: "required" | "optional"; classification?: "platform-managed" | "conditional-platform-tooling" };
export type ObservedSecurityMembership = Omit<SecurityMembership, "presence" | "classification">;
export type SecurityTable = { name: string; classification: "A" | "B" | "C"; owner: string; forceRls: boolean;
  grants: SecurityGrantMap; policies: SecurityPolicy[]; exception: { reason: string; approval: string } | null };
export type SecurityDefaultPrivileges = { owner: string; schema: string | null; objectType: string; grants: SecurityGrantMap };
export type SecurityColumnPrivileges = { table: string; column: string; role: string; privileges: string[]; grantable: string[] };
export type SecuritySequence = { name: string; owner: string; grants: SecurityGrantMap };
export type SecurityFunctionContract = { clientRoles: string[]; allowClientExecute: string[];
  forbidClientSecurityDefinerExecute: boolean; forbidClientGrantOptions: boolean; defaultClientExecute: boolean };
export type SecurityExistingDatabaseAdoption = {
  mode: "approved-existing-database";
  registry: { count: number; head: string; identitySha256: string; requiredReceipts: Array<{
    version: string; name: string; sourceSha256: string;
    productionWholeFileReceipt: { statementCount: 1; statementsSha256: string };
    supabaseCliV2116Receipt: { statementCount: number; statementsSha256: string };
  }> };
  tableStructureSha256: string;
  sequenceStructureSha256: string;
  extensionTables: SecurityTable[];
  extensionSequencePrivileges: SecuritySequence[];
};
export type DatabaseSecurityContract = {
  formatVersion: 2; contractId: "venisia-public-table-security"; revision: number;
  supersedes: { revision: number; migrationVersion: string; migrationSourceSha256: string } | null;
  existingDatabaseAdoption: SecurityExistingDatabaseAdoption | null;
  schema: "public"; clientRoles: string[]; ddlRoles: string[]; tables: SecurityTable[];
  roles: SecurityRole[]; memberships: SecurityMembership[];
  schemaPrivileges: Array<{ role: string; privileges: string[] }>;
  defaultPrivileges: SecurityDefaultPrivileges[];
  columnPrivileges: SecurityColumnPrivileges[]; sequencePrivileges: SecuritySequence[]; functionSecurity: SecurityFunctionContract;
};
export type SecurityMigrationSource = { version: string; name?: string; file?: string; sql: string; sha256?: string };
export type LoadedDatabaseSecurityContract = { contract: DatabaseSecurityContract; contractSha256: string; migrationVersion: string; migrationSourceSha256: string };
export type SecurityCatalogTable = Omit<SecurityTable, "classification" | "exception"> & {
  rlsEnabled: boolean; grantOptions: SecurityGrantMap;
  effectivePrivileges: SecurityGrantMap; effectiveColumnPrivileges: SecurityGrantMap;
};
export type DatabaseSecurityCatalog = Omit<DatabaseSecurityContract,
  "formatVersion" | "contractId" | "revision" | "supersedes" | "clientRoles" | "ddlRoles" | "tables" | "roles" | "memberships" | "sequencePrivileges" | "functionSecurity"> & {
  tables: SecurityCatalogTable[];
  roles: ObservedSecurityRole[]; memberships: ObservedSecurityMembership[];
  sequencePrivileges: Array<SecuritySequence & { effectivePrivileges: SecurityGrantMap }>;
  functionSecurity: { clientExecutable: string[]; securityDefinerClientExecutable: string[]; clientGrantOptions: string[]; defaultClientExecute: string[] };
  toolingRoles: Array<{ name: string; passwordConfigured: boolean; validUntil: string | null; activeSessions: number;
    ownsApplicationObjects: number; directApplicationAclEntries: number }>;
};
export type SecurityReadClient = { query(sql: string, parameters?: unknown[]): Promise<{ rows: unknown[] }> };

function object(value: unknown, label: string): JsonObject {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  return value as JsonObject;
}
function keys(value: JsonObject, expected: string[], label: string) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has missing or unknown fields.`);
}
function identifier(value: unknown, label: string, publicAllowed = false): asserts value is string {
  assert.equal(typeof value, "string", `${label} must be a name.`);
  assert.ok((publicAllowed && value === "PUBLIC") || IDENTIFIER.test(value as string), `${label} is not a canonical identifier.`);
}
function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array.`);
  return value;
}
function unique(values: string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate identities.`);
}
function names(value: unknown, label: string, publicAllowed = false): string[] {
  const result = array(value, label);
  for (const name of result) identifier(name, label, publicAllowed);
  unique(result as string[], label);
  return result as string[];
}
function bool(value: unknown, label: string) { assert.equal(typeof value, "boolean", `${label} must be boolean.`); }
function text(value: unknown, label: string) { assert.ok(typeof value === "string" && value.trim().length > 0, `${label} must be nonempty text.`); }
function privileges(value: unknown, allowed: string[], label: string): string[] {
  const result = array(value, label);
  assert.ok(result.every(item => typeof item === "string" && allowed.includes(item)), `${label} contains an unsupported privilege.`);
  unique(result as string[], label);
  return result as string[];
}
function grants(value: unknown, allowed: string[], label: string): SecurityGrantMap {
  const map = object(value, label);
  for (const [role, granted] of Object.entries(map)) {
    identifier(role, `${label} grantee`, true);
    privileges(granted, allowed, `${label}.${role}`);
  }
  return map as SecurityGrantMap;
}
function policy(value: unknown): SecurityPolicy {
  const row = object(value, "Policy");
  keys(row, ["name", "command", "roles", "permissive", "using", "withCheck"], "Policy");
  text(row.name, "Policy name");
  assert.ok(Buffer.byteLength(row.name as string, "utf8") <= 63 && !(row.name as string).includes("\0"), "Policy name is not a valid exact PostgreSQL identifier.");
  assert.ok(["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"].includes(row.command as string), "Unsupported policy command.");
  assert.ok(names(row.roles, "Policy roles", true).length > 0, "Policy roles cannot be empty.");
  bool(row.permissive, "Policy permissive");
  for (const field of ["using", "withCheck"]) if (row[field] !== null) text(row[field], `Policy ${field}`);
  return row as SecurityPolicy;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
function equal(actual: unknown, expected: unknown, label: string) { assert.deepEqual(canonical(actual), canonical(expected), label); }
function nonemptyGrants(value: SecurityGrantMap) { return Object.fromEntries(Object.entries(value).filter(([, entries]) => entries.length > 0)); }
const ROLE_ATTRIBUTES = ["superuser", "bypassRls", "inherit", "canLogin", "createRole", "createDb", "replication"] as const;
function assertRoleSecurity(contract: DatabaseSecurityContract, snapshot: DatabaseSecurityCatalog) {
  const declared = new Map(contract.roles.map(role => [role.name, role]));
  const observed = new Map(snapshot.roles.map(role => [role.name, role]));
  for (const role of snapshot.roles) assert.ok(declared.has(role.name), `Unclassified database role: ${role.name}`);
  for (const role of contract.roles) {
    const actual = observed.get(role.name);
    if (role.presence === "required") assert.ok(actual, `Required database role is missing: ${role.name}`);
    if (!actual) continue;
    for (const attribute of ROLE_ATTRIBUTES) {
      const rule = role.attributeRules[attribute];
      if (rule === "deny") assert.equal(actual[attribute], false, `Denied role attribute: ${role.name}/${attribute}`);
      if (rule === "require") assert.equal(actual[attribute], true, `Required role attribute: ${role.name}/${attribute}`);
    }
  }
  const rules = new Map(contract.memberships.map(row => [`${row.role}/${row.member}`, row]));
  const actualMemberships = new Map(snapshot.memberships.map(row => [`${row.role}/${row.member}`, row]));
  for (const membership of snapshot.memberships) {
    const rule = rules.get(`${membership.role}/${membership.member}`);
    assert.ok(rule, `Unclassified role membership: ${membership.role}/${membership.member}`);
    assert.deepEqual(membership, { role: rule.role, member: rule.member, inheritOption: rule.inheritOption,
      setOption: rule.setOption, adminOption: rule.adminOption }, `Role membership options changed: ${membership.role}/${membership.member}`);
  }
  for (const membership of contract.memberships.filter(row => row.presence === "required"))
    assert.ok(actualMemberships.has(`${membership.role}/${membership.member}`), `Required role membership is missing: ${membership.role}/${membership.member}`);
  const privileged = new Set(snapshot.roles.filter(role => role.superuser || role.bypassRls || role.createRole || role.createDb || role.replication)
    .map(role => role.name));
  privileged.add("service_role");
  for (const client of contract.clientRoles) {
    const reachable = new Set([client]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const membership of snapshot.memberships) if (reachable.has(membership.member)
        && (membership.inheritOption || membership.setOption || membership.adminOption) && !reachable.has(membership.role)) {
        reachable.add(membership.role); changed = true;
      }
    }
    assert.ok([...reachable].every(role => role === client || !privileged.has(role)), `Application role can reach privileged role: ${client}`);
  }
  const toolingNames = contract.roles.filter(role => role.classification === "conditional-platform-tooling").map(role => role.name);
  assert.deepEqual(snapshot.toolingRoles.map(row => row.name).sort(), toolingNames.filter(name => observed.has(name)).sort(), "Conditional tooling evidence is incomplete.");
  for (const tooling of snapshot.toolingRoles) {
    assert.equal(tooling.passwordConfigured, true, `Conditional tooling credential state is unavailable: ${tooling.name}`);
    assert.ok(tooling.validUntil !== null && Number.isFinite(Date.parse(tooling.validUntil)), `Conditional tooling expiry is unavailable: ${tooling.name}`);
    assert.equal(Number(tooling.activeSessions), 0, `Conditional tooling role has an active session: ${tooling.name}`);
    assert.equal(Number(tooling.ownsApplicationObjects), 0, `Conditional tooling role owns application objects: ${tooling.name}`);
    assert.equal(Number(tooling.directApplicationAclEntries), 0, `Conditional tooling role has direct application ACLs: ${tooling.name}`);
  }
  return { classifiedRoles: snapshot.roles.length, optionalRolesAbsent: contract.roles.filter(role => role.presence === "optional" && !observed.has(role.name)).map(role => role.name),
    memberships: snapshot.memberships.length, conditionalToolingRoles: snapshot.toolingRoles.map(role => role.name) };
}
const contractDigest = (contract: DatabaseSecurityContract) => createHash("sha256").update(JSON.stringify(contract), "utf8").digest("hex");
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Reject duplicate JSON keys instead of accepting JSON.parse's last-one-wins. */
function strictJson(source: string): unknown {
  const parsed: unknown = JSON.parse(source);
  const tree = ts.parseJsonText("migration-security-contract.json", source);
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const members = node.properties.map(property => {
        assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name), "Contract JSON keys must be strings.");
        return property.name.text;
      });
      unique(members, "Contract JSON object");
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return parsed;
}

export function validateDatabaseSecurityContract(value: unknown): DatabaseSecurityContract {
  const root = object(value, "Database security contract");
  keys(root, ["formatVersion", "contractId", "revision", "supersedes", "existingDatabaseAdoption", "schema", "clientRoles", "ddlRoles", "tables", "roles", "memberships", "schemaPrivileges", "defaultPrivileges", "columnPrivileges", "sequencePrivileges", "functionSecurity"], "Database security contract");
  assert.equal(root.formatVersion, 2);
  assert.equal(root.contractId, "venisia-public-table-security");
  assert.equal(root.schema, "public");
  assert.ok(Number.isSafeInteger(root.revision) && (root.revision as number) > 0, "Invalid security revision.");
  if (root.supersedes !== null) {
    const prior = object(root.supersedes, "Superseded contract");
    keys(prior, ["revision", "migrationVersion", "migrationSourceSha256"], "Superseded contract");
    assert.ok(Number.isSafeInteger(prior.revision) && (prior.revision as number) > 0);
    assert.match(prior.migrationVersion as string, VERSION);
    assert.match(prior.migrationSourceSha256 as string, HASH);
  }
  const clients = names(root.clientRoles, "Client roles");
  equal(clients, ["anon", "authenticated"], "The approved client-role boundary changed.");
  assert.ok(names(root.ddlRoles, "DDL roles").length > 0, "Migration creator roles must be explicit.");
  const tableRows = array(root.tables, "Tables");
  assert.ok(tableRows.length > 0, "Security classification cannot be empty.");
  for (const value of tableRows) {
    const table = object(value, "Table contract");
    keys(table, ["name", "classification", "owner", "forceRls", "grants", "policies", "exception"], "Table contract");
    identifier(table.name, "Table"); identifier(table.owner, "Table owner"); bool(table.forceRls, "FORCE RLS");
    assert.ok(["A", "B", "C"].includes(table.classification as string), "Unclassified/unknown security table.");
    const acl = grants(table.grants, TABLE_PRIVILEGES, `Table ${table.name}`);
    const policies = array(table.policies, "Table policies").map(policy);
    unique(policies.map(entry => entry.name), "Table policies");
    if (table.classification === "C") {
      const exception = object(table.exception, "Explicit RLS exception");
      keys(exception, ["reason", "approval"], "Explicit RLS exception");
      text(exception.reason, "Exception reason"); text(exception.approval, "Exception approval");
      assert.equal(table.forceRls, false, "RLS exception cannot claim FORCE RLS.");
    } else assert.equal(table.exception, null, "A/B tables cannot carry an RLS exception.");
    if (table.classification === "B") {
      assert.equal(policies.length, 0, "Server-only B table cannot have a client policy.");
      for (const role of ["PUBLIC", ...clients]) assert.equal((acl[role] ?? []).length, 0, "Server-only B table cannot grant client access.");
    }
    if (table.classification === "A") {
      assert.ok(policies.length > 0, "Client-readable A table needs an explicit policy.");
      for (const entry of policies) {
        assert.equal(entry.command, "SELECT", "This approved contract does not introduce client write policies.");
        assert.ok(entry.using !== null && entry.withCheck === null, "Read policy must retain its explicit USING expression.");
      }
      for (const role of ["PUBLIC", ...clients]) assert.ok((acl[role] ?? []).every(privilege => privilege === "SELECT"), "Client grants exceed the approved read boundary.");
    }
  }
  unique(tableRows.map(value => (value as SecurityTable).name), "Table classification");
  if (root.existingDatabaseAdoption !== null) {
    assert.equal(root.revision, 1, "Existing-database adoption belongs only to the initial security revision.");
    const adoption = object(root.existingDatabaseAdoption, "Existing-database adoption");
    keys(adoption, ["mode", "registry", "tableStructureSha256", "sequenceStructureSha256", "extensionTables", "extensionSequencePrivileges"], "Existing-database adoption");
    assert.equal(adoption.mode, "approved-existing-database");
    assert.match(adoption.tableStructureSha256 as string, HASH);
    assert.match(adoption.sequenceStructureSha256 as string, HASH);
    const registry = object(adoption.registry, "Existing-database registry");
    keys(registry, ["count", "head", "identitySha256", "requiredReceipts"], "Existing-database registry");
    assert.ok(Number.isSafeInteger(registry.count) && (registry.count as number) > 0);
    assert.match(registry.head as string, VERSION);
    assert.match(registry.identitySha256 as string, HASH);
    const receiptRows = array(registry.requiredReceipts, "Existing-database required receipts");
    assert.ok(receiptRows.length > 0, "Existing-database provenance receipts are required.");
    for (const value of receiptRows) {
      const receipt = object(value, "Existing-database receipt");
      keys(receipt, ["version", "name", "sourceSha256", "productionWholeFileReceipt", "supabaseCliV2116Receipt"], "Existing-database receipt");
      assert.match(receipt.version as string, VERSION); identifier(receipt.name, "Existing-database receipt name");
      assert.match(receipt.sourceSha256 as string, HASH);
      const wholeFile = object(receipt.productionWholeFileReceipt, "Production whole-file receipt");
      const modernCli = object(receipt.supabaseCliV2116Receipt, "Supabase CLI v2.116 receipt");
      for (const [label, representation] of [["Production whole-file receipt", wholeFile], ["Supabase CLI v2.116 receipt", modernCli]] as const) {
        keys(representation, ["statementCount", "statementsSha256"], label);
        assert.ok(Number.isSafeInteger(representation.statementCount) && (representation.statementCount as number) > 0);
        assert.match(representation.statementsSha256 as string, HASH);
      }
      assert.equal(wholeFile.statementCount, 1, "Production whole-file receipt must remain a single exact source statement.");
    }
    unique(receiptRows.map(value => (value as { version: string }).version), "Existing-database receipt versions");
    const extensionTables = array(adoption.extensionTables, "Existing-database extension tables");
    assert.ok(extensionTables.length > 0, "Existing-database table evolution is empty.");
    for (const value of extensionTables) {
      const table = object(value, "Existing-database extension table");
      keys(table, ["name", "classification", "owner", "forceRls", "grants", "policies", "exception"], "Existing-database extension table");
      identifier(table.name, "Existing-database extension table"); identifier(table.owner, "Existing-database extension owner");
      assert.equal(table.classification, "B", "Existing-database extensions must remain server-only.");
      assert.equal(table.forceRls, false); assert.equal(table.exception, null);
      assert.deepEqual(array(table.policies, "Existing-database extension policies"), []);
      const acl = grants(table.grants, TABLE_PRIVILEGES, `Existing-database extension ${table.name}`);
      for (const role of ["PUBLIC", ...clients]) assert.deepEqual(acl[role] ?? [], [], "Existing-database extension grants client access.");
    }
    unique(extensionTables.map(value => (value as SecurityTable).name), "Existing-database extension tables");
    assert.ok(extensionTables.every(value => !tableRows.some(base => (base as SecurityTable).name === (value as SecurityTable).name)),
      "Existing-database extension duplicates the historical table inventory.");
    const extensionSequences = array(adoption.extensionSequencePrivileges, "Existing-database extension sequences");
    assert.ok(extensionSequences.length > 0, "Existing-database sequence evolution is empty.");
    for (const value of extensionSequences) {
      const sequence = object(value, "Existing-database extension sequence");
      keys(sequence, ["name", "owner", "grants"], "Existing-database extension sequence");
      identifier(sequence.name, "Existing-database extension sequence"); identifier(sequence.owner, "Existing-database extension sequence owner");
      const acl = grants(sequence.grants, SEQUENCE_PRIVILEGES, "Existing-database extension sequence grants");
      for (const role of ["PUBLIC", ...clients]) assert.deepEqual(acl[role] ?? [], [], "Existing-database extension grants client sequence access.");
    }
    unique(extensionSequences.map(value => (value as SecuritySequence).name), "Existing-database extension sequences");
  }
  const roles = array(root.roles, "Roles");
  for (const value of roles) {
    const role = object(value, "Role");
    const conditional = role.classification === "conditional-platform-tooling";
    keys(role, conditional ? ["name", "classification", "presence", "managedBy", "attributeRules"]
      : ["name", "classification", "presence", "attributeRules"], "Role");
    identifier(role.name, "Role name");
    assert.ok(["application-public", "application-server", "platform-administration", "platform-managed", "postgres-built-in", "conditional-platform-tooling"].includes(role.classification as string), "Unknown role classification.");
    assert.ok(["required", "optional"].includes(role.presence as string), "Unknown role presence rule.");
    if (conditional) assert.equal(role.managedBy, "supabase-cli-login-role", "Conditional tooling provenance changed.");
    const attributeRules = object(role.attributeRules, "Role attribute rules");
    keys(attributeRules, ["superuser", "bypassRls", "inherit", "canLogin", "createRole", "createDb", "replication"], "Role attribute rules");
    for (const [field, rule] of Object.entries(attributeRules)) assert.ok(["deny", "require", "allow"].includes(rule as string), `Unsupported ${field} role rule.`);
  }
  unique(roles.map(value => (value as SecurityRole).name), "Role inventory");
  const knownRoles = new Set(roles.map(value => (value as SecurityRole).name));
  for (const client of clients) {
    const role = roles.find(value => (value as SecurityRole).name === client) as SecurityRole | undefined;
    assert.ok(role && role.classification === "application-public" && role.presence === "required", "Client role classification changed.");
    for (const field of ["superuser", "bypassRls", "createRole", "createDb", "replication"] as const)
      assert.equal(role.attributeRules[field], "deny", "Client role permits a privileged database attribute.");
  }
  for (const role of root.ddlRoles as string[]) assert.ok(knownRoles.has(role), "Unknown migration creator role.");
  for (const value of array(root.memberships, "Memberships")) {
    const membership = object(value, "Membership");
    const conditional = membership.classification === "conditional-platform-tooling";
    const classified = membership.classification !== undefined;
    keys(membership, classified ? ["role", "member", "inheritOption", "setOption", "adminOption", "presence", "classification"]
      : ["role", "member", "inheritOption", "setOption", "adminOption", "presence"], "Membership");
    for (const field of ["role", "member"]) assert.ok(knownRoles.has(membership[field] as string), "Membership references an unknown role.");
    for (const field of ["inheritOption", "setOption", "adminOption"]) bool(membership[field], `Membership ${field}`);
    assert.ok(["required", "optional"].includes(membership.presence as string), "Unknown membership presence rule.");
    if (classified) assert.ok(["platform-managed", "conditional-platform-tooling"].includes(membership.classification as string),
      "Unknown membership classification.");
    if (conditional) assert.deepEqual({ role: membership.role, member: membership.member, inheritOption: membership.inheritOption,
      setOption: membership.setOption, adminOption: membership.adminOption },
    { role: "postgres", member: "cli_login_postgres", inheritOption: false, setOption: true, adminOption: false },
    "Conditional CLI membership changed.");
    if (membership.classification === "platform-managed") {
      const member = roles.find(value => (value as SecurityRole).name === membership.member) as SecurityRole;
      const granted = roles.find(value => (value as SecurityRole).name === membership.role) as SecurityRole;
      assert.equal(membership.presence, "optional", "Platform-managed membership cannot become an application requirement.");
      assert.equal(member.classification, "platform-managed", "Platform-managed membership has an unclassified member.");
      assert.ok(["application-public", "application-server"].includes(granted.classification),
        "Platform-managed membership grants an unreviewed role class.");
      assert.equal(membership.inheritOption, false, "Platform-managed application membership cannot be inherited.");
      assert.equal(membership.setOption, true, "Platform-managed application membership must retain explicit SET ROLE semantics.");
      assert.equal(membership.adminOption, false, "Platform-managed application membership cannot administer its target role.");
    }
  }
  const memberships = root.memberships as SecurityMembership[];
  unique(memberships.map(row => `${row.role}/${row.member}`), "Membership identities");
  for (const client of clients) {
    const reachable = new Set([client]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const membership of memberships) {
        if (reachable.has(membership.member) && (membership.inheritOption || membership.setOption || membership.adminOption) && !reachable.has(membership.role)) {
          reachable.add(membership.role); changed = true;
        }
      }
    }
    const privileged = new Set([...(root.ddlRoles as string[]), ...tableRows.map(value => (value as SecurityTable).owner), "service_role",
      ...roles.filter(value => ["require", "allow"].includes((value as SecurityRole).attributeRules.superuser)
        || ["require", "allow"].includes((value as SecurityRole).attributeRules.bypassRls)).map(value => (value as SecurityRole).name)]);
    assert.ok([...reachable].every(role => !privileged.has(role)), "Client role can inherit or SET ROLE into a privileged owner.");
  }
  for (const value of tableRows) {
    const table = value as SecurityTable;
    assert.ok(knownRoles.has(table.owner), "Unknown table owner.");
    for (const role of [...Object.keys(table.grants), ...table.policies.flatMap(policy => policy.roles)]) assert.ok(role === "PUBLIC" || knownRoles.has(role), "Table contract references an unknown role.");
  }
  const schemaRows = array(root.schemaPrivileges, "Schema privileges");
  for (const value of schemaRows) {
    const row = object(value, "Schema privilege"); keys(row, ["role", "privileges"], "Schema privilege");
    identifier(row.role, "Schema grantee", true); privileges(row.privileges, ["USAGE", "CREATE"], "Schema privileges");
    if (["PUBLIC", ...clients].includes(row.role as string)) assert.ok(!(row.privileges as string[]).includes("CREATE"), "Client schema CREATE is forbidden.");
  }
  unique(schemaRows.map(value => (value as { role: string }).role), "Schema grantees");
  const accessRoles = [...new Set(["PUBLIC", ...clients, ...(root.ddlRoles as string[]), ...tableRows.flatMap(value => Object.keys((value as SecurityTable).grants))])];
  equal(schemaRows.map(value => (value as { role: string }).role), accessRoles, "Schema privileges must cover each declared application access role.");
  for (const value of array(root.defaultPrivileges, "Default privileges")) {
    const row = object(value, "Default privilege"); keys(row, ["owner", "schema", "objectType", "grants"], "Default privilege");
    assert.ok((root.ddlRoles as string[]).includes(row.owner as string), "Default privileges exceed approved creator roles.");
    assert.ok(row.schema === null || row.schema === root.schema, "Default privileges exceed the project schema.");
    assert.ok(["r", "S"].includes(row.objectType as string), "Default privilege contract is limited to application tables/sequences.");
    const acl = grants(row.grants, ALL_PRIVILEGES, "Default grants");
    for (const client of ["PUBLIC", ...clients]) assert.equal((acl[client] ?? []).length, 0, "Default privileges expose future objects to clients.");
  }
  for (const value of array(root.columnPrivileges, "Column privileges")) {
    const row = object(value, "Column privilege"); keys(row, ["table", "column", "role", "privileges", "grantable"], "Column privilege");
    identifier(row.table, "Column table"); identifier(row.column, "Column"); identifier(row.role, "Column grantee", true);
    const table = tableRows.find(value => (value as SecurityTable).name === row.table) as SecurityTable | undefined;
    assert.ok(table, "Column privileges refer to an unclassified table.");
    const granted = privileges(row.privileges, COLUMN_PRIVILEGES, "Column privileges");
    const grantable = privileges(row.grantable, COLUMN_PRIVILEGES, "Column grant options");
    if (["PUBLIC", ...clients].includes(row.role as string)) {
      assert.ok(granted.every(privilege => (table.grants[row.role as string] ?? []).includes(privilege)), "Column grant bypasses declared table access.");
      assert.equal(grantable.length, 0, "Clients cannot grant column permissions.");
    }
  }
  for (const value of array(root.sequencePrivileges, "Sequence privileges")) {
    const row = object(value, "Sequence privilege"); keys(row, ["name", "owner", "grants"], "Sequence privilege");
    identifier(row.name, "Sequence"); identifier(row.owner, "Sequence owner");
    const acl = grants(row.grants, SEQUENCE_PRIVILEGES, "Sequence grants");
    for (const client of ["PUBLIC", ...clients]) assert.equal((acl[client] ?? []).length, 0, "Read-only clients must not acquire sequence privileges.");
  }
  const functionSecurity = object(root.functionSecurity, "Function security");
  keys(functionSecurity, ["clientRoles", "allowClientExecute", "forbidClientSecurityDefinerExecute", "forbidClientGrantOptions", "defaultClientExecute"], "Function security");
  equal(names(functionSecurity.clientRoles, "Function client roles"), clients, "Function client-role boundary changed.");
  assert.deepEqual(array(functionSecurity.allowClientExecute, "Allowed client functions"), [], "Client function execution needs an explicit reviewed contract revision.");
  assert.equal(functionSecurity.forbidClientSecurityDefinerExecute, true);
  assert.equal(functionSecurity.forbidClientGrantOptions, true);
  assert.equal(functionSecurity.defaultClientExecute, false);
  return root as DatabaseSecurityContract;
}

/** Full source-owned revisions only. No implicit merge or latest-block-wins. */
export function loadDatabaseSecurityContract(migrations: SecurityMigrationSource[], options: { throughVersion?: string } = {}): LoadedDatabaseSecurityContract {
  if (options.throughVersion) assert.match(options.throughVersion, VERSION);
  const corpus = [...migrations].sort((a, b) => a.version.localeCompare(b.version));
  unique(corpus.map(migration => migration.version), "Migration versions");
  const ordered = corpus.filter(migration => !options.throughVersion || migration.version <= options.throughVersion);
  let loaded: LoadedDatabaseSecurityContract | null = null;
  for (const migration of ordered) {
    if (!migration.sql.includes(TAG)) continue;
    let name = migration.name;
    if (migration.file !== undefined) {
      const identity = /^(\d{14})_([a-z0-9_]+)\.sql$/u.exec(migration.file);
      assert.ok(identity, "Security migration filename is not canonical.");
      assert.equal(identity[1], migration.version, "Security migration filename/version mismatch.");
      if (name !== undefined) assert.equal(name, identity[2], "Security migration filename/name mismatch.");
      name = identity[2];
    }
    assert.ok(typeof name === "string", "Security migration must provide its name or exact canonical filename.");
    assertMigrationSourceProvenance({ ...migration, name });
    const pieces = migration.sql.split(TAG);
    assert.equal(pieces.length, 3, "Each migration must contain exactly one executable security contract literal.");
    assert.match(pieces[0], /\bv_contract\s+(?:constant\s+)?jsonb\s*:=\s*$/iu, "Security contract must be the migration's executable v_contract initializer.");
    assert.match(pieces[2], /^\s*::\s*jsonb\s*;/iu, "Security contract initializer has unsupported SQL syntax.");
    const contract = validateDatabaseSecurityContract(strictJson(pieces[1]));
    const migrationSourceSha256 = createHash("sha256").update(migration.sql, "utf8").digest("hex");
    for (const receipt of contract.existingDatabaseAdoption?.registry.requiredReceipts ?? []) {
      const creator = corpus.find(candidate => candidate.version === receipt.version);
      assert.ok(creator, `Existing-database creator migration is missing: ${receipt.version}.`);
      assert.equal(creator.name ?? creator.file?.replace(/^\d{14}_|\.sql$/gu, ""), receipt.name,
        "Existing-database creator migration name drift.");
      assert.equal(createHash("sha256").update(creator.sql, "utf8").digest("hex"), receipt.sourceSha256,
        "Existing-database creator migration source drift.");
      assert.equal(createHash("sha256").update(JSON.stringify([creator.sql]), "utf8").digest("hex"),
        receipt.productionWholeFileReceipt.statementsSha256,
        "Production whole-file receipt no longer represents the exact creator source.");
    }
    if (loaded === null) {
      assert.equal(contract.revision, 1, "The initial security revision must be 1.");
      assert.equal(contract.supersedes, null, "The initial security revision cannot supersede an absent source.");
    } else {
      assert.equal(contract.revision, loaded.contract.revision + 1, "Security revisions must be consecutive.");
      equal(contract.supersedes, { revision: loaded.contract.revision, migrationVersion: loaded.migrationVersion, migrationSourceSha256: loaded.migrationSourceSha256 }, "Security revision does not explicitly identify its prior migration source.");
    }
    loaded = freeze({ contract, contractSha256: contractDigest(contract), migrationVersion: migration.version, migrationSourceSha256 });
  }
  assert.ok(loaded, "No executable migration-owned database security contract exists for this checkpoint.");
  return loaded;
}

/** Single SELECT snapshot; no role switching, DDL, data reads or registry writes. */
export async function captureDatabaseSecurityCatalog(client: SecurityReadClient, loaded: LoadedDatabaseSecurityContract): Promise<DatabaseSecurityCatalog> {
  const { contract } = loaded;
  validateDatabaseSecurityContract(contract);
  assert.equal(contractDigest(contract), loaded.contractSha256, "Loaded security declaration was modified after source validation.");
  const result = await client.query(`
    with roles as (select oid,rolname from pg_catalog.pg_roles),
    relations as (select c.* from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname=$1 and c.relkind in ('r','p','S')),
    table_acl as (select c.oid,c.relowner,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,
      a.privilege_type,a.is_grantable from relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a),
    acl_group as (select oid,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable
      from table_acl group by oid,role),
    acl_maps as (select oid,jsonb_object_agg(role,privileges) as grants,jsonb_object_agg(role,grantable) as grant_options from acl_group group by oid),
    policy_rows as (select p.polrelid,jsonb_build_object('name',p.polname,'command',case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' end,
      'roles',(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end order by role_oid) from unnest(p.polroles) role_oid),
      'permissive',p.polpermissive,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'withCheck',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) as policy
      from pg_catalog.pg_policy p),
    column_acl as (select c.relname,a.attname,case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end as role,
      x.privilege_type,x.is_grantable from relations c join pg_catalog.pg_attribute a on a.attrelid=c.oid
      cross join lateral pg_catalog.aclexplode(a.attacl) x where a.attnum>0 and not a.attisdropped),
    column_group as (select relname,attname,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable from column_acl group by relname,attname,role),
    default_acl as (select d.oid,pg_catalog.pg_get_userbyid(d.defaclrole) as owner,n.nspname as schema,d.defaclobjtype::text as object_type,
      case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      cross join lateral pg_catalog.aclexplode(d.defaclacl) a
      where pg_catalog.pg_get_userbyid(d.defaclrole)=any($2::text[]) and d.defaclobjtype in ('r','S') and (d.defaclnamespace=0 or n.nspname=$1)),
    default_group as (select oid,owner,schema,object_type,role,jsonb_agg(privilege_type order by privilege_type) as privileges from default_acl group by oid,owner,schema,object_type,role),
    default_maps as (select oid,owner,schema,object_type,jsonb_object_agg(role,privileges) as grants from default_group group by oid,owner,schema,object_type),
    function_rows as (select p.oid,p.proowner,p.prosecdef,p.proacl,p.oid::regprocedure::text as identity
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind in ('f','p')),
    function_acl as (select f.oid,f.identity,f.prosecdef,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,
      a.privilege_type,a.is_grantable from function_rows f cross join lateral
      pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) a),
    default_function_acl as (select pg_catalog.pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'') schema,
      case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end role,a.privilege_type
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      cross join lateral pg_catalog.aclexplode(d.defaclacl) a where d.defaclobjtype='f'
      and pg_catalog.pg_get_userbyid(d.defaclrole)=any($2::text[]) and (d.defaclnamespace=0 or n.nspname=$1)),
    schema_acl as (select n.oid,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where n.nspname=$1)
    select jsonb_build_object('schema',$1::text,
      'tables',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
        'rlsEnabled',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'grants',coalesce(a.grants,'{}'::jsonb),'grantOptions',coalesce(a.grant_options,'{}'::jsonb),
        'policies',coalesce((select jsonb_agg(policy order by policy->>'name') from policy_rows where polrelid=c.oid),'[]'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($3::text[]) privilege where pg_catalog.has_table_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[])),
        'effectiveColumnPrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($4::text[]) privilege where pg_catalog.has_any_column_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[]))) order by c.relname)
        from relations c left join acl_maps a on a.oid=c.oid where c.relkind in ('r','p')),'[]'::jsonb),
      'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,'canLogin',rolcanlogin,
        'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication) order by rolname),'[]'::jsonb) from pg_catalog.pg_roles),
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',pg_catalog.pg_get_userbyid(roleid),'member',pg_catalog.pg_get_userbyid(member),'inheritOption',inherit_option,'setOption',set_option,'adminOption',admin_option) order by roleid,member),'[]'::jsonb) from pg_catalog.pg_auth_members),
      'schemaPrivileges',(select jsonb_agg(jsonb_build_object('role',role,'privileges',privileges) order by role) from (
        select r.rolname as role,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['CREATE','USAGE']) privilege where pg_catalog.has_schema_privilege(r.oid,$1,privilege)) as privileges from roles r where r.rolname=any($5::text[])
        union all select 'PUBLIC',coalesce((select jsonb_agg(privilege_type order by privilege_type) from schema_acl where role='PUBLIC'),'[]'::jsonb)) all_schema_roles),
      'defaultPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',owner,'schema',schema,'objectType',object_type,'grants',grants) order by owner,schema,object_type),'[]'::jsonb) from default_maps),
      'columnPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('table',relname,'column',attname,'role',role,'privileges',privileges,'grantable',grantable) order by relname,attname,role),'[]'::jsonb) from column_group),
      'sequencePrivileges',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'grants',coalesce(a.grants,'{}'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['SELECT','UPDATE','USAGE']) privilege where pg_catalog.has_sequence_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($6::text[]))) order by c.relname),'[]'::jsonb) from relations c left join acl_maps a on a.oid=c.oid where c.relkind='S')
      ,'functionSecurity',jsonb_build_object(
        'clientExecutable',(select coalesce(jsonb_agg(identity order by identity),'[]'::jsonb) from function_rows f
          where exists(select 1 from roles r where r.rolname=any($6::text[]) and pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE'))),
        'securityDefinerClientExecutable',(select coalesce(jsonb_agg(identity order by identity),'[]'::jsonb) from function_rows f where f.prosecdef
          and exists(select 1 from roles r where r.rolname=any($6::text[]) and pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE'))),
        'clientGrantOptions',(select coalesce(jsonb_agg(distinct identity order by identity),'[]'::jsonb) from function_acl
          where (role='PUBLIC' or role=any($6::text[])) and is_grantable),
        'defaultClientExecute',(select coalesce(jsonb_agg(distinct owner||'/'||schema||'/'||role order by owner||'/'||schema||'/'||role),'[]'::jsonb)
          from default_function_acl where privilege_type='EXECUTE' and (role='PUBLIC' or role=any($6::text[])))
      ),
      'toolingRoles',(select coalesce(jsonb_agg(jsonb_build_object('name',a.rolname,'passwordConfigured',a.rolpassword is not null,
        'validUntil',a.rolvaliduntil::text,'activeSessions',(select count(*) from pg_catalog.pg_stat_activity s where s.usename=a.rolname),
        'ownsApplicationObjects',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relowner=a.oid)
          +(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.proowner=a.oid),
        'directApplicationAclEntries',(select count(*) from relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x where x.grantee=a.oid)
          +(select count(*) from function_rows f cross join lateral pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) x where x.grantee=a.oid)
      ) order by a.rolname),'[]'::jsonb) from pg_catalog.pg_authid a where a.rolname=any($7::text[]))
    ) as document
  `, [contract.schema, contract.ddlRoles, TABLE_PRIVILEGES, COLUMN_PRIVILEGES, [...new Set([...contract.clientRoles, ...contract.ddlRoles, ...contract.tables.flatMap(table => Object.keys(table.grants).filter(role => role !== "PUBLIC"))])], contract.clientRoles,
    contract.roles.filter(role => role.classification === "conditional-platform-tooling").map(role => role.name)]);
  assert.equal(result.rows.length, 1, "Security catalog snapshot is unavailable.");
  return object(object(result.rows[0], "Security catalog row").document, "Security catalog") as DatabaseSecurityCatalog;
}

/** Compare catalog to the same SQL-owned declaration, plus generic safety rules. */
export function assertDatabaseSecurityCatalog(loaded: LoadedDatabaseSecurityContract, snapshot: DatabaseSecurityCatalog) {
  const contract = validateDatabaseSecurityContract(loaded.contract);
  assert.equal(contractDigest(contract), loaded.contractSha256, "Loaded security declaration was modified after source validation.");
  keys(object(snapshot, "Security catalog"), ["schema", "tables", "roles", "memberships", "schemaPrivileges", "defaultPrivileges", "columnPrivileges", "sequencePrivileges", "functionSecurity", "toolingRoles"], "Security catalog");
  assert.equal(snapshot.schema, contract.schema);
  unique(snapshot.tables.map(table => table.name), "Catalog table identities");
  equal(snapshot.tables.map(table => table.name), contract.tables.map(table => table.name), "Unclassified, missing or unexpected public application table.");
  for (const expected of contract.tables) {
    const actual = snapshot.tables.find(table => table.name === expected.name)!;
    assert.equal(actual.owner, expected.owner, `Table owner drift: ${expected.name}`);
    assert.equal(actual.rlsEnabled, expected.classification !== "C", `RLS classification drift: ${expected.name}`);
    assert.equal(actual.forceRls, expected.forceRls, `FORCE RLS drift: ${expected.name}`);
    equal(nonemptyGrants(actual.grants), nonemptyGrants(expected.grants), `Table grants drift: ${expected.name}`);
    equal(actual.policies, expected.policies, `Policy roles/commands/predicates drift: ${expected.name}`);
    for (const [grantee, options] of Object.entries(actual.grantOptions)) if (grantee !== expected.owner) assert.equal(options.length, 0, `Unexpected grant option: ${expected.name}/${grantee}`);
    for (const role of contract.clientRoles) {
      const allowed = [...new Set([...(expected.grants[role] ?? []), ...(expected.grants.PUBLIC ?? [])])];
      equal(actual.effectivePrivileges[role], allowed, `Effective client grants drift: ${expected.name}/${role}`);
      equal(actual.effectiveColumnPrivileges[role], allowed.filter(privilege => COLUMN_PRIVILEGES.includes(privilege)), `Effective client column access drift: ${expected.name}/${role}`);
    }
  }
  const roleProof = assertRoleSecurity(contract, snapshot);
  for (const field of ["schemaPrivileges", "defaultPrivileges", "columnPrivileges"] as const) equal(snapshot[field], contract[field], `${field} differs from the reviewed migration security contract.`);
  equal(snapshot.functionSecurity.clientExecutable, contract.functionSecurity.allowClientExecute, "Client function EXECUTE differs from the reviewed security contract.");
  if (contract.functionSecurity.forbidClientSecurityDefinerExecute) equal(snapshot.functionSecurity.securityDefinerClientExecutable, [], "Client role can execute a SECURITY DEFINER function.");
  if (contract.functionSecurity.forbidClientGrantOptions) equal(snapshot.functionSecurity.clientGrantOptions, [], "Client role has a function EXECUTE grant option.");
  if (!contract.functionSecurity.defaultClientExecute) equal(snapshot.functionSecurity.defaultClientExecute, [], "Default privileges expose future functions to client roles.");
  equal(snapshot.sequencePrivileges.map(sequence => ({ name: sequence.name, owner: sequence.owner, grants: sequence.grants })), contract.sequencePrivileges, "Sequence privileges differ from the reviewed migration security contract.");
  for (const sequence of snapshot.sequencePrivileges) for (const role of contract.clientRoles) equal(sequence.effectivePrivileges[role], [], `Effective client sequence grants remain: ${sequence.name}/${role}`);
  return { revision: contract.revision, migrationVersion: loaded.migrationVersion, migrationSourceSha256: loaded.migrationSourceSha256,
    tables: snapshot.tables.length, classifications: { A: contract.tables.filter(table => table.classification === "A").length,
      B: contract.tables.filter(table => table.classification === "B").length, C: contract.tables.filter(table => table.classification === "C").length },
    policies: snapshot.tables.reduce((count, table) => count + table.policies.length, 0),
    actualRoles: snapshot.roles.length, actualMemberships: snapshot.memberships.length, roleProof,
    functionExecuteVerified: true,
    clientEffectivePrivilegesVerified: true, catalogVerificationReadOnly: true };
}
