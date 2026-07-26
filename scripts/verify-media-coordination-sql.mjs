import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "sql/migrations/20260725180000_media_delete_reservation_saga.sql",
);
const runner = read("scripts/verify-media-coordination-postgres.mts");
const fixture = read(
  "scripts/fixtures/media-coordination-postgres-bootstrap.sql",
);
const concurrencyFixture = read(
  "scripts/fixtures/media-coordination-postgres-concurrency-setup.sql",
);
const integration = read(
  "scripts/fixtures/media-coordination-postgres-tests.sql",
);
const writeLeaseRuntime = read("src/lib/admin/media-catalog/write-lease.ts");
const synchronizationRuntime = read("src/lib/admin/media-catalog/synchronization.ts");
const safeDeleteRuntime = read("src/lib/admin/media-catalog/safe-delete.ts");
const physicalMoveRuntime = read("src/lib/admin/media-catalog/physical-move.ts");
const providerRuntime = read("src/lib/admin/media-catalog/reference-providers.ts");
const packageJson = JSON.parse(read("package.json"));
const qualityWorkflow = read(".github/workflows/quality-gate.yml");
const postgresJob = qualityWorkflow.slice(
  qualityWorkflow.indexOf("  media-coordination-postgres:"),
);

const checks = [];
const check = (description, condition) => checks.push({ description, condition });

const functionBody = (name) => {
  const marker = `create or replace function public.${name}`;
  const start = migration.indexOf(marker);
  if (start < 0) return "";
  const end = migration.indexOf("\n$$;", start);
  return end < 0 ? "" : migration.slice(start, end + 4);
};

const acquire = functionBody("acquire_media_reference_write_lease");
const complete = functionBody("complete_media_reference_write_lease");
const failLease = functionBody("fail_media_reference_write_lease");
const resolve = functionBody("resolve_media_reference_write_lease");
const transitionMove = functionBody("transition_media_asset_identity_for_move");
const rollbackMove = functionBody("rollback_media_asset_identity_move");
const finalizeMove = functionBody("finalize_media_asset_identity_move");
const reserve = functionBody("reserve_media_asset_deletion");
const cancel = functionBody("cancel_media_asset_deletion");
const finalize = functionBody("finalize_media_asset_deletion");
const recovery = functionBody("mark_media_asset_delete_recovery");
const repair = functionBody("repair_media_delete_reservation");
const providerRevision = functionBody("get_media_reference_provider_revision");
const entitySync = functionBody("replace_media_references_for_entity");
const providerSync = functionBody("replace_media_references_for_provider");

