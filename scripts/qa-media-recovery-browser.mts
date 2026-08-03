/**
 * Guarded, authenticated Browser QA for Media write/delete coordination.
 *
 * This flow is intentionally mutating, but only for one disposable,
 * namespaced image and one disposable draft Topic in an explicitly approved
 * Development/QA environment. It proves the connected Admin application and
 * catalog context before the first write, uses the real picker/form/delete UI,
 * and fails if cleanup cannot be proven. Authentication is never stubbed.
 *
 * The Recovery Center accessibility/failure checks run only after the real
 * scenario. Their GET/POST responses are namespaced and intercepted, so those
 * checks cannot create an additional recovery record.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext, type Page } from "playwright";

import {
  assertExternalAuthenticationState,
  assertOnlyArguments,
  establishMediaQaGuard,
  guardRefusal,
  MEDIA_QA_BROWSER_OPT_IN,
  MEDIA_QA_CLEANUP_ACK,
  parseNamedArguments,
  requiredArgument,
  type MediaQaAuthority,
} from "./lib/media-live-qa-guard.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const MUTATING_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type FixtureAsset = {
  id: string;
  provider: "supabase";
  bucket: string;
  objectKey: string;
  publicUrl: string;
  displayName: string;
};

type TopicFixture = {
  id: number;
  slug: string;
  title: string;
};

type ReservationFixture = {
  id: string;
  active: boolean;
};

function printUsage() {
  process.stderr.write([
    "Guarded authenticated Media coordination Browser QA. This command MUTATES and cleans one disposable fixture.",
    "Required arguments:",
    `  --allow-browser-qa=${MEDIA_QA_BROWSER_OPT_IN}`,
    "  --authority-file=<absolute external JSON path>",
    "  --expected-environment=<development|qa>",
    "  --expected-runtime-environment=<local|preview>",
    "  --expected-project-ref=<Supabase project ref>",
    "  --expected-environment-key=<runtime:provider:project-ref>",
    "  --expected-provider-registry-version=<exact version>",
    "  --expected-image-bucket=<exact approved image bucket>",
    "  --fixture-namespace=<authority-prefix>-<unique suffix>",
    "  --auth-state=<absolute external Playwright storage-state path>",
    "  --service-role-env=<explicit environment variable name>",
    "  --scenario=<standard|governing>",
    `  --confirm-cleanup-plan=${MEDIA_QA_CLEANUP_ACK}`,
    "",
  ].join("\n"));
}

function rpcFailure(error: { message?: string; details?: string } | null) {
  return `${error?.message ?? ""} ${error?.details ?? ""}`.trim();
}

function requireObject(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function approvedAppOrigin(authority: Pick<MediaQaAuthority, "appBaseUrl">) {
  return new URL(authority.appBaseUrl).origin;
}

function assertApprovedPageLocation(
  page: Page,
  authority: Pick<MediaQaAuthority, "appBaseUrl">,
  expectedPathname: string,
  label: string,
) {
  const actual = new URL(page.url());
  assert.equal(actual.origin, approvedAppOrigin(authority), `${label} escaped the approved application origin.`);
  assert.equal(actual.pathname, expectedPathname, `${label} reached an unexpected application path.`);
}

function isApprovedAppRequest(
  requestUrl: string,
  authority: Pick<MediaQaAuthority, "appBaseUrl">,
  expectedPathname: string,
) {
  const actual = new URL(requestUrl);
  return actual.origin === approvedAppOrigin(authority) && actual.pathname === expectedPathname;
}

function storageSafeNamespace(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requireUploadedAsset(
  value: unknown,
  authority: Pick<MediaQaAuthority, "imageBucket" | "supabaseUrl">,
  originalFilename: string,
): FixtureAsset {
  const asset = requireObject(value, "Media upload asset");
  const result = {
    id: typeof asset.id === "string" ? asset.id : "",
    provider: asset.provider,
    bucket: typeof asset.bucket === "string" ? asset.bucket : "",
    objectKey: typeof asset.objectKey === "string" ? asset.objectKey : "",
    publicUrl: typeof asset.publicUrl === "string" ? asset.publicUrl : "",
    displayName: typeof asset.displayName === "string" ? asset.displayName : "",
  };
  if (
    !result.id
    || result.provider !== "supabase"
    || result.bucket !== authority.imageBucket
    || !result.displayName
  ) {
    throw new Error(`Upload did not return a complete managed identity: ${JSON.stringify(result)}.`);
  }
  const stem = storageSafeNamespace(originalFilename.replace(/\.png$/i, ""));
  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^images/${escapedStem}-\\d{13}-[0-9a-f-]{12}\\.png$`).test(result.objectKey)) {
    throw new Error(`Upload object key is outside the exact disposable identity: ${result.objectKey}.`);
  }
  const publicUrl = new URL(result.publicUrl);
  if (
    publicUrl.origin !== new URL(authority.supabaseUrl).origin
    || decodeURIComponent(publicUrl.pathname) !== `/storage/v1/object/public/${result.bucket}/${result.objectKey}`
    || result.displayName !== originalFilename
  ) {
    throw new Error(`Upload public identity does not match its exact bucket/object key: ${JSON.stringify(result)}.`);
  }
  return result as FixtureAsset;
}

function assertQueueContext(
  value: unknown,
  authority: Pick<MediaQaAuthority, "provider" | "imageBucket" | "runtimeEnvironment" | "environmentKey" | "providerRegistryVersion">,
) {
  const context = requireObject(requireObject(value, "Recovery queue").context, "Recovery queue context");
  if (
    context.provider !== authority.provider
    || context.imageBucket !== authority.imageBucket
    || context.environment !== authority.runtimeEnvironment
    || context.environmentIdentity !== authority.environmentKey
    || context.registryVersion !== authority.providerRegistryVersion
  ) {
    guardRefusal(`Recovery endpoint context does not match Environment Authority: ${JSON.stringify(context)}.`);
  }
}

async function assertCatalogRuntime(supabase: SupabaseClient, authority: MediaQaAuthority) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "media.catalog_state")
    .maybeSingle();
  if (error) guardRefusal(`Cannot prove media.catalog_state: ${error.message}`);
  const state = requireObject(data?.value, "media.catalog_state");
  const actual = {
    state: state.state,
    provider: state.provider,
    environment: state.environment,
    environmentKey: state.environmentKey,
    providerRegistryVersion: state.providerRegistryVersion,
  };
  if (
    actual.state !== "synced"
    || actual.provider !== authority.provider
    || actual.environment !== authority.runtimeEnvironment
    || actual.environmentKey !== authority.environmentKey
    || actual.providerRegistryVersion !== authority.providerRegistryVersion
  ) {
    guardRefusal(`Connected catalog context is not the approved synchronized dataset: ${JSON.stringify(actual)}.`);
  }

  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(authority.imageBucket);
  if (bucketError || !bucket || bucket.id !== authority.imageBucket) {
    guardRefusal(`Cannot prove the approved image bucket ${authority.imageBucket}: ${bucketError?.message ?? "not found"}.`);
  }
}

async function assertNamespaceUnused(supabase: SupabaseClient, authority: MediaQaAuthority, namespace: string) {
  const storageNamespace = storageSafeNamespace(namespace);
  const checks = await Promise.all([
    supabase.from("media_assets").select("id", { count: "exact", head: true }).ilike("object_key", `%${storageNamespace}%`),
    supabase.from("topics").select("id", { count: "exact", head: true }).ilike("slug", `${namespace}%`),
    supabase.from("media_delete_reservations").select("id", { count: "exact", head: true }).ilike("request_identity", `%${namespace}%`),
    supabase.from("media_reference_write_leases").select("id", { count: "exact", head: true }).ilike("request_identity", `%${namespace}%`),
  ]);
  for (const check of checks) {
    if (check.error) guardRefusal(`Cannot prove fixture namespace isolation: ${check.error.message}`);
    if (check.count !== 0) guardRefusal(`Fixture namespace ${namespace} was used previously; choose a new unique suffix.`);
  }

  // Bucket identity is authority-owned; the path itself must also be unused.
  const { data: objects, error } = await supabase.storage
    .from(authority.imageBucket)
    .list("images", { search: storageNamespace, limit: 100 });
  if (error) guardRefusal(`Cannot prove Storage namespace isolation: ${error.message}`);
  if (objects?.some((entry) => entry.name.includes(namespace))) {
    guardRefusal(`Storage already contains the fixture namespace ${namespace}.`);
  }
}

async function waitUntil<T>(label: string, probe: () => Promise<T | null | false>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`${label} was not proven before timeout${lastError ? `: ${String(lastError)}` : ""}.`);
}

async function storageObjectExists(supabase: SupabaseClient, asset: FixtureAsset) {
  const segments = asset.objectKey.split("/");
  const filename = segments.pop();
  const parent = segments.join("/");
  assert(filename, "Fixture asset has no Storage filename.");
  const { data, error } = await supabase.storage
    .from(asset.bucket)
    .list(parent, { search: filename, limit: 100 });
  if (error) throw new Error(`Storage verification failed: ${error.message}`);
  return Boolean(data?.some((entry) => entry.name === filename));
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert(
    dimensions.documentWidth <= dimensions.viewportWidth + 1
      && dimensions.bodyWidth <= dimensions.viewportWidth + 1,
    `${label} has horizontal overflow: ${JSON.stringify(dimensions)}.`,
  );
}

async function createDraftTopic(supabase: SupabaseClient, namespace: string): Promise<TopicFixture> {
  const { data: category, error: categoryError } = await supabase
    .from("topic_categories")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (categoryError || !category) {
    guardRefusal(`A real active Topic category is required before disposable Topic setup: ${categoryError?.message ?? "none exists"}.`);
  }
  const now = new Date().toISOString();
  const title = `${namespace} Browser QA draft`;
  const slug = `${namespace}-topic`;
  const { data, error } = await supabase
    .from("topics")
    .insert({
      title,
      slug,
      excerpt: "Disposable Media coordination Browser QA fixture.",
      content: "Disposable fixture; removed by the harness.",
      image: "",
      image_alt: "",
      category: category.name,
      category_slug: category.slug,
      category_id: category.id,
      content_type: "article",
      status: "draft",
      created_at: now,
      updated_at: now,
    })
    .select("id,slug,title")
    .single();
  if (error || !data) throw new Error(`Disposable draft Topic setup failed: ${error?.message ?? "no row"}.`);
  return { id: Number(data.id), slug: String(data.slug), title: String(data.title) };
}

async function discoverAmbiguousTopic(supabase: SupabaseClient, namespace: string) {
  const { data, error } = await supabase
    .from("topics")
    .select("id,slug,title")
    .eq("slug", `${namespace}-topic`)
    .limit(2);
  if (error) throw new Error(`Ambiguous Topic setup discovery failed: ${error.message}`);
  if ((data ?? []).length > 1) throw new Error("Disposable Topic setup produced more than one exact fixture row.");
  const row = data?.[0];
  return row
    ? { id: Number(row.id), slug: String(row.slug), title: String(row.title) } satisfies TopicFixture
    : null;
}

async function discoverAmbiguousUpload(
  supabase: SupabaseClient,
  authority: MediaQaAuthority,
  originalFilename: string,
) {
  const stem = storageSafeNamespace(originalFilename.replace(/\.png$/i, ""));
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,provider,bucket,object_key,public_url,display_name")
    .eq("provider", "supabase")
    .eq("bucket", authority.imageBucket)
    .like("object_key", `images/${stem}-%`)
    .limit(2);
  if (error) throw new Error(`Ambiguous Browser upload Catalog discovery failed: ${error.message}`);
  if ((data ?? []).length > 1) throw new Error("Browser upload produced more than one exact Catalog fixture.");
  const row = data?.[0];
  if (row) {
    return {
      asset: requireUploadedAsset({
        id: row.id,
        provider: row.provider,
        bucket: row.bucket,
        objectKey: row.object_key,
        publicUrl: row.public_url,
        displayName: row.display_name,
      }, authority, originalFilename),
      orphanStorageObjectKey: null,
    };
  }

  const { data: objects, error: storageError } = await supabase.storage
    .from(authority.imageBucket)
    .list("images", { search: stem, limit: 2 });
  if (storageError) throw new Error(`Ambiguous Browser upload Storage discovery failed: ${storageError.message}`);
  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactName = new RegExp(`^${escapedStem}-\\d{13}-[0-9a-f-]{12}\\.png$`);
  const matching = (objects ?? []).filter((entry) => exactName.test(entry.name));
  if (matching.length > 1) throw new Error("Browser upload produced multiple exact Storage fixtures.");
  return {
    asset: null,
    orphanStorageObjectKey: matching.length === 1 ? `images/${matching[0].name}` : null,
  };
}

async function readTopic(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase
    .from("topics")
    .select("id,title,image,deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Topic proof failed: ${error.message}`);
  return data as { id: number; title: string; image: string; deleted_at: string | null } | null;
}

async function referenceCount(supabase: SupabaseClient, assetId: string) {
  const { count, error } = await supabase
    .from("media_references")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId);
  if (error) throw new Error(`Reference count proof failed: ${error.message}`);
  return count ?? 0;
}

async function assertFixtureDeleteProof(
  supabase: SupabaseClient,
  authority: MediaQaAuthority,
  namespace: string,
  asset: FixtureAsset,
) {
  const storageNamespace = storageSafeNamespace(namespace);
  assert(asset.displayName.includes(namespace), "Delete proof lost the same-run display-name namespace.");
  assert(asset.objectKey.includes(storageNamespace), "Delete proof lost the same-run Storage-safe object-key namespace.");
  assert(asset.publicUrl.includes(storageNamespace), "Delete proof lost the same-run Storage-safe public-URL namespace.");
  assert.equal(asset.bucket, authority.imageBucket, "Delete proof escaped the approved image bucket.");

  const { data: catalog, error: catalogError } = await supabase
    .from("media_assets")
    .select("id,provider,bucket,object_key,public_url,status")
    .eq("id", asset.id)
    .single();
  if (catalogError || !catalog) throw new Error(`Delete proof cannot read Catalog identity: ${catalogError?.message ?? "missing"}.`);
  assert.deepEqual(
    {
      id: catalog.id,
      provider: catalog.provider,
      bucket: catalog.bucket,
      objectKey: catalog.object_key,
      publicUrl: catalog.public_url,
      status: catalog.status,
    },
    {
      id: asset.id,
      provider: asset.provider,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      publicUrl: asset.publicUrl,
      status: "active",
    },
    "Catalog identity does not exactly match the same-run Storage identity.",
  );
  assert(await storageObjectExists(supabase, asset), "Delete proof cannot find the exact same-run Storage object.");

  const { data: references, error: referencesError } = await supabase
    .from("media_references")
    .select("domain_key,entity_type,entity_identity")
    .eq("asset_id", asset.id);
  if (referencesError) throw new Error(`Delete proof cannot read persisted references: ${referencesError.message}.`);
  assert.deepEqual(references ?? [], [], "Delete proof found a persisted reference outside the unlinked fixture state.");
}

function assertReadyLibraryPayload(value: unknown, authority: MediaQaAuthority, label: string) {
  const payload = requireObject(value, label);
  const readiness = requireObject(payload.readiness, `${label} readiness`);
  const runtimeContext = requireObject(readiness.context, `${label} runtime context`);
  assert.equal(runtimeContext.provider, authority.provider, `${label} provider mismatch.`);
  assert.equal(runtimeContext.environment, authority.runtimeEnvironment, `${label} environment mismatch.`);
  assert.equal(runtimeContext.identity, authority.environmentKey, `${label} environment identity mismatch.`);
  assert.equal(readiness.runtimeDatasetMatches, true, `${label} runtime dataset is stale.`);
  assert.equal(readiness.usageResultsAuthoritative, true, `${label} usage is not authoritative.`);
  assert.equal(readiness.safeDeleteReady, true, `${label} Safe Delete is not ready.`);
  return payload;
}

function assertUsagePayload(
  value: unknown,
  expectedCount: number,
  authority: MediaQaAuthority,
  label: string,
) {
  const payload = requireObject(value, label);
  const readiness = requireObject(payload.readiness, `${label} readiness`);
  const runtimeContext = requireObject(readiness.context, `${label} runtime context`);
  assert.equal(runtimeContext.provider, authority.provider, `${label} provider mismatch.`);
  assert.equal(runtimeContext.environment, authority.runtimeEnvironment, `${label} environment mismatch.`);
  assert.equal(runtimeContext.identity, authority.environmentKey, `${label} environment identity mismatch.`);
  assert.equal(payload.catalogRegistered, true, `${label} asset is not registered.`);
  assert.equal(payload.count, expectedCount, `${label} live usage count mismatch.`);
  assert(Array.isArray(payload.hits), `${label} hits are not an array.`);
  assert.equal(payload.hits.length, expectedCount, `${label} live hit list mismatch.`);
  assert.equal(payload.scanComplete, true, `${label} scan is incomplete.`);
  assert.equal(payload.authoritative, true, `${label} usage result is not authoritative.`);
  assert.equal(readiness.runtimeDatasetMatches, true, `${label} runtime dataset is stale.`);
  assert.equal(readiness.safeDeleteReady, true, `${label} Safe Delete is not ready.`);
  if (expectedCount === 0) {
    assert.equal(payload.unusedAuthoritative, true, `${label} zero usage is not authoritative.`);
  }
  return payload;
}

async function uploadThroughMediaUi(page: Page, authority: MediaQaAuthority, filename: string) {
  const navigation = await page.goto(new URL("/admin/media-library", authority.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  assert(navigation && navigation.status() < 400, `Media Library returned ${navigation?.status() ?? "no response"}.`);
  assertApprovedPageLocation(page, authority, "/admin/media-library", "Media upload navigation");
  await page.locator('[data-media-library-mode="manage"]').waitFor({ state: "visible" });
  const uploadButton = page.getByRole("button", { name: "رفع ملفات", exact: true });
  await uploadButton.waitFor({ state: "visible" });
  await waitUntil("Media upload control readiness", async () => (
    await uploadButton.isEnabled() ? true : null
  ));

  const uploadResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST"
      && isApprovedAppRequest(response.url(), authority, "/api/admin/media-library");
  });
  await page.locator('[data-media-library-mode="manage"] input[type="file"]').first().setInputFiles({
    name: filename,
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  const response = await uploadResponsePromise;
  const body = await response.json().catch(() => null);
  if (response.status() !== 201) {
    throw new Error(`Media UI upload failed (${response.status()}): ${JSON.stringify(body)}.`);
  }
  return requireUploadedAsset(requireObject(body, "Media upload response").asset, authority, filename);
}

async function chooseAssetInTopicPicker(page: Page, asset: FixtureAsset) {
  const imagePanel = page.locator("#content-image-field");
  await imagePanel.locator('button[type="button"]').first().click();
  const picker = page.locator("[data-media-picker-root]");
  await picker.waitFor({ state: "visible" });

  // Topic image pickers start at images/topics. Return to the real images root
  // where this disposable UI upload was created, then use the actual search.
  const imagesCrumb = picker.getByRole("button", { name: "images", exact: true });
  if (await imagesCrumb.count()) await imagesCrumb.first().click();
  await picker.locator('input[type="search"]').fill(asset.displayName);
  const card = picker.locator("article", { hasText: asset.displayName });
  await card.waitFor({ state: "visible" });
  await card.locator('button[aria-pressed]').click();
  await picker.getByRole("button", { name: /تأكيد الاختيار/ }).click();
  await picker.waitFor({ state: "hidden" });
  await assertTopicImageValue(page, asset.publicUrl);
}

async function assertTopicImageValue(page: Page, expected: string) {
  await page.waitForFunction(
    ({ selector, value }) => (document.querySelector(selector) as HTMLInputElement | null)?.value === value,
    { selector: '#content-image-field input[name="image"]', value: expected },
  );
}

async function saveTopicAndWaitForPost(
  page: Page,
  authority: Pick<MediaQaAuthority, "appBaseUrl">,
  topicPath: string,
) {
  const post = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && isApprovedAppRequest(response.url(), authority, topicPath);
  });
  await page.locator('[data-admin-form-action="save"]').click();
  return post;
}

async function openAndSelectAsset(page: Page, authority: MediaQaAuthority, asset: FixtureAsset) {
  const navigation = await page.goto(new URL("/admin/media-library", authority.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  assert(navigation && navigation.status() < 400, `Media Library returned ${navigation?.status() ?? "no response"}.`);
  assertApprovedPageLocation(page, authority, "/admin/media-library", "Media Library navigation");
  const library = page.locator('[data-media-library-mode="manage"]');
  await library.waitFor({ state: "visible" });
  await library.locator('input[type="search"]').fill(asset.displayName);
  const card = library.locator("article", { hasText: asset.displayName });
  await card.waitFor({ state: "visible" });
  const usageResponse = page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "GET" || !isApprovedAppRequest(response.url(), authority, "/api/admin/media-usage")) {
      return false;
    }
    return new URL(response.url()).searchParams.get("asset") === asset.publicUrl;
  });
  await card.locator('button[aria-pressed]').click();
  const usage = await usageResponse;
  assert.equal(usage.status(), 200, `Live Usage returned ${usage.status()}.`);
  return { library, card, usage: await usage.json().catch(() => null) };
}

async function clickSafeDeleteAndCapture(
  page: Page,
  authority: Pick<MediaQaAuthority, "appBaseUrl">,
  expectedStatus: number,
) {
  const deleteButton = page.getByRole("button", { name: /حذف آمن|الحذف الآمن/ }).first();
  await deleteButton.waitFor({ state: "visible" });
  assert.equal(await deleteButton.isEnabled(), true, "Safe Delete control is not available in the approved synchronized QA context.");
  await deleteButton.click();
  const dialog = page.locator('[data-admin-confirm-dialog=""]');
  await dialog.waitFor({ state: "visible" });
  const deleteResponse = page.waitForResponse((response) => (
    response.request().method() === "DELETE"
      && isApprovedAppRequest(response.url(), authority, "/api/admin/media-library")
  ));
  await dialog.locator("footer button").last().click();
  const response = await deleteResponse;
  assert.equal(response.status(), expectedStatus, `Safe Delete returned ${response.status()} instead of ${expectedStatus}.`);
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function reserveDelete(
  supabase: SupabaseClient,
  authority: MediaQaAuthority,
  namespace: string,
  asset: FixtureAsset,
): Promise<ReservationFixture> {
  const { data, error } = await supabase.rpc("reserve_media_asset_deletion", {
    p_asset_id: asset.id,
    p_actor_id: null,
    p_request_identity: `${namespace}:browser-stale-form-reservation`,
    p_expected_asset_provider: asset.provider,
    p_expected_asset_bucket: asset.bucket,
    p_expected_asset_object_key: asset.objectKey,
    p_expected_provider: authority.provider,
    p_expected_environment: authority.runtimeEnvironment,
    p_expected_environment_key: authority.environmentKey,
    p_expected_provider_registry_version: authority.providerRegistryVersion,
  });
  if (error) throw new Error(`Direct QA delete reservation failed: ${rpcFailure(error)}.`);
  const row = Array.isArray(data) ? data[0] : data;
  const id = row && typeof row === "object" && typeof row.reservation_id === "string"
    ? row.reservation_id
    : "";
  if (!id) throw new Error("Direct QA delete reservation returned no reservation identity.");
  return { id, active: true };
}

async function cancelVerifiedExistingReservation(
  supabase: SupabaseClient,
  namespace: string,
  asset: FixtureAsset,
  reservation: ReservationFixture,
) {
  assert(await storageObjectExists(supabase, asset), "Reservation cancellation requires exact Storage-exists proof.");
  const { data, error } = await supabase.rpc("cancel_media_asset_deletion", {
    p_asset_id: asset.id,
    p_reservation_id: reservation.id,
    p_failure_code: "qa_stale_form_rejected_before_domain_commit",
    p_failure_metadata: { fixtureNamespace: namespace, proof: "storage_object_exact_match" },
    p_storage_state: "exists",
    p_storage_verified_at: new Date().toISOString(),
  });
  if (error || data !== "active") {
    throw new Error(`Verified-existing reservation cancellation failed: ${rpcFailure(error)} ${String(data)}.`);
  }
  reservation.active = false;
}

async function runRecoveryUiChecks(
  context: BrowserContext,
  page: Page,
  authority: MediaQaAuthority,
  namespace: string,
) {
  let queueFailure = false;
  let postedTarget: unknown = null;
  const syntheticQueue = {
    available: true,
    generatedAt: new Date().toISOString(),
    warning: null,
    truncated: false,
    resultLimitPerType: 100,
    context: {
      provider: authority.provider,
      imageBucket: authority.imageBucket,
      environment: authority.runtimeEnvironment,
      environmentIdentity: authority.environmentKey,
      registryVersion: authority.providerRegistryVersion,
      runtimeState: "synced",
      lastSuccessfulRunIdentity: "00000000-0000-4000-8000-000000000001",
      lastSuccessfulRunAt: new Date().toISOString(),
    },
    counts: { stuckDeletes: 1, missingOrUncertainAssets: 0, unresolvedLeaseBatches: 0 },
    items: [{
      id: "00000000-0000-4000-8000-000000000002",
      kind: "delete_reservation",
      state: "reserved",
      assetId: "00000000-0000-4000-8000-000000000003",
      assetCount: 1,
      assetLabel: namespace,
      publicValue: `/images/qa/media-coordination/${namespace}/fixture.png`,
      failureCode: "qa_browser_fixture",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: null,
      lastStorageVerification: null,
      lastProviderScan: null,
      suggestedAction: "QA-only namespaced recovery fixture. No backend action will be sent.",
      allowedActions: ["cancel_reservation"],
      blockedReasons: [],
    }],
  };

  const recoveryPattern = "**/api/admin/media-library/recovery";
  await context.route(recoveryPattern, async (route) => {
    if (!isApprovedAppRequest(route.request().url(), authority, "/api/admin/media-library/recovery")) {
      await route.fallback();
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: queueFailure ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          queueFailure
            ? { error: "QA injected recovery queue failure", code: "qa_injected_queue_failure" }
            : syntheticQueue,
        ),
      });
      return;
    }
    if (route.request().method() === "POST") {
      postedTarget = route.request().postDataJSON();
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "QA injected recovery action failure",
          code: "qa_injected_recovery_failure",
        }),
      });
      return;
    }
    await route.abort("blockedbyclient");
  });

  try {
    const settingsUrl = new URL("/admin/settings/media", authority.appBaseUrl).toString();
    const navigation = await page.goto(settingsUrl, { waitUntil: "domcontentloaded" });
    assert(navigation && navigation.status() < 400, `Media settings returned ${navigation?.status() ?? "no response"}.`);
    assertApprovedPageLocation(page, authority, "/admin/settings/media", "Media Settings navigation");

    const fixtureArticle = page.locator("article", { hasText: namespace });
    await fixtureArticle.waitFor({ state: "visible" });
    assert.equal(await page.locator('[data-admin-confirm-dialog-root=""]').count(), 0, "Confirmation starts closed.");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).direction), "rtl");
    await assertNoHorizontalOverflow(page, "desktop Recovery Center");
    process.stdout.write("PASS 12 authenticated Recovery Center visibility and desktop RTL layout\n");

    const actionButton = fixtureArticle.getByRole("button").first();
    await actionButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator('[data-admin-confirm-dialog=""]');
    await dialog.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.activeElement?.hasAttribute("data-admin-confirm-cancel"));
    await page.keyboard.press("Shift+Tab");
    assert(await dialog.evaluate((element) => element.contains(document.activeElement)), "Shift+Tab escaped the confirmation focus trap.");
    await page.keyboard.press("Tab");
    assert(await dialog.evaluate((element) => element.contains(document.activeElement)), "Tab escaped the confirmation focus trap.");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    const actionButtonHandle = await actionButton.elementHandle();
    assert(actionButtonHandle, "Recovery action button detached before focus restoration.");
    await page.waitForFunction((button) => document.activeElement === button, actionButtonHandle);

    await actionButton.click();
    await dialog.waitFor({ state: "visible" });
    await dialog.locator("footer button").last().click();
    await page.getByText("QA injected recovery action failure", { exact: true }).waitFor({ state: "visible" });
    const posted = requireObject(postedTarget, "Recovery action request");
    const target = requireObject(posted.target, "Recovery action target");
    assert.equal(posted.action, "cancel_reservation");
    assert.equal(target.kind, "delete_reservation");
    assert.equal(target.id, syntheticQueue.items[0].id);
    process.stdout.write("PASS 12 Recovery confirmation payload, keyboard trap, and visible POST failure (intercepted)\n");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    assertApprovedPageLocation(page, authority, "/admin/settings/media", "Mobile Media Settings reload");
    await page.locator("article", { hasText: namespace }).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).direction), "rtl");
    await assertNoHorizontalOverflow(page, "390px Recovery Center");
    process.stdout.write("PASS 12 Recovery Center mobile RTL rendering without horizontal overflow\n");

    queueFailure = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    assertApprovedPageLocation(page, authority, "/admin/settings/media", "Failure-path Media Settings reload");
    await page.getByText("QA injected recovery queue failure", { exact: true }).waitFor({ state: "visible" });
    process.stdout.write("PASS 12 Recovery queue failure remains visible in authenticated settings UI\n");
  } finally {
    await context.unroute(recoveryPattern);
  }
}

