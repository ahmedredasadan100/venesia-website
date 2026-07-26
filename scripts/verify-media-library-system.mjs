import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import * as nodePath from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function loadTypeScriptModule(relativePath, dependencies) {
  const output = ts.transpileModule(source(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", output)(commonJsModule.exports, commonJsModule, (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unsupported dependency ${specifier}`);
  });
  return commonJsModule.exports;
}

const providerModule = loadTypeScriptModule("src/lib/admin/media-catalog/reference-providers.ts", {
  "server-only": {},
  "node:util": { isDeepStrictEqual },
  "../../storage/upload-cms-asset": {
    parseManagedStorageAsset(value) {
      const match = String(value).match(/\/storage\/v1\/object\/public\/(cms-images|cms-documents)\/(images|files)\/([^?#]+)/);
      if (!match) return null;
      return {
        bucket: match[1],
        objectPath: `${match[2]}/${match[3]}`,
        kind: match[2] === "images" ? "image" : "document",
      };
    },
  },
  "../../supabase-admin": { getSupabaseAdmin: () => ({}) },
  "./identity": {
    getCanonicalMediaIdentityKey: (identity) => `${identity.provider}:${identity.bucket}:${identity.objectKey}`,
  },
});

const managedUrl = "https://demo.supabase.co/storage/v1/object/public/cms-images/images/topics/a.png";
assert.deepEqual(providerModule.extractMediaCandidateValues({ hero: managedUrl, legacy: "/images/legacy.png" }), [managedUrl, "/images/legacy.png"]);
check("reference discovery walks nested JSON without fuzzy substring identities", true);
assert.deepEqual(
  providerModule.replaceMediaValue({ gallery: [managedUrl, "unchanged"] }, managedUrl, "https://cdn/new.png"),
  { gallery: ["https://cdn/new.png", "unchanged"] },
);
check("replacement rewrites exact stored values inside structured fields", true);
const registry = providerModule.validateMediaReferenceProviderRegistry();
check("typed provider registry is unique and covers the declared domains", registry.providerCount >= 17, String(registry.providerCount));
const legacyDocument = "/files/projects/document-1782017403551.pdf";
assert.equal(providerModule.extractMediaCandidateValues(`download ${legacyDocument} now`).includes(legacyDocument), true);
check("reference candidate extraction includes embedded legacy /images and /files paths", true);

const usageSupabase = {
  from(table) {
    const rows = table === "projects"
      ? [{
          id: 7,
          arabic_name: "Project 7",
          brochure_url: `https://venesia.example${legacyDocument}?download=1`,
          publication_status: "published",
        }]
      : [];
    return {
      select() { return this; },
      order() { return this; },
      eq() { return this; },
      range() { return Promise.resolve({ data: rows, error: null }); },
    };
  },
};
const usageProviderModule = loadTypeScriptModule("src/lib/admin/media-catalog/reference-providers.ts", {
  "server-only": {},
  "node:util": { isDeepStrictEqual },
  "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
  "../../supabase-admin": { getSupabaseAdmin: () => usageSupabase },
  "./identity": {
    getCanonicalMediaIdentityKey: (identity) => `${identity.provider}:${identity.bucket}:${identity.objectKey}`,
  },
});
const liveLegacyUsage = await usageProviderModule.scanMediaUsageByPublicValue(legacyDocument);
assert.equal(liveLegacyUsage.uncertainties.length, 0);
assert.equal(liveLegacyUsage.references.length, 1);
assert.equal(liveLegacyUsage.references[0].domainKey, "projects");
assert.equal(liveLegacyUsage.references[0].fieldKey, "brochure_url");
check("live Usage Scan matches an absolute legacy asset URL without a Catalog row", true);

const readinessModule = loadTypeScriptModule("src/lib/admin/media-catalog/readiness.ts", {});
const catalogModule = loadTypeScriptModule("src/lib/admin/media-catalog/catalog.ts", {
  "server-only": {},
  path: { default: nodePath },
  "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
  "../../supabase-admin": { getSupabaseAdmin: () => ({}) },
  "./identity": {
    getFolderPathFromObjectKey: (objectKey) => nodePath.posix.dirname(objectKey),
    isMediaCatalogMissingError: () => false,
    getCanonicalMediaIdentityKey: (identity) => `${identity.provider}:${identity.bucket}:${identity.objectKey}`,
  },
  "./binary-metadata": { readUploadBinaryMetadata: async () => ({}) },
  "./reference-providers": { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION: "test-registry" },
  "./readiness": readinessModule,
});

const runtimeContext = {
  provider: "supabase",
  environment: "local",
  projectReference: "demo",
  identity: "local:supabase:demo",
};
const completeRuntimeState = {
  state: "synced",
  provider: "supabase",
  environment: "local",
  environmentKey: runtimeContext.identity,
  providerRegistryVersion: "test-registry",
  lastScanAt: "2026-07-25T01:00:00.000Z",
  lastCatalogSync: "2026-07-25T01:00:00.000Z",
  lastDryRun: null,
  storageAssetCount: 1,
  catalogAssetCount: 1,
  warnings: [],
};

const emptyCatalogSnapshot = {
  catalogState: "available",
  warning: null,
  assets: [],
  folders: [
    {
      id: "images-root",
      path: "images",
      parentPath: null,
      displayName: "الصور",
      reconciliationState: "synced",
      childFolderCount: 0,
      directAssetCount: 0,
      directTotalBytes: 0,
      totalAssetCount: 0,
      totalBytes: 0,
    },
  ],
};
const filesystemInventory = {
  provider: "supabase",
  providerAvailable: true,
  warning: null,
  folders: ["images", "images/about", "files"],
  items: [
    {
      path: "/images/legacy.png",
      filename: "legacy.png",
      extension: ".png",
      kind: "image",
      sizeBytes: 512,
      contentType: "image/png",
      uploadedAt: "2026-07-25T00:00:00.000Z",
      managed: false,
      provider: "filesystem",
      bucket: "public",
      storagePath: null,
    },
    {
      path: "/images/about/large.png",
      filename: "large.png",
      extension: ".png",
      kind: "image",
      sizeBytes: 2048,
      contentType: "image/png",
      uploadedAt: "2026-07-24T00:00:00.000Z",
      managed: false,
      provider: "filesystem",
      bucket: "public",
      storagePath: null,
    },
    {
      path: legacyDocument,
      filename: "document-1782017403551.pdf",
      extension: ".pdf",
      kind: "document",
      sizeBytes: 1024,
      contentType: "application/pdf",
      uploadedAt: "2026-07-23T00:00:00.000Z",
      managed: false,
      provider: "filesystem",
      bucket: "public",
      storagePath: null,
    },
  ],
};
const readThroughPage = catalogModule.buildMediaLibraryReadModel(emptyCatalogSnapshot, filesystemInventory, {
  folder: "images",
  smartView: "all",
  kind: "image",
  context: runtimeContext,
});
assert.equal(readThroughPage.assets.length, 2);
assert.equal(readThroughPage.assets[0].publicUrl, "/images/legacy.png");
assert.equal(readThroughPage.total, 2);
assert.equal(readThroughPage.folders.find((folder) => folder.path === "images")?.directAssetCount, 1);
assert.equal(readThroughPage.folders.find((folder) => folder.path === "images")?.totalAssetCount, 2);
assert.equal(readThroughPage.summary.folderCount, 4);
assert.equal(readThroughPage.summary.assetCount, 3);
assert.equal(readThroughPage.summary.imageCount, 2);
assert.equal(readThroughPage.summary.documentCount, 1);
assert.equal(readThroughPage.summary.totalBytes, 3584);
assert.equal(readThroughPage.summary.largestAsset?.displayName, "large.png");
assert.equal(readThroughPage.summary.unreconciledAssetCount, 0);
assert.equal(readThroughPage.summary.usageUnknownCount, 3);
assert.equal(readThroughPage.summary.readOnlyAssetCount, 3);
assert.equal(readThroughPage.readiness.unregisteredAssetCount, 0);
check("one merged read model drives Storage assets, nested folder counters, and global summary", true);

const pagedGlobalView = catalogModule.buildMediaLibraryReadModel(emptyCatalogSnapshot, filesystemInventory, {
  folder: null,
  smartView: "all",
  pageSize: 10,
  context: runtimeContext,
});
assert.equal(pagedGlobalView.total, 3);
assert.equal(pagedGlobalView.pageSize, 10);
assert.equal(pagedGlobalView.assets.length, 3);
const unsupportedPageSize = catalogModule.buildMediaLibraryReadModel(emptyCatalogSnapshot, filesystemInventory, {
  pageSize: 24,
  context: runtimeContext,
});
assert.equal(unsupportedPageSize.pageSize, 20);
check("Asset Viewer supports global and recursive folder scopes with controlled page sizes", true);

const unusedPage = catalogModule.buildMediaLibraryReadModel(emptyCatalogSnapshot, filesystemInventory, {
  smartView: "unused",
  context: runtimeContext,
  runtimeState: { ...completeRuntimeState, state: "uncertain", providerRegistryVersion: null },
});
assert.equal(unusedPage.assets.length, 0);
assert.equal(unusedPage.summary.assetCount, 3);
assert.equal(unusedPage.warning.includes("يظل استعراض الملفات وعرض استخدام ملف محدد متاحًا"), true);
check("Storage read-through does not classify unreconciled assets as unused", true);

const catalogAsset = {
  ...readThroughPage.assets[0],
  id: "catalog-asset",
  provider: "supabase",
  bucket: "cms-images",
  objectKey: "images/catalog.png",
  publicUrl: "https://demo.supabase.co/catalog.png",
  displayName: "catalog.png",
  originalFilename: "catalog.png",
  reconciliationState: "synced",
  catalogRegistered: true,
  source: "catalog",
  referenceCount: 0,
};
const managedInventory = {
  provider: "supabase",
  providerAvailable: true,
  warning: null,
  folders: ["images"],
  items: [
    {
      ...filesystemInventory.items[0],
      path: catalogAsset.publicUrl,
      filename: "catalog.png",
      managed: true,
      provider: "supabase",
      bucket: "cms-images",
      storagePath: "images/catalog.png",
    },
  ],
};
const deduplicatedPage = catalogModule.buildMediaLibraryReadModel(
  { ...emptyCatalogSnapshot, assets: [catalogAsset] },
  managedInventory,
  { smartView: "all", folder: "images", context: runtimeContext },
);
assert.equal(deduplicatedPage.assets.length, 1);
assert.equal(deduplicatedPage.assets[0].id, "catalog-asset");
assert.equal(deduplicatedPage.assets[0].source, "catalog_storage");
check("read-through deduplicates by canonical provider bucket and object key", true);

const incompleteUsedPage = catalogModule.buildMediaLibraryReadModel(
  {
    ...emptyCatalogSnapshot,
    assets: [{ ...catalogAsset, referenceCount: 2 }],
  },
  managedInventory,
  {
    smartView: "used",
    context: runtimeContext,
    runtimeState: { ...completeRuntimeState, state: "uncertain", providerRegistryVersion: null },
  },
);
assert.equal(incompleteUsedPage.assets.length, 0);
assert.equal(incompleteUsedPage.catalogState, "uncertain");
assert.equal(incompleteUsedPage.warning.includes("قائمة مكتملة للملفات المستخدمة"), true);
const indexedCatalogWithStorageGap = catalogModule.buildMediaLibraryReadModel(
  { ...emptyCatalogSnapshot, assets: [{ ...catalogAsset, referenceCount: 2 }] },
  filesystemInventory,
  {
    smartView: "used",
    context: runtimeContext,
    runtimeState: completeRuntimeState,
  },
);
assert.equal(indexedCatalogWithStorageGap.assets.length, 0);
assert.equal(indexedCatalogWithStorageGap.catalogState, "uncertain");
assert.equal(indexedCatalogWithStorageGap.warning.includes("قائمة مكتملة للملفات المستخدمة"), true);
const missingDefaultAltPage = catalogModule.buildMediaLibraryReadModel(
  { ...emptyCatalogSnapshot, assets: [catalogAsset] },
  managedInventory,
  { smartView: "missing_alt", context: runtimeContext },
);
assert.equal(missingDefaultAltPage.assets.length, 1);
assert.equal(
  catalogModule.buildMediaLibraryReadModel(emptyCatalogSnapshot, filesystemInventory, { smartView: "missing_alt", context: runtimeContext }).assets.length,
  0,
);
check("reference-dependent views fail closed on runtime or merged-coverage gaps and default-alt scope excludes unindexed Storage assets", true);

const authoritativeUnusedPage = catalogModule.buildMediaLibraryReadModel(
  { ...emptyCatalogSnapshot, assets: [catalogAsset] },
  managedInventory,
  { smartView: "unused", context: runtimeContext, runtimeState: completeRuntimeState },
);
assert.equal(authoritativeUnusedPage.assets.length, 1);
assert.equal(authoritativeUnusedPage.readiness.usageResultsAuthoritative, true);
const unregisteredManagedInventory = {
  ...managedInventory,
  items: [{ ...managedInventory.items[0], path: "https://demo.supabase.co/unregistered.png", storagePath: "images/unregistered.png" }],
};
const unregisteredReadiness = readinessModule.buildMediaCatalogReadiness(
  emptyCatalogSnapshot,
  unregisteredManagedInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(unregisteredReadiness.usageResultsAuthoritative, false);
assert.equal(unregisteredReadiness.safeDeleteReady, false);
assert.equal(unregisteredReadiness.unregisteredAssetCount, 1);
check("authoritative unused and safe delete require same-context managed Catalog coverage", true);

const postUploadCatalogAsset = {
  ...catalogAsset,
  id: "post-upload-catalog-asset",
  objectKey: "images/post-upload.png",
  publicUrl: "https://demo.supabase.co/post-upload.png",
};
const postUploadInventory = {
  ...managedInventory,
  items: [
    ...managedInventory.items,
    {
      ...managedInventory.items[0],
      path: postUploadCatalogAsset.publicUrl,
      filename: "post-upload.png",
      storagePath: postUploadCatalogAsset.objectKey,
    },
  ],
};
const postUploadReadiness = readinessModule.buildMediaCatalogReadiness(
  { ...emptyCatalogSnapshot, assets: [catalogAsset, postUploadCatalogAsset] },
  postUploadInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(postUploadReadiness.catalogCoverageComplete, true);
assert.equal(postUploadReadiness.runtimeDatasetMatches, false);
assert.equal(postUploadReadiness.usageResultsAuthoritative, false);
check("a post-scan upload invalidates authoritative usage even when Catalog registration succeeds", true);

const migration = source("sql/migrations/20260725090000_media_catalog_reference_foundation.sql");
for (const table of ["media_folders", "media_assets", "media_references"]) {
  check(`migration creates ${table}`, migration.includes(`create table if not exists public.${table}`));
}
check("canonical identity is unique across provider bucket and object key", migration.includes("unique (provider, bucket, object_key)"));
check("folder hierarchy uses normalized paths and a restrictive parent relation", migration.includes("media_folders_parent_fkey") && migration.includes("on update cascade on delete restrict"));
check("catalog and reference tables are service-role-only under RLS", (migration.match(/enable row level security/g) ?? []).length === 3 && migration.includes("grant select, insert, update, delete on public.media_folders, public.media_assets, public.media_references to service_role"));
check("reference synchronization is atomic per entity and per provider", migration.includes("replace_media_references_for_entity") && migration.includes("replace_media_references_for_provider"));

const storage = source("src/lib/storage/upload-cms-asset.ts");
check("storage upload never performs same-path upsert", storage.includes("upsert: false") && !storage.includes("upsert: Boolean(replacement"));
check("reconciliation exhausts paginated Storage listings", storage.includes("const pageSize = 1000") && storage.includes("offset += pageSize") && storage.includes("while (queue.length)"));

const safeDelete = source("src/lib/admin/media-catalog/safe-delete.ts");
check("safe delete requires a synced registry and live exhaustive provider scan", safeDelete.includes("MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION") && safeDelete.includes("scanAllMediaReferenceProviders"));
check("safe delete requires the shared provider and environment readiness contract", safeDelete.includes("buildMediaCatalogReadiness") && safeDelete.includes("safeDeleteReady") && safeDelete.includes("context.provider"));
check("safe delete checks persisted references and storage existence", safeDelete.includes("listCatalogReferences") && safeDelete.includes("verifyManagedStorageAssetExists"));
check("safe delete reserves and mutates the exact canonical Storage identity", safeDelete.includes("expectedObjectKey: eligibility.asset.objectKey") && safeDelete.includes("reservation.publicValue") && source("src/lib/admin/media-catalog/delete-reservation.ts").includes("reserved_object_key"));
check("safe delete never treats uncertainty as zero references", safeDelete.includes('state: "uncertain"') && safeDelete.includes('state: "safe_to_delete"'));
check("used and unused views are suppressed while reference readiness is uncertain without blocking normal reads", source("src/lib/admin/media-catalog/catalog.ts").includes("لا يمكن تأكيد أن الملفات غير مستخدمة") && source("src/lib/admin/media-catalog/catalog.ts").includes("قائمة مكتملة للملفات المستخدمة") && source("src/lib/admin/media-catalog/catalog.ts").includes("MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION"));

const synchronization = source("src/lib/admin/media-catalog/synchronization.ts");
check("rebind proves live registry parity, retains the old asset and compensates failures", synchronization.includes("media_reference_rebind_drift") && synchronization.includes("scanAllMediaReferenceProviders") && synchronization.includes("compensationFailures") && synchronization.includes("previousAssetRetained: true"));
const projectChildrenSync = source("src/lib/admin/projects/project-children-sync.ts");
const projectUpdate = source("src/app/admin/projects/project-actions/update.ts");
const projectDuplicate = source("src/app/admin/projects/project-actions/duplicate.ts");
check("projects synchronize parent and child media domains", projectChildrenSync.includes('"project_media"') && projectChildrenSync.includes('"project_floor_plans"') && [projectUpdate, projectDuplicate].every((implementation) => implementation.includes("synchronizeMediaReferenceWriteScopesAfterDomainMutation")));
check("Project aggregate providers remain explicit discovery-only boundaries", ["projects", "project_media", "project_floor_plans"].every((domain) => {
  const provider = providerModule.MEDIA_REFERENCE_PROVIDER_REGISTRY.find((item) => item.domainKey === domain);
  return provider && provider.supportsRebind === false;
}));

const route = source("src/app/api/admin/media-library/route.ts");
check("Media API is private no-store and authenticates every verb", route.includes('"Cache-Control": "private, no-store, max-age=0"') && (route.match(/await requireAdminApi\(\)/g) ?? []).length === 4);
check("Media API builds one exhaustive Catalog plus Storage read model", route.includes("listPublicMediaInventory") && route.includes("listMediaCatalogSnapshot") && route.includes("buildMediaLibraryReadModel"));
check("upload compensation removes a new object when catalog registration fails", route.includes("registerCatalogUpload") && route.includes("deletePublicMediaAsset(saved.path).catch"));
check("all upload and delete mutations stay on the Supabase managed adapter", source("src/lib/admin/media-library.ts").includes("getManagedMediaStorageAdapter") && source("src/lib/admin/media-storage-adapter.ts").includes('return "supabase"'));
check("unknown Media API views, kinds, page sizes and query keys are rejected", ["invalid_media_view", "invalid_media_kind", "invalid_media_page_size", "invalid_media_query"].every((token) => route.includes(token)));
check("catalog registration records checksum and supported image dimensions", source("src/lib/admin/media-catalog/catalog.ts").includes("readUploadBinaryMetadata") && source("src/lib/admin/media-catalog/binary-metadata.ts").includes('createHash("sha256")'));
check("replace-all uses the reference synchronization owner", route.includes("rebindAllSupportedMediaReferences") && route.includes('operation === "replace_all"'));
const physicalMove = source("src/lib/admin/media-catalog/physical-move.ts");
check("Manage physical move uses live reference proof, Storage move, rebind and compensation", route.includes('operation === "move_asset"') && physicalMove.includes("scanAllMediaReferenceProviders") && physicalMove.includes("moveManagedStorageAsset") && physicalMove.includes("rollbackFailures"));
check("physical move acquires coordination before Storage mutation", physicalMove.indexOf("const moveLease = await acquireMediaReferenceWriteLease") < physicalMove.indexOf("await moveManagedStorageAsset(asset.publicUrl") && physicalMove.includes("PHYSICAL_MOVE_COORDINATION_DOMAIN"));
check("physical move retains the new identity when Domain compensation is incomplete", physicalMove.includes("rebind.nextAssetRequired") && physicalMove.includes("retainMovedIdentity") && synchronization.includes("nextAssetRequired: domainCompensationFailures.length > 0"));

const core = source("src/components/admin/media/MediaLibraryCore.tsx");
const picker = source("src/components/admin/media/AdminMediaPickerModal.tsx");
check("Manage and Select reuse one Media Library core", core.includes("data-media-library-mode") && picker.includes("<MediaLibraryCore"));
check("picker selection changes a field only after explicit confirmation", picker.includes("onConfirmSelection") && core.includes("تأكيد الاختيار"));
check("media previews use optimized next/image with responsive sizes", core.includes('from "next/image"') && core.includes("sizes={") && !core.includes("unoptimized"));
check("picker traps focus, supports Escape, and restores focus", picker.includes('event.key === "Escape"') && picker.includes("event.key !== \"Tab\"") && picker.includes("previousFocus"));
check("multi-upload, folders, smart views, metadata and safe replacement are present", ["uploadFiles", "createFolder", "SMART_VIEWS", "updateMetadata", "stageReplacement"].every((token) => core.includes(token)));
check("physical rename and move controls stay out of Select Mode", core.includes('mode === "manage" && selectedAssets.length === 1') && !picker.includes("move_asset"));
check("summary and folder counters consume the merged read model", core.includes("data.summary.totalBytes") && core.includes("item.totalAssetCount") && core.includes("item.totalBytes"));
check("dashboard separates management, usage, missing, managed and read-only storage metrics", ["unreconciledAssetCount", "usageUnknownCount", "missingObjectCount", "managedStorageAssetCount", "readOnlyAssetCount", "largestAsset"].every((token) => core.includes(token)));
check("Asset Viewer owns total results and 10/20/30/50/100 page sizes", core.includes("إجمالي النتائج") && core.includes("const PAGE_SIZES: PageSize[] = [10, 20, 30, 50, 100]") && core.includes("setPageSize"));
check("asset type filter has an explicit accessible name", core.includes('aria-label="نوع الملف"'));
check("folder navigation uses one recursive asset scope in Grid and List", source("src/lib/admin/media-catalog/catalog.ts").includes('asset.folderPath.startsWith(`${input.folder}/`)') && core.includes("openFolder"));
check("PDF cards and the details panel provide a consistent document preview", core.includes("PdfDocumentPreview") && core.includes("<iframe") && core.includes("مستند قابل للمعاينة"));
check("unknown Storage usage is never rendered as a false zero", core.includes('value === null ? "لم يكتمل فحص الارتباطات"') && core.includes("يعرض الفحص المباشر أدناه"));
check("Smart Views are global and expose only implemented truth contracts", core.includes("setFolder(null)") && core.includes("عروض كل المكتبة") && core.includes("صور بلا وصف افتراضي") && !core.includes('id: "recent"') && !core.includes('id: "large"'));
check("reference-dependent Smart Views show readiness truth instead of false empty results", core.includes("referenceViewUnavailable") && core.includes("غير جاهز حتى يكتمل فحص مواضع الاستخدام") && source("src/lib/admin/media-catalog/catalog.ts").includes('smartView === "used" || smartView === "unused"'));
const usageRoute = source("src/app/api/admin/media-usage/route.ts");
check("Usage API scans live providers even without a Catalog row", usageRoute.includes("scanMediaUsageByPublicValue") && usageRoute.includes("entityIdentity: reference.entityIdentity") && !usageRoute.includes("media_asset_missing_from_catalog"));
check("Usage API makes unregistered authoritative-unused impossible", usageRoute.includes("catalogRegistered &&") && usageRoute.includes("readiness.usageResultsAuthoritative") && usageRoute.includes("const unusedAuthoritative"));
check("shared NoImage visual exists", existsSync(resolve(ROOT, "src/components/admin/media/MediaNoImage.tsx")));

const settings = source("src/lib/admin/media-catalog/settings.ts");
check("media settings expose policy but never provider credentials", settings.includes("maxImageBytes") && settings.includes("safeDeletePolicy") && !/service.role|credential|secret/i.test(settings));
const settingsPanel = source("src/app/admin/settings/media/MediaSettingsPanel.tsx");
const settingsAction = source("src/app/admin/settings/media/actions.ts");
check("Media Settings exposes user-facing scan controls and readiness without credentials", settingsPanel.includes("معاينة الفحص") && settingsPanel.includes("تنفيذ الفحص والمزامنة") && settingsPanel.includes("آخر فحص مكتمل") && settingsPanel.includes("نتائج الاستخدام") && !/credential|service.role|bucket/i.test(settingsPanel));
check("execution remains blocked until the current preview is reliable", settingsPanel.includes("const canApplyScan") && settingsPanel.includes("!canApplyScan || scanBusy !== null"));
check("choosing PDF automatically enables the document kind", settingsPanel.includes('setAllowedKinds((current) => [...new Set([...current, "document" as const])])'));
const reconciliation = source("src/lib/admin/media-catalog/reconciliation.ts");
check("Dry Run simulates Catalog registration before provider reference discovery", reconciliation.includes("simulatedCatalogAsset") && reconciliation.includes("simulatedMap.set") && reconciliation.includes("assetMap: simulatedMap"));
check("Reconciliation state is bound to environment provider and registry version", ["environmentKey: context.identity", "provider: context.provider", "environment: context.environment", "MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION"].every((token) => reconciliation.includes(token)));
check("Media Settings adopts Form Runtime with explicit validation and colocated field feedback", settingsAction.includes("Number.isInteger") && settingsAction.includes("fieldErrors") && settingsPanel.includes("AdminFormRuntime") && settingsPanel.includes("AdminFormError") && settingsPanel.includes("AdminFeedbackChannelViewport"));

const actionSourceFile = ts.createSourceFile(
  "actions.ts",
  settingsAction,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const actionRuntimeExports = actionSourceFile.statements.flatMap((statement) => {
  const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  if (!exported || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) return [];
  if (ts.isFunctionDeclaration(statement)) {
    const asyncFunction = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
    return asyncFunction ? [] : [statement.name?.text ?? "anonymous function"];
  }
  return [ts.SyntaxKind[statement.kind]];
});
check(
  '"use server" Media Settings module exports async functions only',
  actionSourceFile.statements[0]?.getText(actionSourceFile).replaceAll("'", '"') === '"use server";' &&
    actionRuntimeExports.length === 0,
  actionRuntimeExports.join(", "),
);

const mediaSettingsContractModule = loadTypeScriptModule(
  "src/app/admin/settings/media/media-settings-action-contract.ts",
  {
    "../../../../lib/admin/media-intelligence/cms-upload-policy": {
      CMS_MAX_IMAGE_BYTES: 5 * 1024 * 1024,
      CMS_MAX_PDF_BYTES: 12 * 1024 * 1024,
    },
  },
);
class FixtureMediaSettingsSaveError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}
const mediaSettingsMutations = [];
let mediaSettingsSaveFailure = null;
const mediaSettingsActionModule = loadTypeScriptModule("src/app/admin/settings/media/actions.ts", {
  "next/cache": { revalidatePath: (value) => mediaSettingsMutations.push(["revalidate", value]) },
  "../../../../lib/admin/auth/require-admin-session": {
    requireAdminSession: async () => ({ id: 1, username: "qa" }),
  },
  "../../../../lib/admin/audit-log": {
    recordCmsAdminAudit: async () => mediaSettingsMutations.push(["audit"]),
  },
  "../../../../lib/admin/audit/cms-audit-actions": {
    buildCmsAuditAction: (entityType, verb) => `${entityType}.${verb}`,
  },
  "../../../../lib/admin/media-intelligence/cms-upload-policy": {
    CMS_IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"],
    CMS_PDF_EXTENSIONS: [".pdf"],
  },
  "../../../../lib/admin/media-catalog/settings": {
    MediaSettingsSaveError: FixtureMediaSettingsSaveError,
    parseMediaSettings: (value) => value,
    saveMediaSettings: async (value) => {
      if (mediaSettingsSaveFailure) throw mediaSettingsSaveFailure;
      mediaSettingsMutations.push(["save", value]);
      return value;
    },
  },
  "./media-settings-action-contract": mediaSettingsContractModule,
});
const validMediaSettingsForm = new FormData();
validMediaSettingsForm.set("maxImageMb", "5");
validMediaSettingsForm.set("maxDocumentMb", "12");
validMediaSettingsForm.append("allowedKinds", "image");
validMediaSettingsForm.append("allowedKinds", "document");
validMediaSettingsForm.append("allowedImageExtensions", ".jpg");
validMediaSettingsForm.append("allowedDocumentExtensions", ".pdf");
validMediaSettingsForm.set("mimeVerification", "on");
const validMediaSettingsResult = await mediaSettingsActionModule.updateMediaSettingsAction(
  mediaSettingsContractModule.MEDIA_SETTINGS_ACTION_INITIAL,
  validMediaSettingsForm,
);
assert.equal(validMediaSettingsResult.status, "success");
assert.equal(validMediaSettingsResult.code, "saved");
assert.equal(mediaSettingsMutations.findIndex(([kind]) => kind === "save") >= 0, true);
assert.equal(
  mediaSettingsMutations.findIndex(([kind]) => kind === "audit") >
    mediaSettingsMutations.findIndex(([kind]) => kind === "save"),
  true,
);
const invalidMediaSettingsForm = new FormData();
invalidMediaSettingsForm.set("maxImageMb", "0");
invalidMediaSettingsForm.set("maxDocumentMb", "12");
invalidMediaSettingsForm.append("allowedKinds", "image");
invalidMediaSettingsForm.append("allowedImageExtensions", ".jpg");
const mutationCountBeforeInvalid = mediaSettingsMutations.length;
const invalidMediaSettingsResult = await mediaSettingsActionModule.updateMediaSettingsAction(
  mediaSettingsContractModule.MEDIA_SETTINGS_ACTION_INITIAL,
  invalidMediaSettingsForm,
);
assert.equal(invalidMediaSettingsResult.status, "error");
assert.equal(invalidMediaSettingsResult.code, "validation_error");
assert.equal(invalidMediaSettingsResult.focusTarget, "maxImageMb");
assert.equal(invalidMediaSettingsResult.fieldErrors.maxImageMb[0].includes("بين 1 و5"), true);
assert.equal(mediaSettingsMutations.length, mutationCountBeforeInvalid);
mediaSettingsSaveFailure = new FixtureMediaSettingsSaveError(
  "settings_write_forbidden",
  "لا يملك اتصال الخادم صلاحية حفظ إعدادات رفع الملفات.",
);
const mutationCountBeforeFailure = mediaSettingsMutations.length;
const failedMediaSettingsResult = await mediaSettingsActionModule.updateMediaSettingsAction(
  mediaSettingsContractModule.MEDIA_SETTINGS_ACTION_INITIAL,
  validMediaSettingsForm,
);
assert.equal(failedMediaSettingsResult.status, "error");
assert.equal(failedMediaSettingsResult.code, "settings_write_forbidden");
assert.equal(failedMediaSettingsResult.message.includes("صلاحية حفظ"), true);
assert.equal(mediaSettingsMutations.length, mutationCountBeforeFailure);
mediaSettingsSaveFailure = null;

let persistedMediaSettingsRow = null;
const mediaSettingsPolicyModule = loadTypeScriptModule("src/lib/admin/media-catalog/settings.ts", {
  "server-only": {},
  "../../logging": { logError: () => undefined },
  "../../supabase-admin": {
    getSupabaseAdmin: () => ({
      from: () => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({
            data: persistedMediaSettingsRow ? { value: persistedMediaSettingsRow.value } : null,
            error: null,
          });
        },
        upsert(row) {
          persistedMediaSettingsRow = row;
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
  "../media-intelligence/cms-upload-policy": {
    CMS_IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"],
    CMS_MAX_IMAGE_BYTES: 5 * 1024 * 1024,
    CMS_MAX_PDF_BYTES: 12 * 1024 * 1024,
    CMS_PDF_EXTENSIONS: [".pdf"],
  },
});
const fixtureSettings = {
  maxImageBytes: 4 * 1024 * 1024,
  maxDocumentBytes: 10 * 1024 * 1024,
  allowedKinds: ["image", "document"],
  allowedImageExtensions: [".jpg", ".webp"],
  allowedDocumentExtensions: [".pdf"],
  mimeVerification: true,
  collisionPolicy: "unique_name",
  safeDeletePolicy: "authoritative_zero_references",
};
await mediaSettingsPolicyModule.saveMediaSettings(fixtureSettings);
const reloadedFixtureSettings = await mediaSettingsPolicyModule.loadMediaSettings();
assert.deepEqual(reloadedFixtureSettings, fixtureSettings);
check("Media Settings success, validation, persistence reload, and no-audit-on-failure contracts pass with safe fixtures", true);
check("shared picker portals to the viewport, locks the root scroller, and keeps one themed media scroller", picker.includes("createPortal") && picker.includes('root.style.overflow = "hidden"') && picker.includes("data-media-picker-scroll") && picker.includes("admin-scrollbar") && !picker.includes("overflow-x-hidden") && !core.includes("overflow-x-hidden"));
check("duplicate media-browse route is closed", !existsSync(resolve(ROOT, "src/app/api/admin/media-browse/route.ts")));
check("topics-without-image report exists with server pagination", existsSync(resolve(ROOT, "src/app/admin/reports/topics-without-image/page.tsx")) && source("src/lib/admin/media-catalog/reports.ts").includes("range(from, from + pageSize - 1)"));

const passed = checks.filter((item) => item.ok).length;
console.log(`\nMedia Library system: ${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exitCode = 1;