check("write-lease table exists", migration.includes("create table if not exists public.media_reference_write_leases"));
check("delete-reservation table exists", migration.includes("create table if not exists public.media_delete_reservations"));
check("provider-domain revision fence table exists", migration.includes("create table if not exists public.media_reference_provider_revisions"));
check("reference UUID validation remains PostgreSQL 15 compatible", !migration.includes("pg_input_is_valid") && entitySync.includes("^[0-9a-f]{8}") && providerSync.includes("^[0-9a-f]{8}"));
check("lease acquisition locks assets in stable UUID order", acquire.includes("order by asset.id\n  for update"));
check("lease batch tokens are collision-guarded while remaining shared by the batch", acquire.includes("pg_advisory_xact_lock(hashtextextended(created_token::text, 0))") && acquire.includes("where existing.lease_token = created_token"));
check("reservation locks its catalog asset", reserve.includes("where id = p_asset_id\n  for update"));
check("reservation validates the exact canonical identity", reserve.includes("p_expected_asset_bucket") && reserve.includes("media_delete_asset_identity_changed") && reserve.includes("reserved_object_key"));
check("reservation lifecycle remains bound to the immutable canonical identity", [cancel, finalize, recovery, repair].every((body) => body.includes("target_reservation.reserved_bucket") && body.includes("target_reservation.reserved_object_key") && body.includes("target_reservation.reserved_public_url") && body.includes("media_delete_asset_identity_changed")));
check("lease acquisition rejects active delete reservations", acquire.includes("media_write_lease_delete_reserved"));
check("delete reservation rejects unresolved write leases", reserve.includes("media_delete_write_lease_unresolved"));
check("safe-delete preflight surfaces unresolved leases with a bounded query", safeDeleteRuntime.includes('.from("media_reference_write_leases")') && safeDeleteRuntime.includes('reasons: ["media_delete_write_lease_unresolved"]') && safeDeleteRuntime.includes(".limit(1)"));
check("lease captures provider/environment/registry context", acquire.includes("p_expected_provider_registry_version") && acquire.includes("trim(p_expected_environment_key)"));
check("batch completion requires all declared targets to be synchronized", complete.includes("media_write_lease_sync_incomplete") && complete.includes("jsonb_array_elements(lease.synchronized_targets)"));
check("failed/expired recovery requires a later run identity", resolve.includes("lastSuccessfulReconciliationRunIdentity") && resolve.includes("lastSuccessfulReconciliationAt") && resolve.includes("media_write_lease_reconciliation_not_proven"));
check("failed/expired recovery requires exact provider context", resolve.includes("media_write_lease_reconciliation_context_mismatch") && resolve.includes("lease.provider_registry_version"));
check("active expired leases cannot be resolved from time alone", !resolve.includes("lease.status = 'active' and lease.expires_at <= now()"));
check("entity synchronization rejects NULL references", entitySync.includes("p_references is null") && entitySync.includes("invalid_media_reference_synchronization_input"));
check("entity synchronization enforces the matching lease target", entitySync.includes("media_reference_write_lease_required") && entitySync.includes("media_reference_write_lease_mismatch"));
check("every successful entity synchronization advances the provider revision", entitySync.includes("set revision = revision + 1") && entitySync.indexOf("set revision = revision + 1") > entitySync.indexOf("delete from public.media_references"));
check("failed write leases order revision creation and locking before asset coordination", failLease.includes("insert into public.media_reference_provider_revisions") && failLease.includes("order by 1\n  on conflict") && failLease.includes("set revision = revision.revision + 1") && failLease.indexOf("for update;") < failLease.indexOf("perform asset.id"));
check("provider synchronization rejects NULL references", providerSync.includes("p_references is null") && providerSync.includes("invalid_media_provider_synchronization_input"));
check("provider synchronization coordinates the old/new asset union", providerSync.includes("union\n    select distinct reference.asset_id") && providerSync.includes("media_reconciliation_write_lease_active"));
check("provider reconciliation blocks every active lease regardless of TTL", providerSync.includes("lease.status = 'active'\n      and exists") && !providerSync.includes("lease.status = 'active'\n      and lease.expires_at > clock_timestamp()"));
check("provider synchronization locks and compares the captured domain revision", providerSync.includes("p_expected_provider_revision bigint") && providerSync.includes("for update") && providerSync.includes("media_reconciliation_snapshot_stale"));
check("provider synchronization finds active leases by declared domain target", providerSync.includes("jsonb_array_elements(lease.write_targets)") && providerSync.includes("target->>'domainKey' = trim(p_domain_key)"));
check("provider revision reads are stable and non-mutating", providerRevision.includes("stable") && providerRevision.includes("return coalesce(current_revision, 0)") && !providerRevision.includes("insert into"));
check("cancel requires recent Storage-exists proof", cancel.includes("p_storage_state is distinct from 'exists'") && cancel.includes("media_delete_storage_existence_not_proven"));
check("finalize requires recent Storage-missing proof", finalize.includes("p_storage_state is distinct from 'missing'") && finalize.includes("media_delete_storage_absence_not_proven"));
check("uncertain recovery remains deleting", recovery.includes("case when p_storage_state = 'missing' then 'missing' else 'deleting' end"));
check("missing recovery requires a verification timestamp", recovery.includes("p_storage_state = 'missing' and p_storage_verified_at is null"));
check("confirm_missing is a terminal reservation state", repair.includes("status = 'missing_confirmed'") && migration.includes("'missing_confirmed'"));
check("coordination-table direct service-role writes are revoked", migration.includes("revoke insert, update, delete on public.media_delete_reservations, public.media_reference_write_leases, public.media_reference_provider_revisions from service_role"));
check("direct media-reference DML cannot bypass the revision fence", migration.includes("revoke insert, update, delete on public.media_references from service_role") && migration.includes("grant select on public.media_references to service_role"));
check("direct Catalog asset delete cannot trigger cascade outside the Saga", migration.includes("revoke delete on public.media_assets from service_role") && migration.includes("grant select, insert, update on public.media_assets to service_role"));
check("coordination tables have RLS enabled", migration.includes("alter table public.media_delete_reservations enable row level security") && migration.includes("alter table public.media_reference_write_leases enable row level security") && migration.includes("alter table public.media_reference_provider_revisions enable row level security"));
check("physical move transition is lease-bound and marks Catalog uncertain", transitionMove.includes("media_catalog_physical_move") && transitionMove.includes("for update") && transitionMove.includes("reconciliation_state = 'uncertain'") && transitionMove.includes("lease_affected_count"));
check("physical move rollback requires the unresolved matching lease", rollbackMove.includes("media_physical_move_rollback_lease_mismatch") && rollbackMove.includes("lease.resolved_at is null"));
check("physical move finalization proves exact identity under its synthetic active lease", finalizeMove.includes("media_physical_move_finalization_lease_mismatch") && finalizeMove.includes("asset.object_key = trim(p_expected_object_key)") && finalizeMove.includes("reconciliation_state = 'synced'") && finalizeMove.includes("media_catalog_physical_move") && finalizeMove.includes("p_asset_id::text"));
check("physical move RPC grants are service-role-only", migration.includes("grant execute on function public.transition_media_asset_identity_for_move") && migration.includes("revoke all on function public.rollback_media_asset_identity_move") && migration.includes("grant execute on function public.finalize_media_asset_identity_move"));
check("finalize function comment uses the current signature", migration.includes("comment on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz)"));
check("recovery function comment uses the current signature", migration.includes("comment on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz)"));