async function cleanupFixture(input: {
  supabase: SupabaseClient;
  context: BrowserContext;
  authority: MediaQaAuthority;
  namespace: string;
  topic: TopicFixture | null;
  asset: FixtureAsset | null;
  orphanStorageObjectKey: string | null;
  reservation: ReservationFixture | null;
  deletionProven: boolean;
}) {
  const { supabase, context, authority, namespace } = input;
  let { deletionProven } = input;
  let orphanCleanupProven = !input.orphanStorageObjectKey;
  const errors: string[] = [];

  if (input.topic) {
    const identity = String(input.topic.id);
    try {
      const { error: clearDomainError } = await supabase
        .from("topics")
        .update({ image: "", image_alt: "", updated_at: new Date().toISOString() })
        .eq("id", input.topic.id);
      if (clearDomainError) throw clearDomainError;
      const { error: clearReferencesError } = await supabase.rpc("replace_media_references_for_entity", {
        p_domain_key: "topics",
        p_entity_type: "topic",
        p_entity_identity: identity,
        p_references: [],
        p_lease_token: null,
        p_lease_entity_identity: null,
      });
      if (clearReferencesError) throw clearReferencesError;
    } catch (error) {
      errors.push(`Topic/reference cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.asset && input.reservation?.active) {
    try {
      if (!(await storageObjectExists(supabase, input.asset))) {
        throw new Error("Active reservation cannot be canceled because Storage existence is not proven.");
      }
      await cancelVerifiedExistingReservation(supabase, namespace, input.asset, input.reservation);
    } catch (error) {
      errors.push(`Reservation cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.asset && !deletionProven) {
    try {
      const { data: currentAsset, error: currentAssetError } = await supabase
        .from("media_assets")
        .select("status")
        .eq("id", input.asset.id)
        .maybeSingle();
      if (currentAssetError) throw currentAssetError;
      deletionProven = currentAsset?.status === "deleted"
        && !(await storageObjectExists(supabase, input.asset));
    } catch (proofError) {
      errors.push(`Pre-cleanup deletion proof: ${proofError instanceof Error ? proofError.message : String(proofError)}`);
    }
  }

  if (input.orphanStorageObjectKey) {
    try {
      const segments = input.orphanStorageObjectKey.split("/");
      const filename = segments.pop();
      const parent = segments.join("/");
      assert(filename, "Orphan Storage fixture has no filename.");
      const { error: removeError } = await supabase.storage
        .from(authority.imageBucket)
        .remove([input.orphanStorageObjectKey]);
      if (removeError) throw removeError;
      const { data, error: verifyError } = await supabase.storage
        .from(authority.imageBucket)
        .list(parent, { search: filename, limit: 2 });
      if (verifyError || data?.some((entry) => entry.name === filename)) {
        throw new Error(verifyError?.message ?? "Exact orphan Storage fixture still exists.");
      }
      orphanCleanupProven = true;
    } catch (error) {
      errors.push(`Orphan Storage cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.asset && !deletionProven) {
    try {
      const response = await context.request.delete(
        new URL("/api/admin/media-library", authority.appBaseUrl).toString(),
        {
          data: { asset: input.asset.publicUrl },
          headers: { "x-request-id": `${namespace}:browser-cleanup-safe-delete` },
          failOnStatusCode: false,
          maxRedirects: 0,
        },
      );
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok() || body?.deleted !== true) {
        throw new Error(`Application Safe Delete returned ${response.status()}: ${JSON.stringify(body)}.`);
      }
      deletionProven = true;
    } catch (applicationError) {
      errors.push(`Application cleanup: ${applicationError instanceof Error ? applicationError.message : String(applicationError)}`);
      try {
        const reservation = await reserveDelete(supabase, authority, `${namespace}:cleanup`, input.asset);
        const { error: removeError } = await supabase.storage.from(input.asset.bucket).remove([input.asset.objectKey]);
        if (removeError) throw removeError;
        if (await storageObjectExists(supabase, input.asset)) {
          await cancelVerifiedExistingReservation(supabase, namespace, input.asset, reservation);
          throw new Error("Fallback Storage removal did not remove the exact fixture object; reservation was canceled.");
        }
        const { data, error } = await supabase.rpc("finalize_media_asset_deletion", {
          p_asset_id: input.asset.id,
          p_reservation_id: reservation.id,
          p_storage_state: "missing",
          p_storage_verified_at: new Date().toISOString(),
        });
        if (error || data !== "deleted") throw new Error(`${rpcFailure(error)} ${String(data)}`);
        reservation.active = false;
        deletionProven = true;
      } catch (fallbackError) {
        errors.push(`Reservation fallback cleanup: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
  }

  if (input.topic) {
    try {
      const { error } = await supabase.from("topics").delete().eq("id", input.topic.id);
      if (error) throw error;
      const { error: auditError } = await supabase
        .from("admin_audit_logs")
        .delete()
        .eq("entity_type", "topic")
        .eq("entity_id", input.topic.id);
      if (auditError) throw auditError;
    } catch (error) {
      errors.push(`Disposable Topic cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.asset) {
    // Audit cleanup is exact to the disposable asset identity. The deleted
    // Catalog tombstone is intentionally retained by the application contract.
    const { error: labelAuditError } = await supabase
      .from("admin_audit_logs")
      .delete()
      .eq("entity_type", "media_asset")
      .eq("entity_label", input.asset.displayName);
    const { error: identityAuditError } = await supabase
      .from("admin_audit_logs")
      .delete()
      .eq("entity_type", "media_asset")
      .contains("metadata", { assetId: input.asset.id });
    if (labelAuditError || identityAuditError) {
      errors.push(`Media audit cleanup: ${labelAuditError?.message ?? identityAuditError?.message}.`);
    }
  }

  try {
    if (input.topic && await readTopic(supabase, input.topic.id)) {
      throw new Error("Disposable Topic still exists.");
    }
    if (input.asset) {
      if (await referenceCount(supabase, input.asset.id)) throw new Error("Disposable asset still has persisted references.");
      if (!deletionProven || await storageObjectExists(supabase, input.asset)) {
        throw new Error("Disposable Storage object absence is not proven.");
      }
      const { count: activeReservations, error: reservationError } = await supabase
        .from("media_delete_reservations")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", input.asset.id)
        .in("status", ["reserved", "storage_deleted", "recovery_required"]);
      if (reservationError || activeReservations !== 0) {
        throw new Error(`Unresolved delete reservation remains: ${reservationError?.message ?? activeReservations}.`);
      }
      const { count: unresolvedLeases, error: leaseError } = await supabase
        .from("media_reference_write_leases")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", input.asset.id)
        .in("status", ["active", "failed", "expired"]);
      if (leaseError || unresolvedLeases !== 0) {
        throw new Error(`Unresolved write lease remains: ${leaseError?.message ?? unresolvedLeases}.`);
      }
    }
  } catch (error) {
    errors.push(`Final cleanup proof: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (errors.length) {
    if (input.asset && !deletionProven) {
      process.stderr.write(
        `RECOVERY_REQUIRED fixtureNamespace=${namespace} assetId=${input.asset.id} bucket=${input.asset.bucket} objectKey=${input.asset.objectKey}\n`,
      );
    }
    if (input.orphanStorageObjectKey && !orphanCleanupProven) {
      process.stderr.write(
        `RECOVERY_REQUIRED fixtureNamespace=${namespace} bucket=${authority.imageBucket} objectKey=${input.orphanStorageObjectKey} reason=storage_object_without_catalog_identity\n`,
      );
    }
    throw new Error(`Disposable Browser-QA cleanup was not fully proven:\n- ${errors.join("\n- ")}`);
  }
  process.stdout.write("PASS cleanup removed the disposable Topic, references, Storage object, and unresolved coordination state\n");
}

async function run() {
  const values = parseNamedArguments(process.argv.slice(2));
  if (!values.size) {
    printUsage();
    guardRefusal("No Browser-QA authority or opt-in was supplied; no browser or network call was made.");
  }
  assertOnlyArguments(values, [
    "allow-browser-qa",
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
    optInArgument: "allow-browser-qa",
    expectedOptIn: MEDIA_QA_BROWSER_OPT_IN,
    repositoryRoot: ROOT,
  });
  const authState = assertExternalAuthenticationState(ROOT, requiredArgument(values, "auth-state"));
  const scenario = values.get("scenario")?.trim() || "standard";
  if (scenario !== "standard" && scenario !== "governing") {
    guardRefusal("--scenario must equal standard or governing.");
  }
  const governingOnly = scenario === "governing";
  const serviceRoleEnvironmentName = requiredArgument(values, "service-role-env");
  if (!/^[A-Z][A-Z0-9_]{4,80}$/.test(serviceRoleEnvironmentName)) {
    guardRefusal("--service-role-env must name one explicit uppercase environment variable.");
  }
  const serviceRoleKey = process.env[serviceRoleEnvironmentName]?.trim();
  if (!serviceRoleKey) {
    guardRefusal(`Credential variable ${serviceRoleEnvironmentName} is absent; credentials never imply permission.`);
  }

  const { authority, fixtureNamespace } = guard;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: authState,
    viewport: { width: 1440, height: 900 },
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (
      MUTATING_HTTP_METHODS.has(request.method())
      && new URL(request.url()).origin !== approvedAppOrigin(authority)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
  const scenarioPage = await context.newPage();
  const fixtureFilename = `${fixtureNamespace}-${randomBytes(4).toString("hex")}.png`;
  let supabase: SupabaseClient | null = null;
  let topic: TopicFixture | null = null;
  let asset: FixtureAsset | null = null;
  let orphanStorageObjectKey: string | null = null;
  let reservation: ReservationFixture | null = null;
  let topicSetupAttempted = false;
  let uploadAttempted = false;
  let deletionProven = false;
  let scenarioError: unknown = null;
  let governingWorkflowActive = false;
  const forbiddenGoverningRequests: string[] = [];
  context.on("request", (request) => {
    if (!governingWorkflowActive) return;
    const url = new URL(request.url());
    if (url.origin !== approvedAppOrigin(authority)) return;
    if (url.pathname === "/admin/settings/media") {
      forbiddenGoverningRequests.push(`${request.method()} ${url.pathname}`);
      return;
    }
    if (request.method() !== "POST" || url.pathname !== "/api/admin/media-library") return;
    try {
      if (JSON.parse(request.postData() ?? "null")?.operation === "reconcile") {
        forbiddenGoverningRequests.push("POST /api/admin/media-library operation=reconcile");
      }
    } catch {}
  });

  try {
    // Authentication and connected app context are proven before Supabase is
    // even instantiated, and before any Database/Storage mutation.
    const authProbe = await context.request.get(
      new URL("/api/admin/media-library/recovery", authority.appBaseUrl).toString(),
      { failOnStatusCode: false, maxRedirects: 0 },
    );
    if (authProbe.status() !== 200) {
      guardRefusal(`Existing Admin session/recovery endpoint was not accepted (${authProbe.status()}); auth is never bypassed.`);
    }
    assertQueueContext(await authProbe.json().catch(() => null), authority);

    const readinessProbe = await context.request.get(
      new URL("/api/admin/media-library?view=all&kind=all&page=1&pageSize=10", authority.appBaseUrl).toString(),
      { failOnStatusCode: false, maxRedirects: 0 },
    );
    if (readinessProbe.status() !== 200) {
      guardRefusal(`Media readiness preflight was not accepted (${readinessProbe.status()}).`);
    }
    assertReadyLibraryPayload(
      await readinessProbe.json().catch(() => null),
      authority,
      "Pre-mutation Media Library",
    );

    supabase = createClient(authority.supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await assertCatalogRuntime(supabase, authority);
    await assertNamespaceUnused(supabase, authority, fixtureNamespace);
    process.stdout.write("PASS approved Admin session, exact QA dataset, image bucket, and unused namespace proved before mutation\n");
    governingWorkflowActive = true;

    topicSetupAttempted = true;
    topic = await createDraftTopic(supabase, fixtureNamespace);
    uploadAttempted = true;
    asset = await uploadThroughMediaUi(scenarioPage, authority, fixtureFilename);
    assert.equal(asset.bucket, authority.imageBucket);
    const storageNamespace = storageSafeNamespace(fixtureNamespace);
    assert(asset.objectKey.includes(storageNamespace), "UI upload escaped the disposable Storage-safe object-key namespace.");
    assert(asset.publicUrl.includes(storageNamespace), "UI upload escaped the disposable Storage-safe public-URL namespace.");
    assert(asset.displayName.includes(fixtureNamespace), "UI upload escaped the disposable display-name namespace.");
    assert(await storageObjectExists(supabase, asset), "UI upload is not present in the exact approved Storage bucket.");
    await scenarioPage.locator("article", { hasText: asset.displayName }).waitFor({ state: "visible" });
    const postUploadLibraryProbe = await context.request.get(
      new URL(
        `/api/admin/media-library?view=all&kind=all&page=1&pageSize=10&q=${encodeURIComponent(asset.displayName)}`,
        authority.appBaseUrl,
      ).toString(),
      { failOnStatusCode: false, maxRedirects: 0 },
    );
    assert.equal(postUploadLibraryProbe.status(), 200, "Post-upload Media readiness probe failed.");
    const postUploadLibrary = assertReadyLibraryPayload(
      await postUploadLibraryProbe.json().catch(() => null),
      authority,
      "Post-upload Media Library",
    );
    assert(
      Array.isArray(postUploadLibrary.assets) && postUploadLibrary.assets.some(
        (candidate) => requireObject(candidate, "Post-upload asset").id === asset!.id
          && requireObject(candidate, "Post-upload asset").catalogRegistered === true,
      ),
      "Managed upload did not remain registered and ready in the merged dataset.",
    );
    const postUploadUsageProbe = await context.request.get(
      new URL(`/api/admin/media-usage?asset=${encodeURIComponent(asset.publicUrl)}`, authority.appBaseUrl).toString(),
      { failOnStatusCode: false, maxRedirects: 0 },
    );
    assert.equal(postUploadUsageProbe.status(), 200, "Post-upload Live Usage probe failed.");
    assertUsagePayload(
      await postUploadUsageProbe.json().catch(() => null),
      0,
      authority,
      "Post-upload Live Usage",
    );
    process.stdout.write(`PASS 1 disposable namespaced asset uploaded through Admin UI: ${asset.id} ${asset.objectKey}\n`);

    const topicPath = `/admin/content/topics/${topic.id}`;
    const topicUrl = new URL(topicPath, authority.appBaseUrl).toString();
    const topicNavigation = await scenarioPage.goto(topicUrl, { waitUntil: "domcontentloaded" });
    assert(topicNavigation && topicNavigation.status() < 400);
    assertApprovedPageLocation(scenarioPage, authority, topicPath, "Topic fixture navigation");
    await chooseAssetInTopicPicker(scenarioPage, asset);
    await saveTopicAndWaitForPost(scenarioPage, authority, topicPath);
    await waitUntil("Topic link and synchronized reference", async () => {
      const row = await readTopic(supabase!, topic!.id);
      return row?.image === asset!.publicUrl && await referenceCount(supabase!, asset!.id) === 1 ? row : null;
    });
    process.stdout.write("PASS 2 real adopted Topic picker/save persisted the asset and one synchronized reference\n");

    // The real Media UI submits Safe Delete. The server must reject the used
    // asset; an enabled button is not treated as proof of eligibility.
    const linkedSelection = await openAndSelectAsset(scenarioPage, authority, asset);
    const linkedUsage = assertUsagePayload(
      linkedSelection.usage,
      1,
      authority,
      "Linked Topic Live Usage",
    );
    const linkedHits = linkedUsage.hits;
    assert(Array.isArray(linkedHits), "Linked Topic Live Usage hits are not an array.");
    assert(
      linkedHits.some((candidate: unknown) => {
        const hit = requireObject(candidate, "Linked Topic usage hit");
        return hit.domainKey === "topics" && hit.entityIdentity === String(topic!.id);
      }),
      "Live Usage did not identify the disposable Topic reference.",
    );
    await scenarioPage.getByText(topic.title, { exact: true }).waitFor({ state: "visible" });
    const usedDeleteBody = await clickSafeDeleteAndCapture(scenarioPage, authority, 409);
    assert(
      usedDeleteBody?.code === "media_delete_in_use" || usedDeleteBody?.code === "media_delete_asset_in_use",
      `Used delete returned the wrong failure contract: ${JSON.stringify(usedDeleteBody)}.`,
    );
    assert(await storageObjectExists(supabase, asset));
    assert.equal((await readTopic(supabase, topic.id))?.image, asset.publicUrl);
    process.stdout.write("PASS 3 real Media UI and server reject deletion while the Topic uses the asset\n");

    // Open the stale form while it still contains the asset, then keep this
    // page untouched while a different page explicitly removes the last link.
    const stalePage = governingOnly ? null : await context.newPage();
    if (stalePage) {
      const staleNavigation = await stalePage.goto(topicUrl, { waitUntil: "domcontentloaded" });
      assert(staleNavigation && staleNavigation.status() < 400);
      assertApprovedPageLocation(stalePage, authority, topicPath, "Stale Topic navigation");
      await assertTopicImageValue(stalePage, asset.publicUrl);
      process.stdout.write("PASS 4 stale Topic form opened with the pre-unlink asset value\n");
    }

    const unlinkPage = await context.newPage();
    const unlinkNavigation = await unlinkPage.goto(topicUrl, { waitUntil: "domcontentloaded" });
    assert(unlinkNavigation && unlinkNavigation.status() < 400);
    assertApprovedPageLocation(unlinkPage, authority, topicPath, "Unlink Topic navigation");
    await assertTopicImageValue(unlinkPage, asset.publicUrl);
    await unlinkPage.locator("#content-image-field").getByRole("button", { name: "إزالة", exact: true }).click();
    await assertTopicImageValue(unlinkPage, "");
    const automaticLibraryRefresh = scenarioPage.waitForResponse((response) => (
      response.request().method() === "GET"
        && isApprovedAppRequest(response.url(), authority, "/api/admin/media-library")
    ));
    const automaticUsageRefresh = scenarioPage.waitForResponse((response) => (
      response.request().method() === "GET"
        && isApprovedAppRequest(response.url(), authority, "/api/admin/media-usage")
        && new URL(response.url()).searchParams.get("asset") === asset!.publicUrl
    ));
    await saveTopicAndWaitForPost(unlinkPage, authority, topicPath);
    await waitUntil("Explicit unlink and zero usage", async () => {
      const row = await readTopic(supabase!, topic!.id);
      return row?.image === "" && await referenceCount(supabase!, asset!.id) === 0 ? row : null;
    });
    const [libraryRefreshResponse, usageRefreshResponse] = await Promise.all([
      automaticLibraryRefresh,
      automaticUsageRefresh,
    ]);
    assert.equal(libraryRefreshResponse.status(), 200, "Automatic Media Library refresh failed.");
    assert.equal(usageRefreshResponse.status(), 200, "Automatic Live Usage refresh failed.");
    const refreshedLibrary = assertReadyLibraryPayload(
      await libraryRefreshResponse.json().catch(() => null),
      authority,
      "Post-unlink automatic Media Library refresh",
    );
    const refreshedAsset = Array.isArray(refreshedLibrary.assets)
      ? refreshedLibrary.assets
          .map((candidate) => requireObject(candidate, "Post-unlink refreshed asset"))
          .find((candidate) => candidate.id === asset!.id)
      : null;
    assert(refreshedAsset, "Automatic Media Library refresh lost the selected fixture asset.");
    assert.equal(refreshedAsset.referenceCount, 0, "Persisted References did not become zero in the refreshed dataset.");
    assertUsagePayload(
      await usageRefreshResponse.json().catch(() => null),
      0,
      authority,
      "Post-unlink automatic Live Usage refresh",
    );
    await scenarioPage.getByText("لا توجد استخدامات حالية لهذا الملف.", { exact: true }).waitFor({ state: "visible" });
    const automaticallyEnabledDelete = scenarioPage
      .getByRole("button", { name: /حذف آمن|الحذف الآمن/ })
      .first();
    await waitUntil("Automatic Safe Delete readiness", async () => (
      await automaticallyEnabledDelete.isEnabled() ? true : null
    ));
    process.stdout.write("PASS 8-9 explicit unlink produced Persisted=0 and Live=0, then focus refresh enabled Safe Delete without Settings or reconciliation\n");

    if (!governingOnly) {
      // A direct reservation is the controlled concurrency seam. The stale UI
      // save must be rejected before its unrelated title marker reaches Domain.
      reservation = await reserveDelete(supabase, authority, fixtureNamespace, asset);
      const { data: reservedAsset, error: reservedAssetError } = await supabase
        .from("media_assets")
        .select("status")
        .eq("id", asset.id)
        .single();
      if (reservedAssetError || reservedAsset?.status !== "deleting") {
        throw new Error(`Reserved asset is not deleting: ${reservedAssetError?.message ?? JSON.stringify(reservedAsset)}.`);
      }
      assert(await storageObjectExists(supabase, asset), "Reservation setup unexpectedly changed Storage.");
      process.stdout.write(`PASS 5 direct QA delete reservation started: ${reservation.id}\n`);

      assert(stalePage, "Standard scenario requires the stale Topic page.");
      const staleTitle = `${fixtureNamespace} stale-should-not-commit`;
      await stalePage.bringToFront();
      await stalePage.locator('input[name="title"]').fill(staleTitle);
      const stalePost = await saveTopicAndWaitForPost(stalePage, authority, topicPath);
      assert(stalePost.status() < 500, `Stale form request crashed with ${stalePost.status()}.`);
      await stalePage.locator('[role="alert"]').first().waitFor({ state: "visible" });
      const afterStale = await readTopic(supabase, topic.id);
      assert(afterStale, "Topic disappeared during stale save.");
      assert.equal(afterStale.title, topic.title, "Stale title reached Domain despite the delete reservation.");
      assert.equal(afterStale.image, "", "Stale asset reached Domain despite the delete reservation.");
      assert.equal(await referenceCount(supabase, asset.id), 0, "Stale save recreated a persisted reference.");
      const { data: stillReserved } = await supabase
        .from("media_delete_reservations")
        .select("status")
        .eq("id", reservation.id)
        .single();
      assert.equal(stillReserved?.status, "reserved", "Stale save silently canceled or completed the reservation.");
      process.stdout.write("PASS 6-7 stale picker/form save failed before Domain commit and left the reservation intact\n");

      await cancelVerifiedExistingReservation(supabase, fixtureNamespace, asset, reservation);
      const { data: reactivated } = await supabase
        .from("media_assets")
        .select("status")
        .eq("id", asset.id)
        .single();
      assert.equal(reactivated?.status, "active");
      assert(await storageObjectExists(supabase, asset));
      process.stdout.write("PASS reservation cancellation used exact Storage-exists proof and restored active state\n");

      const reactivatedLibraryRefresh = scenarioPage.waitForResponse((response) => (
        response.request().method() === "GET"
          && isApprovedAppRequest(response.url(), authority, "/api/admin/media-library")
      ));
      await scenarioPage.bringToFront();
      const reactivatedResponse = await reactivatedLibraryRefresh;
      assert.equal(reactivatedResponse.status(), 200, "Post-reservation Media Library refresh failed.");
      assertReadyLibraryPayload(
        await reactivatedResponse.json().catch(() => null),
        authority,
        "Post-reservation automatic Media Library refresh",
      );
      const finalDeleteButton = scenarioPage
        .getByRole("button", { name: /حذف آمن|الحذف الآمن/ })
        .first();
      await waitUntil("Reactivated Safe Delete readiness", async () => (
        await finalDeleteButton.isEnabled() ? true : null
      ));
    }

    await assertFixtureDeleteProof(supabase, authority, fixtureNamespace, asset);
    process.stdout.write("PASS same-run upload, exact Catalog/Storage identity, namespaced path, and zero external references proved before delete\n");
    const deleteBody = await clickSafeDeleteAndCapture(scenarioPage, authority, 200);
    assert.equal(deleteBody?.deleted, true, `Final Safe Delete did not report success: ${JSON.stringify(deleteBody)}.`);
    await waitUntil("Final Safe Delete Catalog/Storage state", async () => {
      const { data, error } = await supabase!
        .from("media_assets")
        .select("status,missing_object")
        .eq("id", asset!.id)
        .single();
      if (error || data?.status !== "deleted" || data.missing_object !== false) return null;
      return await storageObjectExists(supabase!, asset!) ? null : data;
    });
    deletionProven = true;
    governingWorkflowActive = false;
    assert.deepEqual(
      forbiddenGoverningRequests,
      [],
      `Governing workflow used Settings or reconciliation: ${forbiddenGoverningRequests.join(", ")}`,
    );
    process.stdout.write("PASS 10 final application Safe Delete completed through Admin UI and Storage absence is proven\n");

    // Reopen both consumers instead of trusting in-memory UI state.
    await unlinkPage.reload({ waitUntil: "domcontentloaded" });
    assertApprovedPageLocation(unlinkPage, authority, topicPath, "Reopened Topic navigation");
    await assertTopicImageValue(unlinkPage, "");
    await scenarioPage.goto(new URL("/admin/media-library", authority.appBaseUrl).toString(), { waitUntil: "domcontentloaded" });
    assertApprovedPageLocation(scenarioPage, authority, "/admin/media-library", "Reopened Media Library navigation");
    const library = scenarioPage.locator('[data-media-library-mode="manage"]');
    await library.waitFor({ state: "visible" });
    await library.locator('input[type="search"]').fill(asset.displayName);
    await waitUntil("Deleted asset absent from reopened Media Library", async () => (
      await library.locator("article", { hasText: asset!.displayName }).count() === 0 ? true : null
    ));
    assert.equal((await readTopic(supabase, topic.id))?.image, "");
    assert.equal(await referenceCount(supabase, asset.id), 0);
    process.stdout.write("PASS 11 reopened Topic and Media Library retain the unlinked/deleted state\n");

    // The real endpoint was already authenticated and context-proven before
    // setup. Only the following Recovery UI action/failure fixture is mocked.
    if (!governingOnly) {
      await runRecoveryUiChecks(context, scenarioPage, authority, fixtureNamespace);
    }

    await stalePage?.close();
    await unlinkPage.close();
  } catch (error) {
    scenarioError = error;
  }
  governingWorkflowActive = false;

  if (supabase) {
    if (topicSetupAttempted && !topic) {
      try {
        topic = await discoverAmbiguousTopic(supabase, fixtureNamespace);
      } catch (error) {
        process.stderr.write(`RECOVERY_REQUIRED fixtureNamespace=${fixtureNamespace} reason=topic_setup_discovery_failed\n`);
        scenarioError = new Error(`${scenarioError ? `${String(scenarioError)}\n` : ""}${String(error)}`);
      }
    }
    if (uploadAttempted && !asset) {
      try {
        const discovered = await discoverAmbiguousUpload(supabase, authority, fixtureFilename);
        asset = discovered.asset;
        orphanStorageObjectKey = discovered.orphanStorageObjectKey;
      } catch (error) {
        process.stderr.write(`RECOVERY_REQUIRED fixtureNamespace=${fixtureNamespace} bucket=${authority.imageBucket} reason=upload_discovery_failed\n`);
        scenarioError = new Error(`${scenarioError ? `${String(scenarioError)}\n` : ""}${String(error)}`);
      }
    }
    try {
      await cleanupFixture({
        supabase,
        context,
        authority,
        namespace: fixtureNamespace,
        topic,
        asset,
        orphanStorageObjectKey,
        reservation,
        deletionProven,
      });
    } catch (cleanupError) {
      scenarioError = scenarioError
        ? new Error(`${scenarioError instanceof Error ? scenarioError.stack ?? scenarioError.message : String(scenarioError)}\n${cleanupError instanceof Error ? cleanupError.stack ?? cleanupError.message : String(cleanupError)}`)
        : cleanupError;
    }
  }

  await context.close();
  await browser.close();
  if (scenarioError) throw scenarioError;
  process.stdout.write("Media coordination Browser QA passed; all disposable mutations were cleaned and proven.\n");
}

run().catch((error) => {
  process.stderr.write(`MEDIA_RECOVERY_BROWSER_QA_FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
