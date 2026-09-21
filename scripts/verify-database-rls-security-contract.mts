import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDatabaseSecurityCatalog, captureDatabaseSecurityCatalog, loadDatabaseSecurityContract,
  validateDatabaseSecurityContract,
  type DatabaseSecurityCatalog, type DatabaseSecurityContract, type LoadedDatabaseSecurityContract,
} from "./lib/database-rls-security-contract.mts";

const tablePrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];
const clone = <T,>(value: T): T => structuredClone(value);

function fixture(): DatabaseSecurityContract {
  const exact = (value: boolean) => value ? "require" as const : "deny" as const;
  const roles: DatabaseSecurityContract["roles"] = ["anon", "authenticated", "postgres", "service_role"].map(name => {
    const values = { superuser: false, bypassRls: ["postgres", "service_role"].includes(name), inherit: true, canLogin: name === "postgres",
      createRole: name === "postgres", createDb: name === "postgres", replication: name === "postgres" };
    return { name, classification: name === "postgres" ? "platform-administration" : name === "service_role" ? "application-server" : "application-public",
      presence: "required", attributeRules: Object.fromEntries(Object.entries(values).map(([field, value]) => [field, exact(value)])) as DatabaseSecurityContract["roles"][number]["attributeRules"] };
  });
  return { formatVersion: 2, contractId: "venisia-public-table-security", revision: 1, supersedes: null,
    schema: "public", clientRoles: ["anon", "authenticated"], ddlRoles: ["postgres"],
    tables: [
      { name: "public_records", classification: "A", owner: "postgres", forceRls: false,
        grants: { postgres: tablePrivileges, service_role: ["SELECT"], anon: ["SELECT"], authenticated: ["SELECT"], PUBLIC: [] },
        policies: [{ name: "Public can read active records", command: "SELECT", roles: ["PUBLIC"], permissive: true, using: "(is_active = true)", withCheck: null }], exception: null },
      { name: "private_records", classification: "B", owner: "postgres", forceRls: false,
        grants: { postgres: tablePrivileges, service_role: ["SELECT"], anon: [], authenticated: [], PUBLIC: [] }, policies: [], exception: null },
    ], roles, memberships: [],
    schemaPrivileges: [{ role: "PUBLIC", privileges: ["USAGE"] }, ...roles.map(role => ({ role: role.name, privileges: role.name === "postgres" ? ["USAGE", "CREATE"] : ["USAGE"] }))],
    defaultPrivileges: [{ owner: "postgres", schema: "public", objectType: "r", grants: { postgres: tablePrivileges, service_role: ["SELECT"] } }],
    columnPrivileges: [],
    sequencePrivileges: [{ name: "private_records_id_seq", owner: "postgres", grants: { postgres: ["USAGE", "SELECT", "UPDATE"], service_role: ["USAGE", "SELECT", "UPDATE"] } }],
    functionSecurity: { clientRoles: ["anon", "authenticated"], allowClientExecute: [], forbidClientSecurityDefinerExecute: true,
      forbidClientGrantOptions: true, defaultClientExecute: false },
  };
}
function source(contract: DatabaseSecurityContract, version = "19990101000000") {
  return { version, name: "security_test", file: `${version}_security_test.sql`, sql:
    `begin;\ndo $migration$\ndeclare\n v_contract jsonb := $venisia_security_contract$${JSON.stringify(contract)}$venisia_security_contract$::jsonb;\nbegin\n perform v_contract;\nend\n$migration$;\ncommit;\n` };
}
function catalog(loaded: LoadedDatabaseSecurityContract): DatabaseSecurityCatalog {
  const contract = clone(loaded.contract);
  const roles = contract.roles.filter(role => role.presence === "required").map(role => ({ name: role.name,
    ...Object.fromEntries(Object.entries(role.attributeRules).map(([field, rule]) => [field, rule === "require"])) })) as DatabaseSecurityCatalog["roles"];
  return { schema: contract.schema, roles, memberships: contract.memberships.filter(row => row.presence === "required")
      .map(({ presence: _presence, classification: _classification, ...row }) => row),
    schemaPrivileges: contract.schemaPrivileges, defaultPrivileges: contract.defaultPrivileges, columnPrivileges: contract.columnPrivileges,
    tables: contract.tables.map(table => ({ name: table.name, owner: table.owner, rlsEnabled: table.classification !== "C", forceRls: table.forceRls,
      grants: table.grants, policies: table.policies, grantOptions: {},
      effectivePrivileges: Object.fromEntries(contract.clientRoles.map(role => [role, [...new Set([...(table.grants[role] ?? []), ...(table.grants.PUBLIC ?? [])])]])),
      effectiveColumnPrivileges: Object.fromEntries(contract.clientRoles.map(role => [role, [...new Set([...(table.grants[role] ?? []), ...(table.grants.PUBLIC ?? [])])]])),
    })),
    sequencePrivileges: contract.sequencePrivileges.map(sequence => ({ ...sequence, effectivePrivileges: { anon: [], authenticated: [] } })),
    functionSecurity: { clientExecutable: [], securityDefinerClientExecutable: [], clientGrantOptions: [], defaultClientExecute: [] },
    toolingRoles: [],
  };
}