check("runner skips safely without an isolated URL", runner.includes("SKIP verify-media-coordination-postgres") && runner.includes("MEDIA_COORDINATION_DATABASE_REQUIRED"));
check("runner requires loopback and disposable acknowledgement", runner.includes("loopbackHosts") && runner.includes("MEDIA_COORDINATION_DATABASE_DISPOSABLE"));
check("runner restricts disposable database names", runner.includes("venesia_media_coordination_ci") && runner.includes("isolatedDatabaseName"));
check("runner applies only the approved prerequisite migration chain", runner.includes('"sql/migrations/20250625400000_site_settings_footer.sql"') && runner.includes('"sql/migrations/20250625600000_admin_users.sql"') && runner.includes('"sql/migrations/20260725090000_media_catalog_reference_foundation.sql"') && runner.includes('"sql/migrations/20260725180000_media_delete_reservation_saga.sql"'));
check("runner starts multiple real psql connections", runner.includes("spawn(") && runner.includes("Promise.all([first.completion, second.completion])"));
check("runner proves opposite-order batches without deadlock", runner.includes("verifyReverseOrderBatchLocking") && runner.includes("media_write_lease_conflict") && runner.includes("deadlock detected|lock timeout|statement timeout"));
check("runner holds a reservation while stale writes race", runner.includes("MEDIA_DELETE_RESERVATION_HELD") && runner.includes("entity-rebind-against-reservation") && runner.includes("provider-rebind-against-reservation"));
check("runner proves stable revision ordering for concurrent multi-domain failures", runner.includes("verifyReverseOrderFailureRevisionLocking") && runner.includes("ci-failed-revision-order-a") && runner.includes("ci-failed-revision-order-b") && runner.includes("without deadlock"));
check("runner serializes provider-first and later entity writes without deadlock", runner.includes("verifyProviderSnapshotBeforeEntityWrite") && runner.includes("MEDIA_PROVIDER_REVISION_LOCK_HELD") && runner.includes("provider_snapshot_won_over_newer_entity_write"));
check("runner proves physical move versus stale safe-delete ordering in both directions", runner.includes("verifyPhysicalMoveAgainstStaleSafeDelete") && runner.includes("physical-move-race-stale-delete-after-transition") && runner.includes("media_delete_asset_identity_changed") && runner.includes("media_delete_write_lease_unresolved"));
check("package exposes static ACL, SQL, and PostgreSQL coordination commands", packageJson.scripts?.["verify:media-coordination-rpc-acl"] === "node scripts/verify-media-coordination-rpc-acl.mjs" && packageJson.scripts?.["verify:media-coordination-sql"] === "node scripts/verify-media-coordination-sql.mjs" && packageJson.scripts?.["verify:media-coordination-postgres"] === "node --experimental-strip-types scripts/verify-media-coordination-postgres.mts");
check("final local gate invokes coordination ACL and database proof safely", packageJson.scripts?.["ci:check"]?.includes("verify:media-coordination-rpc-acl") && packageJson.scripts?.["ci:check"]?.includes("verify:media-coordination-sql") && packageJson.scripts?.["ci:check"]?.includes("verify:media-coordination-postgres"));
check("quality workflow has an independent PostgreSQL 15 job", postgresJob.startsWith("  media-coordination-postgres:") && postgresJob.includes("image: postgres:15-alpine") && postgresJob.includes("MEDIA_COORDINATION_DATABASE_REQUIRED: \"1\"") && postgresJob.includes("MEDIA_COORDINATION_DATABASE_DISPOSABLE: \"1\""));
check("quality workflow guards Media coordination RPC ACLs in both jobs", qualityWorkflow.match(/npm run verify:media-coordination-rpc-acl/g)?.length === 2);
check("isolated PostgreSQL job does not consume Supabase secrets", !postgresJob.includes("SUPABASE_") && postgresJob.includes("127.0.0.1:5432/venesia_media_coordination_ci"));
check("fixture enforces PostgreSQL 15", fixture.includes("server_major <> 15"));
check("fixture resets only the isolated coordination proof schemas before reruns", fixture.includes("drop schema if exists media_coordination_acl_test cascade") && fixture.includes("drop schema if exists media_coordination_test cascade"));
check("fixture creates Supabase runtime roles", fixture.includes("create role anon") && fixture.includes("create role authenticated") && fixture.includes("create role service_role"));
check("physical-move fixtures provision a valid Catalog folder", concurrencyFixture.includes("values ('images/coordination', 'images'") && runner.includes("'images/coordination'") && integration.includes("'images/coordination'"));
check("runtime primary identity comes from the first actual managed target", writeLeaseRuntime.includes("primaryEntityIdentity: targets[0].entityIdentity") && !writeLeaseRuntime.includes("primaryEntityIdentity: input.scopes[0].entityIdentity"));
check("media-empty scopes are skipped before the primary target is selected", writeLeaseRuntime.includes("if (!managed) continue;") && writeLeaseRuntime.indexOf("if (!managed) continue;") < writeLeaseRuntime.indexOf("primaryEntityIdentity: targets[0].entityIdentity"));
check("physical move retains one external lease through rebind and completion", physicalMoveRuntime.includes("externalLease: moveLease") && physicalMoveRuntime.indexOf("externalLease: moveLease") < physicalMoveRuntime.indexOf("completeMediaReferenceWriteLease(moveLease") && physicalMoveRuntime.includes("transition_media_asset_identity_for_move"));
check("provider rebind uses typed compare-and-set with ambiguous-write verification", providerRuntime.includes("isDeepStrictEqual") && providerRuntime.includes("config.jsonFields?.includes(reference.fieldKey)") && providerRuntime.includes("JSON.stringify(currentValue)") && providerRuntime.includes("media_reference_rebind_state_uncertain"));
check("runtime captures the provider revision before scan and submits it with the snapshot", synchronizationRuntime.indexOf("getMediaReferenceProviderRevision(") < synchronizationRuntime.indexOf("provider.scanAll()") && synchronizationRuntime.includes("p_expected_provider_revision: expectedProviderRevision"));

