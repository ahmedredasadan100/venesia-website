import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createJiti } from "jiti";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { parseMaintenanceModeValue } from "../src/lib/maintenance/parse-maintenance-value.ts";
import { INTEGRATION_APP_CONFIGURATION_DEFINITIONS as providers } from "../src/lib/admin/integrations/server-configuration-contract.ts";

const root = resolve(import.meta.dirname, "..");
const SECURITY_USERNAME = "qa_core_security_settings";
const initialName = "QA Core Security", editedName = "QA Core Security Edited";
const secret = (password: string, label: string) => createHmac("sha256", password).update("qa-specialized-settings/v1:" + label).digest("base64url");
const sequence = ["baseline", "incomplete", "incomplete-tested", "saved", "stale-rejected", "blank-preserved", "replaced", "remove-cancelled", "removed"] as const;
type ProviderState = { phase: number; auditStart: number; secretIds: string[]; lastSecretIds: string[]; groupId?: string };
type State = { password: string; securityId: number; mainId: number; mainBefore?: unknown; securityAuditStart?: number; securityPhase: number;
  maintenanceAuditStart?: number; maintenanceStarted: boolean; maintenancePhase: number; maintenanceRestored?: boolean; providers: Map<string, ProviderState> };
const stateByHandle = new WeakMap<OwnedLocalHandle, State>();
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
const passwordOwner = () => jiti.import<typeof import("../src/lib/admin/auth/password.ts")>(resolve(root, "src/lib/admin/auth/password.ts"));
const auditStart = async (handle: OwnedLocalHandle) => Number((await handle.query("select coalesce(max(id),0)::bigint id from public.admin_audit_logs")).rows[0].id);

/** Called only by the existing opted-in owned fixture lifecycle. Never returns a credential. */
export async function prepareCoreSpecializedSettingsFixtures(handle: OwnedLocalHandle, credentials: { username: string; password: string }) {
  assertOwnedLocalHandle(handle); assert.equal(stateByHandle.has(handle), false);
  const main = (await handle.query("select id from public.admin_users where username=$1 and is_active", [credentials.username])).rows;
  assert.equal(main.length, 1);
  assert.equal((await handle.query("select id from public.admin_users where username=$1", [SECURITY_USERNAME])).rows.length, 0, "Never replace an existing security actor.");
  // A fresh isolated configuration scope is required; tests never overwrite another owner's secrets or connections.
  assert.equal(Number((await handle.query("select count(*) count from public.integration_app_configuration_groups")).rows[0].count), 0);
  assert.equal(Number((await handle.query("select count(*) count from public.integration_connections")).rows[0].count), 0);
  const { hashPassword } = await passwordOwner();
  const hash = await hashPassword(secret(credentials.password, "security:initial"));
  const securityId = Number((await handle.query("insert into public.admin_users(email,username,password_hash,full_name,role,is_active,session_version) values('qa-core-security@example.invalid',$1,$2,$3,'admin',true,1) returning id", [SECURITY_USERNAME, hash, initialName])).rows[0].id);
  stateByHandle.set(handle, { password: credentials.password, securityId, mainId: Number(main[0].id), securityPhase: 0, maintenanceStarted: false, maintenancePhase: 0, providers: new Map() });
  return { securityActor: { id: securityId, username: SECURITY_USERNAME }, providers: providers.map(row => row.key), mainActorUntouched: true };
}

export function validateCoreSpecializedSettingsRequest(value: unknown) {
  assert.ok(value && typeof value === "object"); const request = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(request).sort(), (request.entity === "integration" ? ["id", "kind", "entity", "phase", "provider"] : ["id", "kind", "entity", "phase"]).sort());
  assert.equal(request.kind, "specialized-settings-state"); assert.match(String(request.id), /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);
  assert.ok(["security", "integration", "maintenance"].includes(String(request.entity)));
  const phases = request.entity === "integration" ? [...sequence, "cleanup"] : request.entity === "security"
    ? ["baseline", "rejected", "account-saved", "account-restored", "password-changed", "password-restored", "sessions-cancelled", "sessions-revoked"]
    : ["baseline", "cancelled", "enabled", "restored"];
  assert.ok(phases.includes(String(request.phase)));
  if (request.entity === "integration") assert.ok(providers.some(row => row.key === request.provider));
  return request as { id: string; kind: string; entity: string; phase: string; provider?: string };
}

