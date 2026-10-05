import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
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
  if(input&&typeof input==="object"&&(input as Record<string,unknown>).entity==="closure-wizard")return readCoreClosureWizardCheckpoint(handle,input);
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
export function assertCoreSpecializedSettingsCompleted(handle: OwnedLocalHandle, selection: "specialized-settings-followup" | null = null) {
  assertOwnedLocalHandle(handle); const state = stateByHandle.get(handle); assert.ok(state);
  assert.ok(selection === null || selection === "specialized-settings-followup");const followup=selection === "specialized-settings-followup";
  assert.equal(state.securityPhase, 8); assert.equal(state.maintenanceRestored, followup ? undefined : true); assert.equal(state.maintenancePhase, followup ? 0 : 4);
  if(followup) assert.equal(state.maintenanceStarted,false);
  assert.deepEqual([...state.providers.keys()].sort(), providers.map(row => row.key).sort());
  for (const provider of state.providers.values()) assert.equal(provider.phase, sequence.length);
  return { status: "pass", globalClosed: false, securityCheckpoints: 8, providerCheckpoints: providers.length * sequence.length, maintenanceRestored: !followup, ...(followup ? {maintenanceExecuted:false,journeySelection:selection} : {}), secretsExported: false };
}


type ClosureWizardState = { mainId:number;connectionId:string;secretId:string;appSecretId:string;groupId:string;assetIds:string[];readModelId:string;phase:number;auditStart:number;baseline?:Record<string,unknown>;configurationHash?:string;assetsHash?:string };
const closureWizardByHandle = new WeakMap<OwnedLocalHandle,ClosureWizardState>();
const closureWizardPhases = ["baseline","selection-draft","disconnect-cancelled","disconnected","reloaded"] as const;
export function validateCoreClosureWizardRequest(input:unknown) {
 assert.ok(input&&typeof input==="object"&&!Array.isArray(input));const r=input as Record<string,unknown>;
 assert.deepEqual(Object.keys(r).sort(),["entity","id","kind","phase"]);assert.equal(r.kind,"specialized-settings-state");assert.equal(r.entity,"closure-wizard");assert.match(String(r.id),/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);assert.ok((closureWizardPhases as readonly string[]).includes(String(r.phase)));return r as {id:string;kind:string;entity:string;phase:string};
}
/** Fixed same-run setup only. Synthetic provider state is uncredited; no OAuth, provider Test or external readiness claim. */
export async function prepareCoreSpecializedClosureFixtures(handle:OwnedLocalHandle,credentials:{username:string;password:string}) {
 assertOwnedLocalHandle(handle);assert.equal(closureWizardByHandle.has(handle),false);assert.equal(stateByHandle.has(handle),false);
 const actors=(await handle.query("select id from public.admin_users where username=$1 and is_active",[credentials.username])).rows;assert.equal(actors.length,1);const mainId=Number(actors[0].id);
 for(const table of["integration_connections","integration_app_configuration_groups"])assert.equal(Number((await handle.query("select count(*) n from public."+table)).rows[0].n),0,"Only a fresh disposable Integration scope may receive this owned fixture");
 const run=handle.identity.runId,secretId=String((await handle.query("select public.create_integration_vault_secret($1,$2,$3) id",[secret(credentials.password,"closure:connection"),"qa-closure-connection-"+run,"Uncredited disposable QA connection fixture"])).rows[0].id);
 const appSecretId=String((await handle.query("select public.create_integration_vault_secret($1,$2,$3) id",[secret(credentials.password,"closure:app"),"qa-closure-app-"+run,"Uncredited disposable QA App fixture"])).rows[0].id);
 // The canonical QA application runs NODE_ENV=production in its disposable local container/app; this value is a local row namespace, never a Production connection.
 const groupId=String((await handle.query("insert into public.integration_app_configuration_groups(provider_key,environment_key,version,updated_by_admin_user_id) values('meta','production',1,$1) returning id",[mainId])).rows[0].id);
 await handle.query("insert into public.integration_app_configuration_entries(group_id,provider_key,configuration_key,is_secret,vault_secret_id,safe_value) values($1,'meta','meta_app_id',false,null,'qa-closure-app'),($1,'meta','meta_app_secret',true,$2,null)",[groupId,appSecretId]);
 await handle.query("insert into public.integration_app_configuration_validations(group_id,provider_key,integration_key,status,last_tested_at,safe_error_code,version) values($1,'meta','meta_business','ready_to_connect',clock_timestamp(),'qa_owned_uncredited_precondition',1)",[groupId]);
 const connectionId=String((await handle.query("insert into public.integration_connections(integration_key,environment_key,status,credential_strategy,external_subject_id,created_by_admin_user_id,updated_by_admin_user_id) values('meta_business','production','pending_selection','meta_user',$1,$2,$2) returning id",["qa-closure-subject-"+run,mainId])).rows[0].id);
 await handle.query("insert into public.integration_credentials(connection_id,credential_strategy,access_secret_id) values($1,'meta_user',$2)",[connectionId,secretId]);
 const assets=[] as Array<{id:string;type:string;externalId:string;displayName:string}>;
 for(const type of["business","ad_account"]){const externalId="qa-"+type+"-"+run,displayName="QA "+type;const id=String((await handle.query("insert into public.integration_connection_assets(connection_id,asset_type,external_id,display_name,metadata) values($1,$2,$3,$4,$5::jsonb) returning id",[connectionId,type,externalId,displayName,JSON.stringify({qaOwned:true,ownedRunId:run,behaviorCredit:false})])).rows[0].id);assets.push({id,type,externalId,displayName});}
 const readModelId=String((await handle.query("insert into public.analytics_provider_read_models(connection_id,provider_key,period_key,compare_key,status,message,source_updated_at) values($1,'meta_marketing','last_30_days','none','unavailable','Uncredited owned fixture: no external data fetched',clock_timestamp()) returning id",[connectionId])).rows[0].id);
 closureWizardByHandle.set(handle,{mainId,connectionId,secretId,appSecretId,groupId,assetIds:assets.map(a=>a.id),readModelId,phase:0,auditStart:0});
 return{selection:"specialized-closure-followup",connectionId,assets,provider:"meta_business",uncreditedSyntheticPreconditions:true,externalOAuthExecuted:false,externalProviderTestExecuted:false,externalReadinessProven:false,secretsExported:false,ownedRunId:run};
}
async function readCoreClosureWizardCheckpoint(handle:OwnedLocalHandle,input:unknown) {
 assertOwnedLocalHandle(handle);const request=validateCoreClosureWizardRequest(input),state=closureWizardByHandle.get(handle);assert.ok(state,"The fixed owned closure fixture must be prepared");assert.equal(request.phase,closureWizardPhases[state.phase]);
 const connection=(await handle.query("select * from public.integration_connections where id=$1",[state.connectionId])).rows;assert.equal(connection.length,1);
 const credentials=(await handle.query("select connection_id,credential_strategy,access_secret_id,refresh_secret_id from public.integration_credentials where connection_id=$1",[state.connectionId])).rows;
 const assets=(await handle.query("select * from public.integration_connection_assets where connection_id=$1 order by id",[state.connectionId])).rows;assert.equal(assets.length,2);assert.deepEqual(assets.map(a=>String(a.id)).sort(),state.assetIds.toSorted());assert.ok(assets.every(a=>a.selected===false));
 const readModels=(await handle.query("select * from public.analytics_provider_read_models where connection_id=$1 order by id",[state.connectionId])).rows;
 const app=(await handle.query("select to_jsonb(g) g,(select jsonb_agg(to_jsonb(e) order by configuration_key) from public.integration_app_configuration_entries e where e.group_id=g.id) entries,(select jsonb_agg(to_jsonb(v) order by integration_key) from public.integration_app_configuration_validations v where v.group_id=g.id) validations from public.integration_app_configuration_groups g where g.id=$1",[state.groupId])).rows;
 assert.equal(app.length,1);const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex"),configHash=hash(app),assetsHash=hash(assets);
 if(state.phase===0)state.auditStart=await auditStart(handle);
 const audit=(await handle.query("select id,actor_admin_user_id,action,entity_type,metadata from public.admin_audit_logs where id>$1 order by id",[state.auditStart])).rows;
 const vault=(await handle.query("select exists(select 1 from vault.secrets where id=$1::uuid) connection_present,exists(select 1 from vault.secrets where id=$2::uuid) app_present",[state.secretId,state.appSecretId])).rows[0];assert.equal(vault.app_present,true);
 const baseline={connection,credentials,assets,readModels,app,vault,audit};
 if(state.phase===0){assert.equal(connection[0].status,"pending_selection");assert.equal(Number(connection[0].version),1);assert.equal(connection[0].revoked_at,null);assert.equal(credentials.length,1);assert.equal(readModels.length,1);assert.equal(readModels[0].id,state.readModelId);assert.equal(vault.connection_present,true);assert.equal(audit.length,0);state.baseline=baseline;state.configurationHash=configHash;state.assetsHash=assetsHash;}
 if(state.phase<3)assert.equal(isDeepStrictEqual(baseline,state.baseline),true,"Selection/cancellation must preserve the full owned native state, credentials and audit");
 else{assert.equal(connection[0].status,"revoked");assert.ok(connection[0].revoked_at);assert.equal(Number(connection[0].version),2);assert.equal(Number(connection[0].updated_by_admin_user_id),state.mainId);assert.equal(credentials.length,0);assert.equal(readModels.length,0);assert.equal(vault.connection_present,false);assert.equal(configHash,state.configurationHash);assert.equal(assetsHash,state.assetsHash);assert.equal(audit.length,1,"CORE_CLOSURE_WIZARD_AUDIT_COUNT "+JSON.stringify({phase:request.phase,expectedCount:1,actualCount:audit.length,rows:audit.slice(0,8).map(row=>({action:["integration.disconnected","auth.login.success","auth.login.failed","auth.logout"].includes(String(row.action))?String(row.action):"other",entityType:["integration_connection","admin_user","integration_app_configuration"].includes(String(row.entity_type))?String(row.entity_type):"other",actorMatchesOwned:Number(row.actor_admin_user_id)===state.mainId,metadataFields:["integration","connectionId","providerRevoked","providerRevocationDisposition","rememberMe"].filter(key=>row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)&&Object.hasOwn(row.metadata,key))})),truncated:audit.length>8}));assert.equal(Number(audit[0].actor_admin_user_id),state.mainId);assert.equal(audit[0].action,"integration.disconnected");assert.equal(audit[0].entity_type,"integration_connection");assert.deepEqual(audit[0].metadata,{integration:"meta_business",connectionId:state.connectionId,providerRevoked:false,providerRevocationDisposition:"external_manual_action"});}
 state.phase++;
 return{...request,status:"pass",ownedRunId:handle.identity.runId,actorId:state.mainId,connectionId:state.connectionId,ownedStateSha256:hash(baseline),configurationSha256:configHash,assetsSha256:assetsHash,actorBoundAuditCount:audit.length,connectionRevoked:state.phase>3,connectionCredentialsPresent:vault.connection_present,appConfigurationPreserved:true,readModelCount:readModels.length,syntheticPreconditionsUncredited:true,externalReadinessProven:false,secretsExported:false};
}
export function assertCoreSpecializedClosureCompleted(handle:OwnedLocalHandle,selection:"specialized-closure-followup"|"specialized-controls-followup"="specialized-closure-followup") {assertOwnedLocalHandle(handle);assert.ok(selection==="specialized-closure-followup"||selection==="specialized-controls-followup");const state=closureWizardByHandle.get(handle);assert.ok(state);assert.equal(state.phase,closureWizardPhases.length);assert.equal(stateByHandle.has(handle),false,"Qualified Security/Vault/Maintenance accepted lifecycles must not replay");return{status:"pass",journeySelection:selection,wizardCheckpoints:state.phase,externalReadinessProven:false,syntheticPreconditionsUncredited:true,secretsExported:false,automaticCoverage:[],globalClosed:false};}