export async function verifyDatabaseRlsSecurityContract() {
  let checks = 0;
  const check = (callback: () => void) => { callback(); checks++; };
  const rejects = (callback: () => unknown) => check(() => assert.throws(callback));
  const initial = source(fixture());
  const loaded = loadDatabaseSecurityContract([initial]);
  check(() => assert.equal(assertDatabaseSecurityCatalog(loaded, catalog(loaded)).tables, 2));
  check(() => assert.equal(loaded.contract.tables[0].policies[0].name, "Public can read active records"));
  check(() => assert.equal(Object.isFrozen(loaded.contract.tables[0]), true));
  check(() => assert.equal(loadDatabaseSecurityContract([{ file: initial.file, version: initial.version, sql: initial.sql }]).migrationSourceSha256, loaded.migrationSourceSha256));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, file: "19990102000000_security_test.sql" }]));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, name: "another_name" }]));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, sha256: "0".repeat(64) }]));
  rejects(() => loadDatabaseSecurityContract([]));
  rejects(() => loadDatabaseSecurityContract([initial], { throughVersion: "19980101000000" }));
  rejects(() => loadDatabaseSecurityContract([initial, initial]));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, sql: initial.sql.replace('"formatVersion":2', '"formatVersion":2,"formatVersion":2') }]));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, sql: `${initial.sql}\n${initial.sql}` }]));
  rejects(() => loadDatabaseSecurityContract([{ ...initial, sql: initial.sql.replace("v_contract jsonb :=", "v_unowned jsonb :=") }]));
  rejects(() => validateDatabaseSecurityContract({ ...fixture(), captureStatus: "pending-isolated-catalog-review" }));
  rejects(() => validateDatabaseSecurityContract({ ...fixture(), roles: [] }));
  rejects(() => validateDatabaseSecurityContract({ ...fixture(), schemaPrivileges: [] }));
  const badContract = (mutate: (contract: DatabaseSecurityContract) => void) => rejects(() => { const value = fixture(); mutate(value); validateDatabaseSecurityContract(value); });
  badContract(value => { value.tables[1].classification = "A"; });
  badContract(value => { value.tables[1].classification = "C"; });
  badContract(value => { value.tables[1].grants.anon = ["SELECT"]; });
  badContract(value => { value.tables[0].grants.anon = ["TRUNCATE"]; });
  badContract(value => { value.tables[0].policies[0].command = "UPDATE"; });
  badContract(value => { value.tables[0].policies[0].using = null; });
  badContract(value => { value.tables[0].policies[0].roles = ["unknown_role"]; });
  badContract(value => { value.roles[0].attributeRules.bypassRls = "allow"; });
  badContract(value => { value.roles[0].attributeRules.createRole = "require"; });
  badContract(value => { value.roles[0].attributeRules.replication = "allow"; });
  badContract(value => { value.memberships = [{ role: "postgres", member: "anon", inheritOption: false, setOption: true, adminOption: false, presence: "optional" }]; });
  badContract(value => { value.memberships = [{ role: "postgres", member: "anon", inheritOption: false, setOption: false, adminOption: true, presence: "optional" }]; });
  badContract(value => { value.schemaPrivileges.find(row => row.role === "anon")!.privileges.push("CREATE"); });
  badContract(value => { value.defaultPrivileges[0].grants.PUBLIC = ["SELECT"]; });
  badContract(value => { value.sequencePrivileges[0].grants.authenticated = ["USAGE"]; });
  badContract(value => { value.columnPrivileges.push({ table: "private_records", column: "secret", role: "anon", privileges: ["SELECT"], grantable: [] }); });

  const badCatalog = (mutate: (snapshot: DatabaseSecurityCatalog) => void) => rejects(() => { const value = catalog(loaded); mutate(value); assertDatabaseSecurityCatalog(loaded, value); });
  badCatalog(value => { value.tables.push({ ...clone(value.tables[1]), name: "future_unclassified" }); });
  badCatalog(value => { value.tables.pop(); });
  badCatalog(value => { value.tables[1].rlsEnabled = false; });
  badCatalog(value => { value.tables[1].forceRls = true; });
  badCatalog(value => { value.tables[1].owner = "service_role"; });
  badCatalog(value => { value.tables[1].grants.anon = ["TRUNCATE"]; });
  badCatalog(value => { value.tables[0].policies[0].using = "true"; });
  badCatalog(value => { value.tables[0].policies[0].roles = ["anon"]; });
  badCatalog(value => { value.tables[0].policies[0].permissive = false; });
  badCatalog(value => { value.tables[0].policies[0].withCheck = "true"; });
  badCatalog(value => { value.tables[0].grantOptions.anon = ["SELECT"]; });
  badCatalog(value => { value.tables[1].effectivePrivileges.anon = ["SELECT"]; });
  badCatalog(value => { value.tables[1].effectiveColumnPrivileges.anon = ["REFERENCES"]; });
  badCatalog(value => { value.roles[0].superuser = true; });
  badCatalog(value => { value.memberships.push({ role: "service_role", member: "authenticated", inheritOption: false, setOption: true, adminOption: false }); });
  badCatalog(value => { value.schemaPrivileges.find(row => row.role === "anon")!.privileges = ["USAGE", "CREATE"]; });
  badCatalog(value => { value.defaultPrivileges[0].grants.anon = ["SELECT"]; });
  badCatalog(value => { value.sequencePrivileges[0].effectivePrivileges.authenticated = ["USAGE"]; });
  badCatalog(value => { value.functionSecurity.clientExecutable = ["unsafe_public_function()"]; });
  badCatalog(value => { value.functionSecurity.securityDefinerClientExecutable = ["unsafe_definer()"]; });
  badCatalog(value => { value.functionSecurity.clientGrantOptions = ["grantable_public_function()"]; });
  badCatalog(value => { value.functionSecurity.defaultClientExecute = ["postgres/public/PUBLIC"]; });
  rejects(() => { const tampered = clone(loaded); tampered.contract.tables[0].policies[0].using = "true"; assertDatabaseSecurityCatalog(tampered, catalog(tampered)); });

  const platformAware = fixture();
  const denied = { superuser: "deny", bypassRls: "deny", inherit: "deny", canLogin: "deny",
    createRole: "deny", createDb: "deny", replication: "deny" } as const;
  platformAware.roles.push({ name: "supabase_realtime_admin", classification: "platform-managed", presence: "optional", attributeRules: denied });
  platformAware.roles.push({ name: "cli_login_postgres", classification: "conditional-platform-tooling", presence: "optional",
    managedBy: "supabase-cli-login-role", attributeRules: { ...denied, canLogin: "require" } });
  platformAware.memberships.push({ role: "postgres", member: "cli_login_postgres", inheritOption: false,
    setOption: true, adminOption: false, presence: "optional", classification: "conditional-platform-tooling" });
  platformAware.memberships.push({ role: "anon", member: "supabase_realtime_admin", inheritOption: false,
    setOption: true, adminOption: false, presence: "optional", classification: "platform-managed" });
  const platformLoaded = loadDatabaseSecurityContract([source(platformAware)]);
  const safePlatform = catalog(platformLoaded);
  safePlatform.roles.push({ name: "supabase_realtime_admin", superuser: false, bypassRls: false, inherit: false,
    canLogin: false, createRole: false, createDb: false, replication: false });
  safePlatform.memberships.push({ role: "anon", member: "supabase_realtime_admin", inheritOption: false, setOption: true, adminOption: false });
  check(() => assert.equal(assertDatabaseSecurityCatalog(platformLoaded, safePlatform).roleProof.optionalRolesAbsent.includes("cli_login_postgres"), true));
  const safeTooling = clone(safePlatform);
  safeTooling.roles.push({ name: "cli_login_postgres", superuser: false, bypassRls: false, inherit: false,
    canLogin: true, createRole: false, createDb: false, replication: false });
  safeTooling.memberships.push({ role: "postgres", member: "cli_login_postgres", inheritOption: false, setOption: true, adminOption: false });
  safeTooling.toolingRoles.push({ name: "cli_login_postgres", passwordConfigured: true, validUntil: "2099-01-01 00:00:00+00",
    activeSessions: 0, ownsApplicationObjects: 0, directApplicationAclEntries: 0 });
  check(() => assert.deepEqual(assertDatabaseSecurityCatalog(platformLoaded, safeTooling).roleProof.conditionalToolingRoles, ["cli_login_postgres"]));
  rejects(() => { const value = clone(safePlatform); value.roles.push({ name: "unknown_platform_role", superuser: false, bypassRls: false,
    inherit: false, canLogin: false, createRole: false, createDb: false, replication: false }); assertDatabaseSecurityCatalog(platformLoaded, value); });
  rejects(() => { const value = clone(safeTooling); value.toolingRoles[0].activeSessions = 1; assertDatabaseSecurityCatalog(platformLoaded, value); });
  rejects(() => { const value = clone(safeTooling); value.toolingRoles[0].directApplicationAclEntries = 1; assertDatabaseSecurityCatalog(platformLoaded, value); });
  rejects(() => { const value = clone(safeTooling); value.memberships[0].adminOption = true; assertDatabaseSecurityCatalog(platformLoaded, value); });

  const revised = fixture();
  revised.revision = 2;
  revised.supersedes = { revision: 1, migrationVersion: initial.version, migrationSourceSha256: loaded.migrationSourceSha256 };
  revised.tables.push({ ...clone(revised.tables[1]), name: "future_classified" });
  const second = source(revised, "19990102000000");
  const amended = loadDatabaseSecurityContract([initial, second]);
  check(() => assert.equal(assertDatabaseSecurityCatalog(amended, catalog(amended)).tables, 3));
  check(() => assert.equal(loadDatabaseSecurityContract([initial, second], { throughVersion: initial.version }).contract.revision, 1));
  rejects(() => loadDatabaseSecurityContract([second]));
  rejects(() => loadDatabaseSecurityContract([initial, source({ ...revised, supersedes: null }, second.version)]));
  rejects(() => loadDatabaseSecurityContract([initial, source({ ...revised, supersedes: { ...revised.supersedes!, migrationSourceSha256: "0".repeat(64) } }, second.version)]));
  rejects(() => loadDatabaseSecurityContract([initial, source({ ...revised, revision: 3 }, second.version)]));

  let reads = 0;
  const captured = await captureDatabaseSecurityCatalog({ query: async (sql, parameters) => {
    check(() => assert.match(sql, /^\s*with roles as/u));
    check(() => assert.equal(parameters?.[0], "public"));
    check(() => assert.deepEqual(parameters?.[1], ["postgres"]));
    reads++;
    return { rows: [{ document: catalog(loaded) }] };
  } }, loaded);
  check(() => assert.equal(reads, 1));
  check(() => assert.equal(assertDatabaseSecurityCatalog(loaded, captured).classifications.B, 1));
  return { checks, sourceParser: "PASS", catalogNegativeControls: "PASS", futureClassification: "PASS",
    explicitRevisionChain: "PASS", transportShape: "MOCK_ONLY", databaseAccess: false, productionAccess: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyDatabaseRlsSecurityContract(), null, 2));
}