/** Fixed server checkpoints return booleans/counts only; Browser cannot supply SQL, IDs or secret values. */
export async function readCoreSpecializedSettingsCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle); const request = validateCoreSpecializedSettingsRequest(input), state = stateByHandle.get(handle);
  assert.ok(state, "Specialized settings must be explicitly prepared by this owned lifecycle.");
  const receipt = { id: request.id, kind: request.kind, entity: request.entity, phase: request.phase, ...(request.provider ? { provider: request.provider } : {}), status: "pass" };
  if (request.entity === "security") {
    const steps = ["baseline", "rejected", "account-saved", "account-restored", "password-changed", "password-restored", "sessions-cancelled", "sessions-revoked"];
    assert.equal(request.phase, steps[state.securityPhase]);
    const main = (await handle.query("select username,email,full_name,password_hash,role,is_active,session_version from public.admin_users where id=$1", [state.mainId])).rows[0];
    if (request.phase === "baseline") { state.mainBefore = main; state.securityAuditStart = await auditStart(handle); }
    assert.equal(isDeepStrictEqual(main, state.mainBefore), true, "Security journeys must not alter the primary QA account; values remain private.");
    const actor = (await handle.query("select password_hash,full_name,email,role,is_active,session_version from public.admin_users where id=$1", [state.securityId])).rows[0];
    assert.equal(actor.role, "admin"); assert.equal(actor.is_active, true); assert.equal(actor.email, "qa-core-security@example.invalid");
    const changed = request.phase === "password-changed";
    const { verifyPassword } = await passwordOwner();
    assert.equal(await verifyPassword(secret(state.password, changed ? "security:changed" : "security:initial"), String(actor.password_hash)), true, "Only the expected disposable credential may verify.");
    if (changed) assert.equal(await verifyPassword(secret(state.password, "security:initial"), String(actor.password_hash)), false);
    const version = request.phase === "sessions-revoked" ? 4 : ["password-restored", "sessions-cancelled"].includes(request.phase) ? 3 : changed ? 2 : 1;
    assert.equal(Number(actor.session_version), version);
    assert.equal(actor.full_name, request.phase === "account-saved" ? editedName : initialName);
    const audit = (await handle.query("select action,count(*)::integer count from public.admin_audit_logs where actor_admin_user_id=$1 and entity_id=$1 and id>$2 and action=any($3::text[]) group by action", [state.securityId, state.securityAuditStart, ["auth.password.changed", "auth.sessions.revoked", "admin_user.updated"]])).rows;
    const count = (action: string) => Number(audit.find(row => row.action === action)?.count ?? 0);
    const passwordChanges = ["password-restored", "sessions-cancelled", "sessions-revoked"].includes(request.phase) ? 2 : changed ? 1 : 0;
    assert.equal(count("auth.password.changed"), passwordChanges); assert.equal(count("auth.sessions.revoked"), request.phase === "sessions-revoked" ? 1 : 0);
    assert.equal(count("admin_user.updated"), state.securityPhase >= 3 ? 2 : request.phase === "account-saved" ? 1 : 0);
    state.securityPhase++;
    return { ...receipt, mainActorUnchanged: true, credentialVerifiedWithoutExport: true, sessionVersion: version, actorBoundPasswordAuditCount: passwordChanges, actorBoundSessionAuditCount: count("auth.sessions.revoked") };
  }
  if (request.entity === "maintenance") {
    const row = (await handle.query("select value from public.site_settings where key='maintenance_mode'")).rows[0];
    const enabled = parseMaintenanceModeValue(row?.value);
    assert.equal(request.phase, ["baseline", "cancelled", "enabled", "restored"][state.maintenancePhase]);
    if (request.phase === "baseline") { assert.equal(enabled, false); state.maintenanceAuditStart = await auditStart(handle); state.maintenanceStarted = true; }
    assert.equal(state.maintenanceStarted, true);
    assert.equal(enabled, request.phase === "enabled");
    const count = Number((await handle.query("select count(*)::integer count from public.admin_audit_logs where actor_admin_user_id=$1 and entity_type='site_settings' and entity_label='maintenance_mode' and action='site_settings.update' and id>$2", [state.mainId, state.maintenanceAuditStart])).rows[0].count);
    if (request.phase === "baseline" || request.phase === "cancelled") assert.equal(count, 0);
    if (request.phase === "enabled") assert.equal(count, 1);
    if (request.phase === "restored") { assert.equal(count, 2); state.maintenanceRestored = true; }
    state.maintenancePhase++;
    return { ...receipt, enabled, actorBoundAuditCount: count, publicPolicyRestored: request.phase === "restored" };
  }
  const definition = providers.find(row => row.key === request.provider)!;
  let provider = state.providers.get(definition.key);
  if (!provider) { assert.equal(request.phase, "baseline"); provider = { phase: 0, auditStart: await auditStart(handle), secretIds: [], lastSecretIds: [] }; state.providers.set(definition.key, provider); }
  if (request.phase !== "cleanup") assert.equal(request.phase, sequence[provider.phase]);
  const groups = (await handle.query("select id,version from public.integration_app_configuration_groups where provider_key=$1", [definition.key])).rows;
  const absent = ["baseline", "removed", "cleanup"].includes(request.phase);
  assert.equal(groups.length, absent ? 0 : 1);
  if (absent) {
    for (const id of provider.secretIds) assert.equal(Number((await handle.query("select count(*)::integer count from vault.secrets where id=$1::uuid", [id])).rows[0].count), 0, "Owned removed secrets must not survive.");
    if (provider.groupId) assert.equal(Number((await handle.query("select count(*)::integer count from public.integration_app_configuration_entries where group_id=$1::uuid", [provider.groupId])).rows[0].count), 0);
    const removedAudits = Number((await handle.query("select count(*)::integer count from public.admin_audit_logs where actor_admin_user_id=$1 and entity_type='integration_app_configuration' and metadata->>'provider'=$2 and action='integration.app_configuration.removed' and id>$3", [state.mainId, definition.key, provider.auditStart])).rows[0].count);
    if (request.phase !== "cleanup") { assert.equal(removedAudits, request.phase === "removed" ? 1 : 0); provider.phase++; }
    return { ...receipt, groupAbsent: true, ownedSecretsAbsent: true, actorBoundRemovalCount: removedAudits };
  }
  const version = ["incomplete", "incomplete-tested"].includes(request.phase) ? 1 : ["saved", "stale-rejected"].includes(request.phase) ? 2 : request.phase === "blank-preserved" ? 3 : 4;
  assert.equal(Number(groups[0].version), version);
  if (provider.groupId) assert.equal(String(groups[0].id), provider.groupId);
  provider.groupId = String(groups[0].id);
  const entries = (await handle.query("select configuration_key,is_secret,vault_secret_id,safe_value from public.integration_app_configuration_entries where group_id=$1::uuid order by configuration_key", [groups[0].id])).rows;
  const complete = version >= 2;
  assert.equal(entries.length, complete ? definition.fields.length : 1);
  const ids: string[] = [];
  for (const field of definition.fields) {
    const entry = entries.find(row => row.configuration_key === field.key);
    if (!complete && field.secret) { assert.equal(entry, undefined); continue; }
    assert.ok(entry); assert.equal(entry.is_secret, field.secret);
    if (field.secret) {
      assert.equal(entry.safe_value === null, true, "Secret entries cannot contain an exported safe value."); assert.ok(entry.vault_secret_id);
      const id = String(entry.vault_secret_id); ids.push(id); if (!provider.secretIds.includes(id)) provider.secretIds.push(id);
      const expected = secret(state.password, `integration:${definition.key}:${field.key}:${version >= 4 ? "b" : "a"}`);
      assert.equal((await handle.query("select exists(select 1 from vault.decrypted_secrets where id=$1::uuid and decrypted_secret=$2) matches", [id, expected])).rows[0].matches, true, "Vault must contain only the fixed synthetic value; never export it.");
    } else assert.equal(entry.safe_value, `qa-${definition.key}-application`);
  }
  if (request.phase === "blank-preserved" || request.phase === "stale-rejected") assert.equal(isDeepStrictEqual(ids, provider.lastSecretIds), true, "Unchanged secrets retain the same private Vault identity.");
  if (request.phase === "replaced") {
    assert.ok(ids.every(id => !provider.lastSecretIds.includes(id)));
    for (const id of provider.lastSecretIds) assert.equal(Number((await handle.query("select count(*)::integer count from vault.secrets where id=$1::uuid", [id])).rows[0].count), 0, "Replaced owned secrets must be removed.");
  }
  provider.lastSecretIds = ids;
  const counts = (await handle.query("select action,count(*)::integer count from public.admin_audit_logs where actor_admin_user_id=$1 and entity_type='integration_app_configuration' and metadata->>'provider'=$2 and id>$3 group by action", [state.mainId, definition.key, provider.auditStart])).rows;
  const count = (action: string) => Number(counts.find(row => row.action === action)?.count ?? 0);
  assert.equal(count("integration.app_configuration.created"), 1); assert.equal(count("integration.app_configuration.replaced"), version - 1);
  assert.equal(count("integration.app_configuration.test_passed"), 0); assert.equal(count("integration.app_configuration.test_failed"), 0, "Incomplete Test must return before a provider test is claimed.");
  provider.phase++;
  return { ...receipt, version, secretCount: ids.length, vaultValuesVerifiedWithoutExport: true, actorBoundReplacementCount: version - 1, externalProviderTestClaims: 0 };
}

/** A complete cohort needs every ordered checkpoint, not just a successful final page. */
export function assertCoreSpecializedSettingsCompleted(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle); const state = stateByHandle.get(handle); assert.ok(state);
  assert.equal(state.securityPhase, 8); assert.equal(state.maintenanceRestored, true); assert.equal(state.maintenancePhase, 4);
  assert.deepEqual([...state.providers.keys()].sort(), providers.map(row => row.key).sort());
  for (const provider of state.providers.values()) assert.equal(provider.phase, sequence.length);
  return { status: "pass", globalClosed: false, securityCheckpoints: 8, providerCheckpoints: providers.length * sequence.length, maintenanceRestored: true, secretsExported: false };
}