for (const proof of [
  "reverse-ordered multi-asset input",
  "lease -> reservation",
  "reservation -> lease",
  "media_reference_write_lease_required",
  "media_write_lease_sync_incomplete",
  "Complete token mismatch",
  "Cancel token mismatch",
  "Finalize token mismatch",
  "wrong-completion-identity",
  "partially expired batch completion was not atomic",
  "explicit empty references",
  "provider synchronization locks the union",
  "stale provider snapshot overwrote a completed entity write",
  "ci-revision-active-outside-union",
  "stale provider snapshot resurrected an explicit-empty entity reference",
  "failed write lease did not advance the provider revision fence",
  "reconciliation relinked a deleting asset",
  "media_write_lease_reconciliation_context_mismatch",
  "expired active lease allowed provider reconciliation to rewrite references",
  "ci-expired-still-blocks-delete",
  "delete reservation did not become available after expired lease owner closure",
  "ci-failed-lease-blocks-delete",
  "Storage-exists evidence",
  "Storage-missing evidence",
  "missing_without_timestamp",
  "Storage-deleted finalization failure was not recoverable",
  "confirm_missing",
  "service_role direct coordination/reference privileges",
  "stale-delete-identity",
  "physical move Catalog transition",
  "physical move Catalog rollback",
]) {
  check(
    `integration fixture covers ${proof}`,
    integration.toLowerCase().includes(proof.toLowerCase()),
  );
}

const failures = checks.filter((entry) => !entry.condition);
for (const entry of checks) {
  console.log(`${entry.condition ? "PASS" : "FAIL"} ${entry.description}`);
}

if (failures.length > 0) {
  console.error(
    `verify-media-coordination-sql failed (${failures.length}/${checks.length}).`,
  );
  process.exit(1);
}

console.log(`verify-media-coordination-sql passed (${checks.length}/${checks.length}).`);
