/**
 * Guarded, mutating Media coordination QA.
 *
 * This harness is intentionally unusable without an expiring Environment
 * Authority record, exact CLI identity assertions, an existing authenticated
 * Admin storage state, and the explicit mutation/cleanup acknowledgements.
 * It never loads .env files and never treats a credential as write authority.
 *
 * Cleanup contract: every object and synthetic reference uses the supplied
 * disposable fixture namespace. Normal cleanup uses the application Safe
 * Delete flow. If that is unavailable, compensation acquires the same delete
 * reservation before removing Storage and finalizing the catalog row. A failed
 * compensation is reported with the exact fixture identity for Recovery Center
 * follow-up; it is never hidden or force-deleted.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  assertExternalAuthenticationState,
  assertOnlyArguments,
  establishMediaQaGuard,
  guardRefusal,
  MEDIA_QA_CLEANUP_ACK,
  MEDIA_QA_MUTATION_OPT_IN,
  parseNamedArguments,
  requiredArgument,
} from "./lib/media-live-qa-guard.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_KEY = "qa_media_coordination";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type FixtureAsset = {
  id: string;
  provider: "supabase";
  bucket: string;
  objectKey: string;
  publicUrl: string;
};

type ActiveLease = {
  token: string;
  entityIdentity: string;
  closed: boolean;
};

function printUsage() {
  process.stderr.write([
    "Guarded Media coordination QA. This command MUTATES one disposable QA fixture.",
    "Required arguments:",
    `  --allow-live-qa=${MEDIA_QA_MUTATION_OPT_IN}`,
    "  --authority-file=<absolute external JSON path>",
    "  --expected-environment=<development|qa>",
    "  --expected-runtime-environment=<local|preview>",
    "  --expected-project-ref=<Supabase project ref>",
    "  --expected-environment-key=<runtime:provider:project-ref>",
    "  --expected-provider-registry-version=<exact version>",
    "  --expected-image-bucket=<exact approved Storage bucket>",
    "  --fixture-namespace=<authority-prefix>-<unique suffix>",
    "  --auth-state=<absolute external Playwright storage-state path>",
    "  --service-role-env=<explicit environment variable name>",
    "  --scenario=standard",
    `  --confirm-cleanup-plan=${MEDIA_QA_CLEANUP_ACK}`,
    "",
  ].join("\n"));
}

function cookieHeaderFromStorageState(path: string, appBaseUrl: string) {
  let state: unknown;
  try {
    state = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    guardRefusal("Authenticated browser state is not valid JSON.");
  }
  const record = state as { cookies?: Array<Record<string, unknown>> };
  if (!Array.isArray(record.cookies)) guardRefusal("Authenticated browser state has no cookies array.");
  const hostname = new URL(appBaseUrl).hostname;
  const nowSeconds = Date.now() / 1000;
  const cookies = record.cookies.filter((cookie) => {
    const domain = typeof cookie.domain === "string" ? cookie.domain.replace(/^\./, "") : "";
    const expires = typeof cookie.expires === "number" ? cookie.expires : -1;
    return (
      typeof cookie.name === "string"
      && typeof cookie.value === "string"
      && (hostname === domain || hostname.endsWith(`.${domain}`))
      && (expires < 0 || expires > nowSeconds)
    );
  });
  if (!cookies.length) guardRefusal("Authenticated browser state has no current cookie for the approved app host.");
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${response.url}; received ${response.status} ${contentType || "unknown"}.`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function rpcFailureCode(error: { message?: string; details?: string } | null) {
  return `${error?.message ?? ""} ${error?.details ?? ""}`;
}

async function expectRpcFailure(
  operation: PromiseLike<{ error: { message?: string; details?: string } | null }>,
  expectedCode: string,
) {
  const result = await operation;
  assert(result.error, `Expected ${expectedCode}, but the RPC succeeded.`);
  assert(
    rpcFailureCode(result.error).includes(expectedCode),
    `Expected ${expectedCode}; received ${rpcFailureCode(result.error)}.`,
  );
}

async function assertCatalogRuntime(
  supabase: SupabaseClient,
  expected: {
    provider: string;
    runtimeEnvironment: string;
    environmentKey: string;
    providerRegistryVersion: string;
  },
) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "media.catalog_state")
    .maybeSingle();
  if (error) guardRefusal(`Cannot prove media.catalog_state: ${error.message}`);
  const value = data?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    guardRefusal("media.catalog_state is missing or malformed.");
  }
  const state = value as Record<string, unknown>;
  const actual = {
    state: state.state,
    provider: state.provider,
    environment: state.environment,
    environmentKey: state.environmentKey,
    providerRegistryVersion: state.providerRegistryVersion,
  };
  if (
    actual.state !== "synced"
    || actual.provider !== expected.provider
    || actual.environment !== expected.runtimeEnvironment
    || actual.environmentKey !== expected.environmentKey
    || actual.providerRegistryVersion !== expected.providerRegistryVersion
  ) {
    guardRefusal(`Connected catalog context does not match the approved dataset: ${JSON.stringify(actual)}.`);
  }
}

function assertRecoveryQueueContext(
  value: unknown,
  expected: {
    provider: string;
    imageBucket: string;
    runtimeEnvironment: string;
    environmentKey: string;
    providerRegistryVersion: string;
  },
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    guardRefusal("Authenticated recovery probe did not return a queue object.");
  }
  const context = (value as Record<string, unknown>).context;
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    guardRefusal("Authenticated recovery probe did not expose connected environment context.");
  }
  const actual = context as Record<string, unknown>;
  if (
    actual.provider !== expected.provider
    || actual.imageBucket !== expected.imageBucket
    || actual.environment !== expected.runtimeEnvironment
    || actual.environmentIdentity !== expected.environmentKey
    || actual.registryVersion !== expected.providerRegistryVersion
  ) {
    guardRefusal(`Application dataset does not match Environment Authority: ${JSON.stringify(actual)}.`);
  }
}

function requireFixtureAsset(value: unknown, expected: {
  namespace: string;
  folder: string;
  filename: string;
  bucket: string;
  storageOrigin: string;
}): FixtureAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Upload did not return a catalog asset.");
  }
  const asset = value as Record<string, unknown>;
  const result = {
    id: typeof asset.id === "string" ? asset.id : "",
    provider: asset.provider,
    bucket: typeof asset.bucket === "string" ? asset.bucket : "",
    objectKey: typeof asset.objectKey === "string" ? asset.objectKey : "",
    publicUrl: typeof asset.publicUrl === "string" ? asset.publicUrl : "",
  };
  if (
    !result.id
    || result.provider !== "supabase"
    || result.bucket !== expected.bucket
  ) {
    throw new Error(`Upload escaped the disposable fixture namespace: ${JSON.stringify(result)}.`);
  }
  const filenameStem = expected.filename.replace(/\.png$/i, "");
  const escapedFolder = expected.folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedStem = filenameStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^${escapedFolder}/${escapedStem}-[0-9a-f-]{12}\\.png$`, "i").test(result.objectKey)) {
    throw new Error(`Upload object key is outside the exact fixture identity: ${result.objectKey}.`);
  }
  const expectedPath = `/storage/v1/object/public/${result.bucket}/${result.objectKey}`;
  let observedOrigin = "";
  let observedPath = "";
  try {
    const observed = new URL(result.publicUrl);
    observedOrigin = observed.origin;
    observedPath = decodeURIComponent(observed.pathname);
  } catch {}
  if (observedOrigin !== expected.storageOrigin || observedPath !== expectedPath) {
    throw new Error(`Upload public URL does not match the exact bucket/object identity: ${result.publicUrl}.`);
  }
  return result as FixtureAsset;
}

async function run() {
  const values = parseNamedArguments(process.argv.slice(2));
  if (!values.size) {
    printUsage();
    guardRefusal("No live-QA authority or opt-in was supplied; no network call was made.");
  }
  assertOnlyArguments(values, [
    "allow-live-qa",
    "authority-file",
    "expected-environment",
    "expected-runtime-environment",
    "expected-project-ref",
    "expected-environment-key",
    "expected-provider-registry-version",
    "expected-image-bucket",
    "fixture-namespace",
    "auth-state",
    "service-role-env",
    "scenario",
    "confirm-cleanup-plan",
  ]);
  const guard = establishMediaQaGuard({
    values,
    optInArgument: "allow-live-qa",
    expectedOptIn: MEDIA_QA_MUTATION_OPT_IN,
    repositoryRoot: ROOT,
  });
  const authState = assertExternalAuthenticationState(ROOT, requiredArgument(values, "auth-state"));
  const scenario = requiredArgument(values, "scenario");
  if (scenario !== "standard") guardRefusal("--scenario must exactly equal standard; every live run must clean up fully.");
  const serviceRoleEnvironmentName = requiredArgument(values, "service-role-env");
  if (!/^[A-Z][A-Z0-9_]{4,80}$/.test(serviceRoleEnvironmentName)) {
    guardRefusal("--service-role-env must name one explicit uppercase environment variable.");
  }
  const serviceRoleKey = process.env[serviceRoleEnvironmentName]?.trim();
  if (!serviceRoleKey) {
    guardRefusal(`Credential variable ${serviceRoleEnvironmentName} is absent; credentials never imply permission.`);
  }

  const { authority, fixtureNamespace } = guard;
  const cookie = cookieHeaderFromStorageState(authState, authority.appBaseUrl);
  const appRequest = (pathname: string, init: RequestInit = {}) =>
    fetch(new URL(pathname, authority.appBaseUrl), {
      ...init,
      redirect: "manual",
      headers: { Cookie: cookie, ...(init.headers ?? {}) },
    });

  // Authentication is proven against the actual application before any route
  // or Supabase mutation is attempted. Redirects/login pages are rejected.
  const authProbe = await appRequest("/api/admin/media-library/recovery");
  if (authProbe.status !== 200) {
    guardRefusal(`Existing Admin session was not accepted (${authProbe.status}); auth is never bypassed.`);
  }
  const recoveryProbe = await readJson(authProbe);
  assertRecoveryQueueContext(recoveryProbe, {
    provider: authority.provider,
    imageBucket: authority.imageBucket,
    runtimeEnvironment: authority.runtimeEnvironment,
    environmentKey: authority.environmentKey,
    providerRegistryVersion: authority.providerRegistryVersion,
  });

  const supabase = createClient(authority.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await assertCatalogRuntime(supabase, {
    provider: authority.provider,
    runtimeEnvironment: authority.runtimeEnvironment,
    environmentKey: authority.environmentKey,
    providerRegistryVersion: authority.providerRegistryVersion,
  });

  const fixtureFolder = `images/qa/media-coordination/${fixtureNamespace}`;
  const fixtureFilename = `${fixtureNamespace}-${randomBytes(4).toString("hex")}.png`;
  const identities = {
    primary: `${fixtureNamespace}:primary`,
    partialA: `${fixtureNamespace}:partial-a`,
    partialB: `${fixtureNamespace}:partial-b`,
    staleExpected: `${fixtureNamespace}:stale-expected`,
    staleActual: `${fixtureNamespace}:stale-actual`,
  };
  let asset: FixtureAsset | null = null;
  let orphanStorageObjectKey: string | null = null;
  let uploadAttempted = false;
  const leases: ActiveLease[] = [];
  let deletionProven = false;
  const cleanupErrors: string[] = [];

  async function assertFixtureNamespaceUnused() {
    const [catalog, references, leases, reservations, storage] = await Promise.all([
      supabase
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .like("object_key", `${fixtureFolder}/%`),
      supabase
        .from("media_references")
        .select("id", { count: "exact", head: true })
        .eq("domain_key", DOMAIN_KEY)
        .like("entity_identity", `${fixtureNamespace}:%`),
      supabase
        .from("media_reference_write_leases")
        .select("id", { count: "exact", head: true })
        .like("request_identity", `${fixtureNamespace}:%`),
      supabase
        .from("media_delete_reservations")
        .select("id", { count: "exact", head: true })
        .like("request_identity", `${fixtureNamespace}:%`),
      supabase.storage.from(authority.imageBucket).list(fixtureFolder, { limit: 2 }),
    ]);
    const error = catalog.error ?? references.error ?? leases.error ?? reservations.error ?? storage.error;
    if (error) guardRefusal(`Cannot prove fixture namespace is unused: ${error.message}`);
    if (
      catalog.count !== 0
      || references.count !== 0
      || leases.count !== 0
      || reservations.count !== 0
      || (storage.data ?? []).length !== 0
    ) {
      guardRefusal(
        `Fixture namespace is not unique: ${JSON.stringify({
          catalog: catalog.count,
          references: references.count,
          leases: leases.count,
          reservations: reservations.count,
          storage: storage.data?.length ?? 0,
        })}.`,
      );
    }
  }

  async function discoverAmbiguousUpload() {
    const stem = fixtureFilename.replace(/\.png$/i, "");
    const { data, error } = await supabase
      .from("media_assets")
      .select("id,provider,bucket,object_key,public_url")
      .eq("provider", "supabase")
      .eq("bucket", authority.imageBucket)
      .like("object_key", `${fixtureFolder}/${stem}-%`)
      .limit(2);
    if (error) throw new Error(`Ambiguous upload Catalog discovery failed: ${error.message}`);
    if ((data ?? []).length > 1) {
      throw new Error("Ambiguous upload created more than one Catalog asset; cleanup requires owner review.");
    }
    const row = data?.[0];
    if (row) {
      asset = requireFixtureAsset(
        {
          id: row.id,
          provider: row.provider,
          bucket: row.bucket,
          objectKey: row.object_key,
          publicUrl: row.public_url,
        },
        {
          namespace: fixtureNamespace,
          folder: fixtureFolder,
          filename: fixtureFilename,
          bucket: authority.imageBucket,
          storageOrigin: new URL(authority.supabaseUrl).origin,
        },
      );
      return;
    }
    const { data: objects, error: storageError } = await supabase.storage
      .from(authority.imageBucket)
      .list(fixtureFolder, { search: stem, limit: 2 });
    if (storageError) throw new Error(`Ambiguous upload Storage discovery failed: ${storageError.message}`);
    const matching = (objects ?? []).filter((entry) => entry.name.startsWith(`${stem}-`) && entry.name.endsWith(".png"));
    if (matching.length === 1) orphanStorageObjectKey = `${fixtureFolder}/${matching[0].name}`;
    if (matching.length > 1) {
      throw new Error("Ambiguous upload created multiple Storage objects; cleanup requires owner review.");
    }
  }

  function assertExactFixtureAsset() {
    assert(asset);
    requireFixtureAsset(asset, {
      namespace: fixtureNamespace,
      folder: fixtureFolder,
      filename: fixtureFilename,
      bucket: authority.imageBucket,
      storageOrigin: new URL(authority.supabaseUrl).origin,
    });
  }

  async function acquire(targetIdentities: string[], requestSuffix: string) {
    assert(asset);
    const { data, error } = await supabase.rpc("acquire_media_reference_write_lease", {
      p_targets: targetIdentities.map((entityIdentity) => ({
        provider: asset!.provider,
        bucket: asset!.bucket,
        objectKey: asset!.objectKey,
        domainKey: DOMAIN_KEY,
        entityType: "qa_fixture",
        entityIdentity,
      })),
      p_actor_id: null,
      p_request_identity: `${fixtureNamespace}:${requestSuffix}`,
      p_ttl_seconds: 180,
      p_expected_provider: authority.provider,
      p_expected_environment: authority.runtimeEnvironment,
      p_expected_environment_key: authority.environmentKey,
      p_expected_provider_registry_version: authority.providerRegistryVersion,
    });
    if (error) throw new Error(`Acquire ${requestSuffix}: ${rpcFailureCode(error)}`);
    const row = Array.isArray(data) ? data[0] : data;
    const token = row && typeof row === "object" && typeof row.lease_token === "string"
      ? row.lease_token
      : "";
    assert(token, `Acquire ${requestSuffix} did not return a lease token.`);
    const lease = { token, entityIdentity: targetIdentities[0], closed: false };
    leases.push(lease);
    return lease;
  }

  async function failLease(lease: ActiveLease, code: string) {
    const { data, error } = await supabase.rpc("fail_media_reference_write_lease", {
      p_lease_token: lease.token,
      p_entity_identity: lease.entityIdentity,
      p_failure_code: code,
      p_failure_metadata: { fixtureNamespace },
      p_domain_write_committed: false,
    });
    if (error) throw new Error(`Compensate lease ${lease.token}: ${rpcFailureCode(error)}`);
    assert.equal(Number(data), 1, "Lease compensation must affect the one disposable asset.");
    lease.closed = true;
  }

  async function clearFixtureReference(entityIdentity: string) {
    const { error } = await supabase.rpc("replace_media_references_for_entity", {
      p_domain_key: DOMAIN_KEY,
      p_entity_type: "qa_fixture",
      p_entity_identity: entityIdentity,
      p_references: [],
      p_lease_token: null,
      p_lease_entity_identity: null,
    });
    if (error) throw new Error(`Clear fixture reference ${entityIdentity}: ${rpcFailureCode(error)}`);
  }

  async function appSafeDelete() {
    assertExactFixtureAsset();
    assert(asset);
    const response = await appRequest("/api/admin/media-library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-request-id": `${fixtureNamespace}:safe-delete` },
      body: JSON.stringify({ asset: asset.publicUrl }),
    });
    const body = await readJson(response);
    if (!response.ok || body.deleted !== true) {
      throw new Error(`Application Safe Delete was blocked (${response.status}): ${JSON.stringify(body)}.`);
    }
  }

  async function compensateWithReservation() {
    assertExactFixtureAsset();
    assert(asset);
    const { count: references, error: referenceError } = await supabase
      .from("media_references")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset.id);
    if (referenceError || references !== 0) {
      throw new Error(`Compensation refused: persisted references=${references}, error=${referenceError?.message ?? "none"}.`);
    }
    const { data: reservationData, error: reservationError } = await supabase.rpc(
      "reserve_media_asset_deletion",
      {
        p_asset_id: asset.id,
        p_actor_id: null,
        p_request_identity: `${fixtureNamespace}:cleanup-reservation`,
        p_expected_asset_provider: asset.provider,
        p_expected_asset_bucket: asset.bucket,
        p_expected_asset_object_key: asset.objectKey,
        p_expected_provider: authority.provider,
        p_expected_environment: authority.runtimeEnvironment,
        p_expected_environment_key: authority.environmentKey,
        p_expected_provider_registry_version: authority.providerRegistryVersion,
      },
    );
    if (reservationError) throw new Error(`Cleanup reservation refused: ${rpcFailureCode(reservationError)}`);
    const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData;
    const reservationId = reservation && typeof reservation === "object" && typeof reservation.reservation_id === "string"
      ? reservation.reservation_id
      : "";
    if (!reservationId) throw new Error("Cleanup reservation returned no identity.");

    const { error: removeError } = await supabase.storage.from(asset.bucket).remove([asset.objectKey]);
    if (removeError) {
      const parentPath = asset.objectKey.split("/").slice(0, -1).join("/");
      const filename = asset.objectKey.split("/").at(-1);
      const { data: verifiedObjects, error: verificationError } = await supabase.storage
        .from(asset.bucket)
        .list(parentPath, { search: filename, limit: 10 });
      const storageStillExists = !verificationError
        && verifiedObjects?.some((entry) => entry.name === filename);
      if (storageStillExists) {
        const { error: cancelError } = await supabase.rpc("cancel_media_asset_deletion", {
          p_asset_id: asset.id,
          p_reservation_id: reservationId,
          p_failure_code: "qa_fixture_cleanup_storage_failed",
          p_failure_metadata: { fixtureNamespace, removeError: removeError.message },
          p_storage_state: "exists",
          p_storage_verified_at: new Date().toISOString(),
        });
        throw new Error(
          `Fixture Storage cleanup failed (${removeError.message}); verified-existing reservation cancellation=${cancelError?.message ?? "completed"}.`,
        );
      }
      if (verificationError) {
        const { error: recoveryError } = await supabase.rpc("mark_media_asset_delete_recovery", {
          p_asset_id: asset.id,
          p_reservation_id: reservationId,
          p_failure_code: "qa_fixture_cleanup_storage_uncertain",
          p_failure_metadata: {
            fixtureNamespace,
            removeError: removeError.message,
            verificationError: verificationError.message,
          },
          p_storage_state: "uncertain",
          p_storage_verified_at: null,
        });
        throw new Error(
          `Fixture Storage cleanup result is uncertain; Recovery Center mark=${recoveryError?.message ?? "completed"}.`,
        );
      }
      process.stdout.write("INFO Storage remove returned an error, but a follow-up listing proved the fixture absent.\n");
    }
    const { data: remaining, error: listError } = await supabase.storage
      .from(asset.bucket)
      .list(asset.objectKey.split("/").slice(0, -1).join("/"), {
        search: asset.objectKey.split("/").at(-1),
        limit: 10,
      });
    const fixtureStillExists = remaining?.some(
      (entry) => entry.name === asset!.objectKey.split("/").at(-1),
    );
    if (listError) {
      const { error: recoveryError } = await supabase.rpc("mark_media_asset_delete_recovery", {
        p_asset_id: asset.id,
        p_reservation_id: reservationId,
        p_failure_code: "qa_fixture_cleanup_verification_failed",
        p_failure_metadata: { fixtureNamespace, verificationError: listError.message },
        p_storage_state: "uncertain",
        p_storage_verified_at: null,
      });
      throw new Error(
        `Storage absence not proven after cleanup; Recovery Center mark=${recoveryError?.message ?? "completed"}.`,
      );
    }
    if (fixtureStillExists) {
      const { error: cancelError } = await supabase.rpc("cancel_media_asset_deletion", {
        p_asset_id: asset.id,
        p_reservation_id: reservationId,
        p_failure_code: "qa_fixture_cleanup_object_retained",
        p_failure_metadata: { fixtureNamespace },
        p_storage_state: "exists",
        p_storage_verified_at: new Date().toISOString(),
      });
      throw new Error(
        `Storage object still exists after cleanup; verified-existing reservation cancellation=${cancelError?.message ?? "completed"}.`,
      );
    }
    const { data: finalState, error: finalizeError } = await supabase.rpc("finalize_media_asset_deletion", {
      p_asset_id: asset.id,
      p_reservation_id: reservationId,
      p_storage_state: "missing",
      p_storage_verified_at: new Date().toISOString(),
    });
    if (finalizeError || finalState !== "deleted") {
      throw new Error(`Cleanup finalization failed: ${rpcFailureCode(finalizeError)} ${String(finalState)}.`);
    }
  }

  async function proveFixtureDeleted() {
    assert(asset);
    const parentPath = asset.objectKey.split("/").slice(0, -1).join("/");
    const filename = asset.objectKey.split("/").at(-1) ?? "";
    const [catalog, references, reservations, leases, storage] = await Promise.all([
      supabase
        .from("media_assets")
        .select("status,missing_object")
        .eq("id", asset.id)
        .single(),
      supabase
        .from("media_references")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", asset.id),
      supabase
        .from("media_delete_reservations")
        .select("status")
        .eq("asset_id", asset.id),
      supabase
        .from("media_reference_write_leases")
        .select("status,resolved_at")
        .like("request_identity", `${fixtureNamespace}:%`),
      supabase.storage.from(asset.bucket).list(parentPath, { search: filename, limit: 10 }),
    ]);
    const error = catalog.error ?? references.error ?? reservations.error ?? leases.error ?? storage.error;
    if (error) throw new Error(`Final fixture proof failed: ${error.message}`);
    const storageStillExists = (storage.data ?? []).some((entry) => entry.name === filename);
    const openReservation = (reservations.data ?? []).some(
      (row) => row.status === "reserved" || row.status === "recovery_required",
    );
    const unresolvedLease = (leases.data ?? []).some(
      (row) => row.status === "active"
        || ((row.status === "failed" || row.status === "expired") && !row.resolved_at),
    );
    if (
      catalog.data?.status !== "deleted"
      || catalog.data?.missing_object !== false
      || references.count !== 0
      || storageStillExists
      || openReservation
      || unresolvedLease
    ) {
      throw new Error(`Final fixture proof is incomplete: ${JSON.stringify({
        catalog: catalog.data,
        references: references.count,
        storageStillExists,
        openReservation,
        unresolvedLease,
      })}.`);
    }
  }

  await assertFixtureNamespaceUnused();

  try {
    const upload = new FormData();
    upload.set("folder", fixtureFolder);
    upload.set("kind", "image");
    upload.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), fixtureFilename);
    uploadAttempted = true;
    const uploadResponse = await appRequest("/api/admin/media-library", { method: "POST", body: upload });
    const uploadBody = await readJson(uploadResponse);
    if (uploadResponse.status !== 201) {
      throw new Error(`Disposable fixture upload failed (${uploadResponse.status}): ${JSON.stringify(uploadBody)}.`);
    }
    asset = requireFixtureAsset(uploadBody.asset, {
      namespace: fixtureNamespace,
      folder: fixtureFolder,
      filename: fixtureFilename,
      bucket: authority.imageBucket,
      storageOrigin: new URL(authority.supabaseUrl).origin,
    });
    process.stdout.write(`PASS disposable upload: ${asset.id} ${asset.objectKey}\n`);

    const primaryLease = await acquire([identities.primary], "lease-vs-delete");
    await expectRpcFailure(
      supabase.rpc("reserve_media_asset_deletion", {
        p_asset_id: asset.id,
        p_actor_id: null,
        p_request_identity: `${fixtureNamespace}:blocked-delete`,
        p_expected_asset_provider: asset.provider,
        p_expected_asset_bucket: asset.bucket,
        p_expected_asset_object_key: asset.objectKey,
        p_expected_provider: authority.provider,
        p_expected_environment: authority.runtimeEnvironment,
        p_expected_environment_key: authority.environmentKey,
        p_expected_provider_registry_version: authority.providerRegistryVersion,
      }),
      "media_delete_write_lease_unresolved",
    );
    process.stdout.write("PASS active write lease blocks delete reservation\n");

    const reference = [{
      assetId: asset.id,
      fieldKey: "qa_fixture_asset",
      entityLabel: fixtureNamespace,
      referenceState: "draft",
      restorable: false,
      metadata: { fixtureNamespace },
    }];
    const { error: syncError } = await supabase.rpc("replace_media_references_for_entity", {
      p_domain_key: DOMAIN_KEY,
      p_entity_type: "qa_fixture",
      p_entity_identity: identities.primary,
      p_references: reference,
      p_lease_token: primaryLease.token,
      p_lease_entity_identity: identities.primary,
    });
    if (syncError) throw new Error(`Primary reference sync failed: ${rpcFailureCode(syncError)}`);
    const { data: completed, error: completionError } = await supabase.rpc(
      "complete_media_reference_write_lease",
      { p_lease_token: primaryLease.token, p_entity_identity: identities.primary },
    );
    if (completionError || Number(completed) !== 1) {
      throw new Error(`Primary lease completion failed: ${rpcFailureCode(completionError)}.`);
    }
    primaryLease.closed = true;
    await clearFixtureReference(identities.primary);
    process.stdout.write("PASS synchronized lease completes and dedicated reference clears\n");

    const partialLease = await acquire([identities.partialA, identities.partialB], "partial-sync");
    const { error: partialSyncError } = await supabase.rpc("replace_media_references_for_entity", {
      p_domain_key: DOMAIN_KEY,
      p_entity_type: "qa_fixture",
      p_entity_identity: identities.partialA,
      p_references: reference,
      p_lease_token: partialLease.token,
      p_lease_entity_identity: identities.partialA,
    });
    if (partialSyncError) throw new Error(`Partial reference sync setup failed: ${rpcFailureCode(partialSyncError)}`);
    await expectRpcFailure(
      supabase.rpc("complete_media_reference_write_lease", {
        p_lease_token: partialLease.token,
        p_entity_identity: identities.partialA,
      }),
      "media_write_lease_sync_incomplete",
    );
    await failLease(partialLease, "qa_partial_sync_compensated_before_domain_commit");
    await clearFixtureReference(identities.partialA);
    process.stdout.write("PASS partial synchronization is fail-closed and compensated\n");

    const staleLease = await acquire([identities.staleExpected], "stale-form");
    await expectRpcFailure(
      supabase.rpc("replace_media_references_for_entity", {
        p_domain_key: DOMAIN_KEY,
        p_entity_type: "qa_fixture",
        p_entity_identity: identities.staleActual,
        p_references: reference,
        p_lease_token: staleLease.token,
        p_lease_entity_identity: `${identities.staleExpected}:mismatch`,
      }),
      "media_reference_write_lease_mismatch",
    );
    await failLease(staleLease, "qa_stale_form_compensated_before_domain_commit");
    process.stdout.write("PASS stale-form lease identity mismatch is fail-closed and compensated\n");

    await appSafeDelete();
    await proveFixtureDeleted();
    deletionProven = true;
    process.stdout.write("PASS application Safe Delete completed for disposable fixture\n");
  } finally {
    if (uploadAttempted && !asset) {
      try {
        await discoverAmbiguousUpload();
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (asset && !deletionProven) {
      for (const lease of leases.filter((entry) => !entry.closed)) {
        try {
          await failLease(lease, "qa_harness_compensation_before_domain_commit");
        } catch (error) {
          cleanupErrors.push(error instanceof Error ? error.message : String(error));
        }
      }
      for (const identity of Object.values(identities)) {
        try {
          await clearFixtureReference(identity);
        } catch (error) {
          cleanupErrors.push(error instanceof Error ? error.message : String(error));
        }
      }
      try {
        await appSafeDelete();
        await proveFixtureDeleted();
        deletionProven = true;
      } catch (applicationDeleteError) {
        cleanupErrors.push(
          `Application Safe Delete: ${applicationDeleteError instanceof Error ? applicationDeleteError.message : String(applicationDeleteError)}`,
        );
        try {
          await compensateWithReservation();
          await proveFixtureDeleted();
          deletionProven = true;
        } catch (compensationError) {
          cleanupErrors.push(
            `Reservation compensation: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
          );
        }
      }
    }

    if (asset && !deletionProven) {
      process.stderr.write(
        `RECOVERY_REQUIRED fixtureNamespace=${fixtureNamespace} assetId=${asset.id} bucket=${asset.bucket} objectKey=${asset.objectKey}\n`,
      );
    }
    if (!asset && orphanStorageObjectKey) {
      process.stderr.write(
        `RECOVERY_REQUIRED fixtureNamespace=${fixtureNamespace} bucket=${authority.imageBucket} objectKey=${orphanStorageObjectKey} reason=storage_object_without_catalog_identity\n`,
      );
    }
    if (cleanupErrors.length) {
      process.stderr.write(`Cleanup diagnostics:\n${cleanupErrors.map((item) => `- ${item}`).join("\n")}\n`);
    }
  }

  assert(deletionProven, "Disposable fixture cleanup was not proven; use the emitted Recovery Center identity.");
  process.stdout.write("Media coordination live QA passed; disposable fixture cleanup was proven.\n");
}

run().catch((error) => {
  process.stderr.write(`MEDIA_COORDINATION_LIVE_QA_FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
