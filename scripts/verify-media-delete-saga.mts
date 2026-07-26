import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runMediaDeleteSaga,
  type MediaDeleteReservation,
  type MediaDeleteSagaDependencies,
} from "../src/lib/admin/media-catalog/delete-saga.ts";
import { buildMediaReferenceSynchronizationWarning } from "../src/lib/admin/media-catalog/reference-sync-contract.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  resolve(ROOT, "sql/migrations/20260725180000_media_delete_reservation_saga.sql"),
  "utf8",
).toLowerCase();

const reservation: MediaDeleteReservation = {
  id: "00000000-0000-4000-8000-000000000002",
  assetId: "00000000-0000-4000-8000-000000000001",
  publicValue: "https://project.supabase.co/storage/v1/object/public/cms-images/images/qa.png",
  startedAt: "2026-07-25T18:00:00.000Z",
};

let passed = 0;
async function test(name: string, callback: () => void | Promise<void>) {
  try {
    await callback();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function dependencies(
  overrides: Partial<MediaDeleteSagaDependencies<{ storagePath: string }>> = {},
) {
  let storageDeleted = false;
  return {
    reserve: async () => reservation,
    scanAfterReservation: async () => ({ referenceReasons: [], uncertainties: [] }),
    deleteStorage: async () => {
      storageDeleted = true;
      return { storagePath: "images/qa.png" };
    },
    verifyStorageState: async () => storageDeleted ? ("missing" as const) : ("exists" as const),
    cancelReservation: async () => undefined,
    finalizeReservation: async () => undefined,
    markRecoveryRequired: async () => undefined,
    ...overrides,
  } satisfies MediaDeleteSagaDependencies<{ storagePath: string }>;
}

await test("A. Used asset is rejected before Storage mutation", async () => {
  let storageDeleteCount = 0;
  await assert.rejects(
    runMediaDeleteSaga(
      dependencies({
        reserve: async () => {
          throw new Error("media_delete_asset_in_use");
        },
        deleteStorage: async () => {
          storageDeleteCount += 1;
          return { storagePath: "images/qa.png" };
        },
      }),
    ),
    /media_delete_asset_in_use/,
  );
  assert.equal(storageDeleteCount, 0);
  assert.match(migration, /media_delete_asset_in_use/);
  assert.match(migration, /from public\.media_references[\s\S]*reference\.asset_id = p_asset_id/);
});

await test("B. Unlinked reserved asset completes Storage delete then finalization", async () => {
  const calls: string[] = [];
  const result = await runMediaDeleteSaga(
    dependencies({
      reserve: async () => {
        calls.push("reserve");
        return reservation;
      },
      scanAfterReservation: async () => {
        calls.push("scan");
        return { referenceReasons: [], uncertainties: [] };
      },
      deleteStorage: async () => {
        calls.push("storage");
        return { storagePath: "images/qa.png" };
      },
      verifyStorageState: async () => "missing",
      finalizeReservation: async () => {
        calls.push("finalize");
      },
    }),
  );
  assert.equal(result.deleted, true);
  assert.deepEqual(calls, ["reserve", "scan", "storage", "finalize"]);
});

await test("C. Concurrent rebind is locked and rejects non-active assets", () => {
  const entityFunction = migration.slice(
    migration.indexOf("create or replace function public.replace_media_references_for_entity"),
    migration.indexOf("create or replace function public.replace_media_references_for_provider"),
  );
  const providerFunction = migration.slice(
    migration.indexOf("create or replace function public.replace_media_references_for_provider"),
  );
  for (const definition of [entityFunction, providerFunction]) {
    assert.match(definition, /order by asset\.id\s+for update/);
    assert.match(definition, /asset\.status <> 'active'/);
    assert.match(definition, /media_reference_asset_not_active/);
  }
  assert.match(migration, /where id = p_asset_id\s+for update/);
});

await test("D. A live reference after reservation cancels and never touches Storage", async () => {
  let cancelled = false;
  let storageDeleteCount = 0;
  const result = await runMediaDeleteSaga(
    dependencies({
      scanAfterReservation: async () => ({
        referenceReasons: ["live_reference_after_reservation:topics:1:image"],
        uncertainties: [],
      }),
      deleteStorage: async () => {
        storageDeleteCount += 1;
        return { storagePath: "images/qa.png" };
      },
      cancelReservation: async () => {
        cancelled = true;
      },
    }),
  );
  assert.equal(result.deleted, false);
  assert.equal(result.code, "media_delete_post_reservation_reference");
  assert.equal(result.recoveryState, "active");
  assert.equal(cancelled, true);
  assert.equal(storageDeleteCount, 0);
});

await test("E. Proven Storage failure compensates to active without false success", async () => {
  let cancelled = false;
  const result = await runMediaDeleteSaga(
    dependencies({
      deleteStorage: async () => {
        throw new Error("fixture_storage_failure");
      },
      verifyStorageState: async () => "exists",
      cancelReservation: async () => {
        cancelled = true;
      },
    }),
  );
  assert.equal(result.deleted, false);
  assert.equal(result.code, "media_delete_storage_failed");
  assert.equal(result.recoveryState, "active");
  assert.equal(result.repairRequired, false);
  assert.equal(cancelled, true);
});

await test("F. Finalization failure marks recovery and never restores active", async () => {
  let markedRecovery = false;
  let cancelled = false;
  const result = await runMediaDeleteSaga(
    dependencies({
      finalizeReservation: async () => {
        throw new Error("fixture_finalization_failure");
      },
      verifyStorageState: async () => "missing",
      cancelReservation: async () => {
        cancelled = true;
      },
      markRecoveryRequired: async () => {
        markedRecovery = true;
      },
    }),
  );
  assert.equal(result.deleted, false);
  assert.equal(result.code, "media_delete_finalization_failed");
  assert.equal(result.recoveryState, "missing");
  assert.equal(result.repairRequired, true);
  assert.equal(markedRecovery, true);
  assert.equal(cancelled, false);
});

await test("G. Storage still present after delete response compensates instead of finalizing", async () => {
  let cancelled = false;
  let finalized = false;
  const result = await runMediaDeleteSaga(
    dependencies({
      verifyStorageState: async () => "exists",
      cancelReservation: async () => {
        cancelled = true;
      },
      finalizeReservation: async () => {
        finalized = true;
      },
    }),
  );
  assert.equal(result.deleted, false);
  assert.equal(result.code, "media_delete_storage_failed");
  assert.equal(result.recoveryState, "active");
  assert.equal(cancelled, true);
  assert.equal(finalized, false);
});

await test("H. Uncertain post-delete verification remains nonterminal recovery", async () => {
  let recoveryStorageState: string | null = null;
  const result = await runMediaDeleteSaga(
    dependencies({
      verifyStorageState: async () => "uncertain",
      markRecoveryRequired: async (input) => {
        recoveryStorageState = input.storageState;
      },
    }),
  );
  assert.equal(result.deleted, false);
  assert.equal(result.code, "media_delete_finalization_failed");
  assert.equal(result.recoveryState, "deleting");
  assert.equal(result.repairRequired, true);
  assert.equal(recoveryStorageState, "uncertain");
});

await test("I. Domain save synchronization failure returns a structured warning", () => {
  const result = buildMediaReferenceSynchronizationWarning({
    domainKey: "topics",
    entityIdentity: "1064",
    failureReason: "fixture_sync_failure",
    uncertainties: ["fixture_sync_failure", "fixture_sync_failure"],
  });
  assert.equal(result.status, "saved_with_media_sync_warning");
  assert.equal(result.code, "media_reference_sync_failed");
  assert.equal(result.requiresReconciliation, true);
  assert.equal(result.mediaSynchronizationState, "uncertain");
  assert.deepEqual(result.uncertainties, ["fixture_sync_failure"]);
});

await test("J. Explicit empty deletes old entity references and inserts none", () => {
  const entityFunction = migration.slice(
    migration.indexOf("create or replace function public.replace_media_references_for_entity"),
    migration.indexOf("create or replace function public.replace_media_references_for_provider"),
  );
  const deleteIndex = entityFunction.indexOf("delete from public.media_references");
  const insertIndex = entityFunction.indexOf("insert into public.media_references");
  assert.ok(deleteIndex >= 0 && insertIndex > deleteIndex);
  assert.match(entityFunction, /jsonb_array_elements\(coalesce\(p_references, '\[\]'::jsonb\)\)/);
  assert.match(entityFunction, /return inserted_count/);
});

await test("Migration privileges, RLS, recovery state and scope are explicit", () => {
  assert.match(migration, /create table if not exists public\.media_delete_reservations/);
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /revoke insert, update, delete on public\.media_delete_reservations, public\.media_reference_write_leases, public\.media_reference_provider_revisions from service_role/,
  );
  assert.match(
    migration,
    /grant select on public\.media_delete_reservations, public\.media_reference_write_leases, public\.media_reference_provider_revisions to service_role/,
  );
  assert.match(migration, /grant execute on function public\.reserve_media_asset_deletion/);
  assert.match(migration, /status = 'missing'/);
  assert.match(migration, /reconciliation_state = 'uncertain'/);
  assert.doesNotMatch(migration, /storage\.objects/);
  assert.doesNotMatch(migration, /insert into public\.media_assets/);
});

console.log(`\nMedia delete Saga: ${passed}/11 contract checks passed.`);
console.log(
  "INFO Database concurrency, real Storage mutation, and Browser acceptance remain separate environment-bound proofs.",
);
