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

const contentTypesModule = loadTypeScriptModule("src/lib/admin/content/content-types.ts", {});
const publicContentPathModule = loadTypeScriptModule("src/lib/content/public-content-path.ts", {});
class TestMediaStorageError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const identityModule = loadTypeScriptModule("src/lib/admin/media-catalog/identity.ts", {
  path: { default: nodePath },
  "../media-storage-adapter": { MediaStorageError: TestMediaStorageError },
});

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
  "../content/content-types": contentTypesModule,
  "../../content/public-content-path": publicContentPathModule,
  "./identity": identityModule,
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
check("typed provider registry is unique and covers the 16 live declared domains", registry.providerCount === 16, String(registry.providerCount));
const legacyDocument = "/files/projects/document-1782017403551.pdf";
assert.equal(providerModule.extractMediaCandidateValues(`download ${legacyDocument} now`).includes(legacyDocument), true);
check("reference candidate extraction includes embedded legacy /images and /files paths", true);
assert.deepEqual(identityModule.parseLegacyPublicMediaAsset("/images/projects/c35/hero.jpg?preview=1"), {
  provider: "filesystem",
  bucket: "public",
  objectKey: "images/projects/c35/hero.jpg",
});
assert.equal(
  identityModule.getCanonicalMediaIdentityKey({
    provider: "filesystem",
    bucket: "public",
    objectKey: "images/projects/c35/hero.jpg",
  }),
  "filesystem:public:images/projects/c35/hero.jpg",
);
assert.equal(identityModule.parseLegacyPublicMediaAsset("/images/projects/C35/hero.jpg"), null);
assert.throws(
  () => identityModule.createCanonicalMediaIdentity({
    provider: "filesystem",
    bucket: "public",
    objectKey: "images/projects/c35/Hero Copy.jpg",
  }),
  (error) => error?.code === "invalid_project_media_path_case",
);
check("legacy public Project identities require lowercase paths without fallback normalization", true);

const usageSupabase = {
  from(table) {
    const rows = table === "projects"
      ? [{
          id: 7,
          arabic_name: "Project 7",
          image: `https://venesia.example${legacyDocument}?download=1`,
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
  "../content/content-types": contentTypesModule,
  "../../content/public-content-path": publicContentPathModule,
  "./identity": identityModule,
});
const liveLegacyUsage = await usageProviderModule.scanMediaUsageByPublicValue(legacyDocument);
assert.equal(liveLegacyUsage.uncertainties.length, 0);
assert.equal(liveLegacyUsage.references.length, 1);
assert.equal(liveLegacyUsage.references[0].domainKey, "projects");
assert.equal(liveLegacyUsage.references[0].fieldKey, "image");
check("live Usage Scan matches an absolute legacy asset URL without a Catalog row", true);

const readinessModule = loadTypeScriptModule("src/lib/admin/media-catalog/readiness.ts", {});
const searchNormalizationModule = loadTypeScriptModule(
  "src/lib/admin/entity-list/search-normalization.ts",
  {},
);
const catalogModule = loadTypeScriptModule("src/lib/admin/media-catalog/catalog.ts", {
  "server-only": {},
  path: { default: nodePath },
  "../media-storage-adapter": {
    resolveMediaStorageRuntimeContext: () => runtimeContext,
  },
  "../media-library": {
    listManagedMediaInventory: async () => managedInventory,
  },
  "../entity-list/search-normalization": searchNormalizationModule,
  "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
  "../../supabase-admin": { getSupabaseAdmin: () => ({}) },
  "./identity": identityModule,
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
  lastSuccessfulReconciliationRunIdentity: "test-run",
  lastSuccessfulReconciliationAt: "2026-07-25T01:00:00.000Z",
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

const canonicalLegacyProjectAsset = {
  ...catalogAsset,
  id: "legacy-project-c35-hero",
  provider: "filesystem",
  bucket: "public",
  objectKey: "images/projects/c35/hero.jpg",
  publicUrl: "/images/projects/c35/hero.jpg",
  displayName: "hero.jpg",
  originalFilename: "hero.jpg",
  folderPath: "images/projects/c35",
  sizeBytes: 1024,
  checksum: "legacy-project-checksum",
  source: "catalog",
  referenceCount: 5,
};
const productionPickerPage = catalogModule.buildMediaLibraryReadModel(
  { ...emptyCatalogSnapshot, assets: [canonicalLegacyProjectAsset] },
  managedInventory,
  { smartView: "all", folder: "images/projects", context: runtimeContext },
);
assert.equal(productionPickerPage.assets.length, 1);
assert.equal(productionPickerPage.assets[0].publicUrl, "/images/projects/c35/hero.jpg");
assert.equal(productionPickerPage.assets[0].provider, "filesystem");
assert.equal(productionPickerPage.assets[0].catalogRegistered, true);
assert.equal(productionPickerPage.assets[0].missingObject, false);
assert.equal(productionPickerPage.summary.readOnlyAssetCount, 1);
check("production picker read model includes canonical read-only legacy Project assets without a parallel inventory", true);

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
  uploadedBy: 7,
  createdAt: "2026-07-25T02:00:00.000Z",
  updatedAt: "2026-07-25T02:00:00.000Z",
  managedUploadProof: {
    reconciliationRunIdentity: completeRuntimeState.lastSuccessfulReconciliationRunIdentity,
    environmentKey: runtimeContext.identity,
    providerRegistryVersion: "test-registry",
    baselineStorageAssetCount: 1,
    baselineCatalogAssetCount: 1,
    baselineIdentityFingerprint: readinessModule.getMediaIdentitySetFingerprint([
      `${catalogAsset.provider}:${catalogAsset.bucket}:${catalogAsset.objectKey}`,
    ]),
  },
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
assert.equal(postUploadReadiness.runtimeDatasetMatches, true);
assert.equal(postUploadReadiness.usageResultsAuthoritative, true);
assert.equal(postUploadReadiness.safeDeleteReady, true);
assert.deepEqual(postUploadReadiness.reasons, []);

const unprovenPostUploadReadiness = readinessModule.buildMediaCatalogReadiness(
  {
    ...emptyCatalogSnapshot,
    assets: [catalogAsset, { ...postUploadCatalogAsset, uploadedBy: 999, managedUploadProof: null }],
  },
  postUploadInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(unprovenPostUploadReadiness.runtimeDatasetMatches, false);
assert.equal(unprovenPostUploadReadiness.usageResultsAuthoritative, false);
assert.deepEqual(unprovenPostUploadReadiness.reasons, ["runtime_dataset_mismatch"]);
const runtimeMismatchPresentation = readinessModule.getMediaReadinessReasonPresentation(
  "runtime_dataset_mismatch",
);
assert.equal(runtimeMismatchPresentation.label, "تغيرت مجموعة الملفات منذ آخر فحص مكتمل.");
assert.match(runtimeMismatchPresentation.action, /معاينة الفحص/);
assert.match(runtimeMismatchPresentation.action, /تنفيذ الفحص والمزامنة/);
assert.equal(runtimeMismatchPresentation.actionHref, "/admin/settings/media");

const secondPostUploadCatalogAsset = {
  ...postUploadCatalogAsset,
  id: "second-post-upload-catalog-asset",
  objectKey: "images/second-post-upload.png",
  publicUrl: "https://demo.supabase.co/second-post-upload.png",
  uploadedBy: 8,
  createdAt: "2026-07-25T03:00:00.000Z",
  updatedAt: "2026-07-25T03:00:00.000Z",
};
const twoPostUploadInventory = {
  ...postUploadInventory,
  items: [
    ...postUploadInventory.items,
    {
      ...managedInventory.items[0],
      path: secondPostUploadCatalogAsset.publicUrl,
      filename: "second-post-upload.png",
      storagePath: secondPostUploadCatalogAsset.objectKey,
    },
  ],
};
const twoPostUploadReadiness = readinessModule.buildMediaCatalogReadiness(
  {
    ...emptyCatalogSnapshot,
    assets: [catalogAsset, postUploadCatalogAsset, secondPostUploadCatalogAsset],
  },
  twoPostUploadInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(twoPostUploadReadiness.runtimeDatasetMatches, true);
assert.equal(twoPostUploadReadiness.safeDeleteReady, true);

function catalogRow(asset, overrides = {}) {
  return {
    id: asset.id,
    provider: asset.provider,
    bucket: asset.bucket,
    object_key: asset.objectKey,
    public_url: asset.publicUrl,
    original_filename: asset.originalFilename ?? asset.displayName,
    display_name: asset.displayName,
    media_kind: asset.kind,
    mime_type: asset.mimeType,
    extension: asset.extension,
    byte_size: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    checksum: asset.checksum,
    folder_path: asset.folderPath,
    status: asset.status,
    uploaded_by: asset.uploadedBy,
    default_alt_text: asset.defaultAltText,
    default_title: asset.defaultTitle,
    default_caption: asset.defaultCaption,
    reconciliation_state: asset.reconciliationState,
    missing_object: asset.missingObject,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
    reference_count: asset.referenceCount,
    metadata: {},
    ...overrides,
  };
}

let observedRegistrationRow = catalogRow(postUploadCatalogAsset, {
  original_filename: "post-upload-reconciliation-name.png",
});
let registrationInventory = managedInventory;
let registrationRuntimeState = completeRuntimeState;
let registrationInsertAttempts = 0;
let registrationInsertThrows = false;
const registrationRaceSupabase = {
  from(table) {
    if (table === "media_folders") {
      return { upsert: async () => ({ error: null }) };
    }
    if (table === "site_settings") {
      const query = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: { value: registrationRuntimeState }, error: null }; },
      };
      return query;
    }
    if (table === "admin_media_folders_catalog") {
      return {
        data: [],
        error: null,
        select() { return this; },
        order() { return this; },
      };
    }
    if (table === "admin_media_assets_catalog") {
      return {
        select() { return this; },
        neq() { return this; },
        order() { return this; },
        eq() { return this; },
        async range() { return { data: [catalogRow(catalogAsset)], error: null }; },
        async maybeSingle() { return { data: observedRegistrationRow, error: null }; },
      };
    }
    if (table === "media_assets") {
      return {
        insert() { registrationInsertAttempts += 1; return this; },
        select() { return this; },
        async single() {
          if (registrationInsertThrows) throw new Error("response lost after insert");
          return { data: null, error: { code: "23505", message: "duplicate identity" } };
        },
      };
    }
    throw new Error(`Unexpected registration test table ${table}`);
  },
};
const registrationRaceCatalogModule = loadTypeScriptModule(
  "src/lib/admin/media-catalog/catalog.ts",
  {
    "server-only": {},
    path: { default: nodePath },
    "../media-storage-adapter": {
      resolveMediaStorageRuntimeContext: () => runtimeContext,
    },
    "../media-library": {
      listManagedMediaInventory: async () => registrationInventory,
    },
    "../entity-list/search-normalization": searchNormalizationModule,
    "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
    "../../supabase-admin": { getSupabaseAdmin: () => registrationRaceSupabase },
    "./identity": {
      getFolderPathFromObjectKey: (objectKey) => nodePath.posix.dirname(objectKey),
      isMediaCatalogMissingError: () => false,
      getCanonicalMediaIdentityKey: (identity) => `${identity.provider}:${identity.bucket}:${identity.objectKey}`,
    },
    "./binary-metadata": {
      readUploadBinaryMetadata: async () => ({ width: 1, height: 1, checksum: "fixture" }),
    },
    "./reference-providers": { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION: "test-registry" },
    "./readiness": readinessModule,
  },
);
const registrationRaceFile = {
  name: "post-upload.png",
  type: "image/png",
  size: postUploadCatalogAsset.sizeBytes,
  arrayBuffer: async () => new ArrayBuffer(0),
};
const registrationRaceResult = {
  provider: "supabase",
  bucket: postUploadCatalogAsset.bucket,
  objectKey: postUploadCatalogAsset.objectKey,
  path: postUploadCatalogAsset.publicUrl,
  kind: "image",
  contentType: "image/png",
  sizeBytes: postUploadCatalogAsset.sizeBytes,
};
const preparedRegistrationProof = await registrationRaceCatalogModule.prepareCatalogUploadRegistration(7);
assert.match(
  preparedRegistrationProof.managedUploadRuntimeProof.baselineIdentityFingerprint,
  /^[a-f0-9]{64}$/,
);
assert.deepEqual(
  await registrationRaceCatalogModule.prepareCatalogUploadRegistration(8),
  preparedRegistrationProof,
);
const observedRegistration = await registrationRaceCatalogModule.registerCatalogUpload(
  registrationRaceResult,
  registrationRaceFile,
  7,
  preparedRegistrationProof,
);
assert.equal(observedRegistration.id, postUploadCatalogAsset.id);
assert.notEqual(observedRegistration.originalFilename, registrationRaceFile.name);
registrationInsertThrows = true;
assert.equal(
  (await registrationRaceCatalogModule.registerCatalogUpload(
    registrationRaceResult,
    registrationRaceFile,
    7,
    preparedRegistrationProof,
  )).id,
  postUploadCatalogAsset.id,
);
registrationInsertThrows = false;
observedRegistrationRow = { ...observedRegistrationRow, byte_size: 999_999 };
await assert.rejects(
  () => registrationRaceCatalogModule.registerCatalogUpload(
    registrationRaceResult,
    registrationRaceFile,
    7,
    preparedRegistrationProof,
  ),
  (error) => error?.code === "media_catalog_upload_registration_unproven",
);
const insertsBeforeUnprovenDataset = registrationInsertAttempts;
registrationInventory = postUploadInventory;
await assert.rejects(
  () => registrationRaceCatalogModule.prepareCatalogUploadRegistration(7),
  (error) => error?.code === "media_catalog_upload_readiness_proof_unavailable",
);
assert.equal(registrationInsertAttempts, insertsBeforeUnprovenDataset);
registrationInventory = managedInventory;
registrationRuntimeState = { ...completeRuntimeState, state: "uncertain" };
await assert.rejects(
  () => registrationRaceCatalogModule.prepareCatalogUploadRegistration(7),
  (error) => error?.code === "media_catalog_upload_readiness_proof_unavailable",
);
assert.equal(registrationInsertAttempts, insertsBeforeUnprovenDataset);
registrationRuntimeState = completeRuntimeState;
check("upload registration read-back accepts a reconciled canonical identity and fails closed on conflicting data", true);
check("every managed upload requires a synchronized baseline proof before Storage and Catalog mutation", true);

const countNeutralReplacementInventory = {
  ...managedInventory,
  items: [postUploadInventory.items[1]],
};
const countNeutralReplacementReadiness = readinessModule.buildMediaCatalogReadiness(
  { ...emptyCatalogSnapshot, assets: [postUploadCatalogAsset] },
  countNeutralReplacementInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(countNeutralReplacementReadiness.runtimeDatasetMatches, false);
assert.equal(countNeutralReplacementReadiness.safeDeleteReady, false);

const clockSkewIndependentReadiness = readinessModule.buildMediaCatalogReadiness(
  {
    ...emptyCatalogSnapshot,
    assets: [catalogAsset, { ...postUploadCatalogAsset, createdAt: "2026-07-25T00:59:59.999Z" }],
  },
  postUploadInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(clockSkewIndependentReadiness.runtimeDatasetMatches, true);
assert.equal(clockSkewIndependentReadiness.safeDeleteReady, true);

const uploaderAccountRemovedReadiness = readinessModule.buildMediaCatalogReadiness(
  {
    ...emptyCatalogSnapshot,
    assets: [catalogAsset, { ...postUploadCatalogAsset, uploadedBy: null }],
  },
  postUploadInventory,
  completeRuntimeState,
  runtimeContext,
  "test-registry",
);
assert.equal(uploaderAccountRemovedReadiness.runtimeDatasetMatches, true);
assert.equal(uploaderAccountRemovedReadiness.safeDeleteReady, true);

for (const [name, assets, inventory, runtimeState, registryVersion] of [
  [
    "mixed official and unknown Catalog additions",
    [catalogAsset, postUploadCatalogAsset, { ...secondPostUploadCatalogAsset, managedUploadProof: null }],
    twoPostUploadInventory,
    completeRuntimeState,
    "test-registry",
  ],
  [
    "a positive uploadedBy without explicit upload proof",
    [catalogAsset, { ...postUploadCatalogAsset, uploadedBy: 999, managedUploadProof: null }],
    postUploadInventory,
    completeRuntimeState,
    "test-registry",
  ],
  [
    "an uncertain runtime",
    [catalogAsset, postUploadCatalogAsset],
    postUploadInventory,
    { ...completeRuntimeState, state: "uncertain" },
    "test-registry",
  ],
  [
    "runtime warnings",
    [catalogAsset, postUploadCatalogAsset],
    postUploadInventory,
    { ...completeRuntimeState, warnings: ["provider_failed"] },
    "test-registry",
  ],
  [
    "a Provider Registry mismatch",
    [catalogAsset, postUploadCatalogAsset],
    postUploadInventory,
    completeRuntimeState,
    "new-registry",
  ],
  [
    "an unproven reconciliation timestamp",
    [catalogAsset, postUploadCatalogAsset],
    postUploadInventory,
    { ...completeRuntimeState, lastSuccessfulReconciliationAt: "invalid" },
    "test-registry",
  ],
]) {
  const readiness = readinessModule.buildMediaCatalogReadiness(
    { ...emptyCatalogSnapshot, assets },
    inventory,
    runtimeState,
    runtimeContext,
    registryVersion,
  );
  assert.equal(readiness.runtimeDatasetMatches, false, name);
  assert.equal(readiness.safeDeleteReady, false, name);
}
check("official post-reconciliation uploads extend readiness only when every additive identity is proven", true);

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
const projectEntryCoordination = source("src/lib/admin/projects/project-entry-media-coordination.ts");
const projectEntrySave = source("src/app/admin/projects/project-actions/save-entry.ts");
check("projects synchronize parent and child media domains", ["project_media", "project_floor_plans", "project_videos"].every((domain) => projectEntryCoordination.includes(`"${domain}"`)) && projectEntrySave.includes("coordinateProjectEntrySave") && projectEntryCoordination.includes("synchronizeMediaReferenceWriteScopesAfterDomainMutation"));
check("Project aggregate providers retain their specialized no-rebind mutation boundary", ["projects", "project_media", "project_floor_plans", "project_videos"].every((domain) => {
  const provider = providerModule.MEDIA_REFERENCE_PROVIDER_REGISTRY.find((item) => item.domainKey === domain);
  return provider && provider.supportsRebind === false;
}));
check("Project reference discovery includes canonical legacy identities without widening other domains", (source("src/lib/admin/media-catalog/reference-providers.ts").match(/adoptsCanonicalLegacyPublic: true/g) ?? []).length === 4);

const route = source("src/app/api/admin/media-library/route.ts");
check("Media API is private no-store and authenticates every verb", route.includes('"Cache-Control": "private, no-store, max-age=0"') && (route.match(/await requireAdminApi\(\)/g) ?? []).length === 4);
check("Media API builds one exhaustive Catalog plus Storage read model", route.includes("listPublicMediaInventory") && route.includes("listMediaCatalogSnapshot") && route.includes("buildMediaLibraryReadModel"));
check("upload compensation removes a new object only after a proven Catalog registration failure", route.includes("registerCatalogUpload") && route.includes("await deletePublicMediaAsset(saved.path)") && route.includes("MediaCatalogUploadRegistrationUnprovenError") && route.includes("MediaUploadCompensationError") && !route.includes("deletePublicMediaAsset(saved.path).catch"));
const catalogSource = source("src/lib/admin/media-catalog/catalog.ts");
const readinessSource = source("src/lib/admin/media-catalog/readiness.ts");
check("managed upload registration is insert-only", catalogSource.includes('.from("media_assets")') && catalogSource.includes(".insert({") && !catalogSource.includes("onConflict: \"provider,bucket,object_key\""));
check("managed upload registration records an explicit runtime baseline identity proof", catalogSource.includes("managedUploadRuntimeProof") && catalogSource.includes("reconciliationRunIdentity") && catalogSource.includes("baselineStorageAssetCount") && catalogSource.includes("baselineCatalogAssetCount") && catalogSource.includes("baselineIdentityFingerprint"));
check("the route proves the upload baseline before creating the managed Storage object", route.indexOf("prepareCatalogUploadRegistration(actor.id)") < route.indexOf("await savePublicMediaUpload(folder, file)") && catalogSource.includes("MediaCatalogUploadReadinessProofError"));
check("ambiguous Catalog registration is read back without blindly deleting Storage", catalogSource.includes("getCatalogAssetByIdentity") && catalogSource.includes("MediaCatalogUploadRegistrationUnprovenError") && route.includes("!(error instanceof MediaCatalogUploadRegistrationUnprovenError)"));
check("readiness trusts only fully proven additive Admin uploads for the same identity baseline", readinessSource.includes("isTrustedManagedUploadDatasetExtension") && readinessSource.includes("provenUploadAssets.length !== catalogDelta") && readinessSource.includes("hasManagedUploadProofForBaseline") && readinessSource.includes("managedStorageKeys.has(storageKey)") && readinessSource.includes("getMediaIdentitySetFingerprint(baselineCatalogKeys)"));
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
const sharedModal = source("src/components/admin/VenesiaModal.tsx");
check("Manage and Select reuse one Media Library core", core.includes("data-media-library-mode") && picker.includes("<MediaLibraryCore"));
check("picker selection changes a field only after explicit confirmation", picker.includes("onConfirmSelection") && core.includes("تأكيد الاختيار"));
check("media previews use optimized next/image with responsive sizes", core.includes('from "next/image"') && core.includes("sizes={") && !core.includes("unoptimized"));
check("picker delegates focus trapping, Escape, and focus return to VenesiaModal", picker.includes("<VenesiaModal") && picker.includes("closeOnEscape") && !picker.includes("createPortal") && !picker.includes("document.addEventListener") && sharedModal.includes('event.key === "Escape" && closeOnEscape') && sharedModal.includes("focusReturnSnapshotRef"));
check("multi-upload, folders, smart views, metadata and safe replacement are present", ["uploadFiles", "createFolder", "SMART_VIEWS", "updateMetadata", "stageReplacement"].every((token) => core.includes(token)));
check("physical rename and move controls stay out of Select Mode", core.includes('mode === "manage" && selectedAssets.length === 1') && !picker.includes("move_asset"));
check("summary and folder counters consume the merged read model", core.includes("data.summary.totalBytes") && core.includes("item.totalAssetCount") && core.includes("item.totalBytes"));
check("dashboard separates management, usage, missing, managed and read-only storage metrics", ["unreconciledAssetCount", "usageUnknownCount", "missingObjectCount", "managedStorageAssetCount", "readOnlyAssetCount", "largestAsset"].every((token) => core.includes(token)));
check(
  "Asset Viewer delegates total results and canonical 10/20/30/50/100 page sizes to Shared Pagination",
  core.includes("<AdminTablePagination") &&
    core.includes("const PAGE_SIZES: PageSize[] = [10, 20, 30, 50, 100]") &&
    core.includes("totalCount={data.total}") &&
    core.includes("pageSizeOptions={PAGE_SIZES.map(String)}") &&
    core.includes("onPageSizeChange"),
);
check(
  "Asset Viewer load failures expose a read-only retry owned by the catalog loader",
  core.includes('role="alert"') &&
    core.includes('onClick={() => void loadPage()}') &&
    core.includes("disabled={loading}") &&
    core.includes('loading ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"'),
);
check(
  "asset type filter has an explicit accessible name",
  core.includes("MEDIA_LIBRARY_FILTERS") && core.includes('label: "نوع الملف"'),
);
check("folder navigation uses one recursive asset scope in Grid and List", source("src/lib/admin/media-catalog/catalog.ts").includes('asset.folderPath.startsWith(`${input.folder}/`)') && core.includes("openFolder"));
check("PDF cards and the details panel provide a consistent document preview", core.includes("PdfDocumentPreview") && core.includes("<iframe") && core.includes("مستند قابل للمعاينة"));
check("unknown Storage usage is never rendered as a false zero", core.includes('value === null ? "لم يكتمل فحص الارتباطات"') && core.includes("يعرض الفحص المباشر أدناه"));
check("Smart Views are global and expose only implemented truth contracts", core.includes("setFolder(null)") && core.includes("عروض كل المكتبة") && core.includes("صور بلا وصف افتراضي") && !core.includes('id: "recent"') && !core.includes('id: "large"'));
check("reference-dependent Smart Views show readiness truth instead of false empty results", core.includes("referenceViewUnavailable") && core.includes("غير جاهز حتى يكتمل فحص مواضع الاستخدام") && source("src/lib/admin/media-catalog/catalog.ts").includes('smartView === "used" || smartView === "unused"'));
check("safe-delete blockers are visible, actionable, centrally owned and associated with the disabled control", core.includes("getMediaReadinessReasonPresentation") && core.includes("aria-describedby={!canSafelyDeleteSelectedAssets ? safeDeleteStatusId : undefined}") && core.includes("id={safeDeleteStatusId}") && core.includes("السبب:") && core.includes("الإجراء المطلوب:") && core.includes('href={item.actionHref}') && core.includes("الأصل غير مسجل داخل Media Catalog."));
const topicMediaCatalogSyncSignal = source("src/components/admin/content/editors/article/TopicMediaCatalogSyncSignal.tsx");
check("returning to a visible Media Library refreshes both the asset dataset and live usage panel", core.includes('window.addEventListener("focus", refreshVisibleLibrary)') && core.includes('document.addEventListener("visibilitychange", refreshVisibleLibrary)') && core.includes('window.addEventListener("storage", refreshAfterTopicSave)') && core.includes("refreshToken={dataRevision}") && topicMediaCatalogSyncSignal.includes('form.addEventListener("admin-form-saved"') && topicMediaCatalogSyncSignal.includes("window.localStorage.setItem(") && source("src/components/admin/media-intelligence/MediaUsagePanel.tsx").includes('key={`${assetPath}:${refreshToken}`}'));
const usageRoute = source("src/app/api/admin/media-usage/route.ts");
check("Usage API scans live providers even without a Catalog row", usageRoute.includes("scanMediaUsageByPublicValue") && usageRoute.includes("entityIdentity: reference.entityIdentity") && !usageRoute.includes("media_asset_missing_from_catalog"));
check("Usage API makes unregistered authoritative-unused impossible", usageRoute.includes("catalogRegistered &&") && usageRoute.includes("readiness.usageResultsAuthoritative") && usageRoute.includes("const unusedAuthoritative"));
check("shared NoImage visual exists", existsSync(resolve(ROOT, "src/components/admin/media/MediaNoImage.tsx")));

const settings = source("src/lib/admin/media-catalog/settings.ts");
check("media settings expose policy but never provider credentials", settings.includes("maxImageBytes") && settings.includes("safeDeletePolicy") && !/service.role|credential|secret/i.test(settings));
const settingsPanel = source("src/app/admin/settings/media/MediaSettingsPanel.tsx");
const settingsAction = source("src/app/admin/settings/media/actions.ts");
const recoveryCenter = source("src/app/admin/settings/media/MediaRecoveryCenter.tsx");
check("Media Settings exposes user-facing scan controls and readiness without credentials", settingsPanel.includes("معاينة الفحص") && settingsPanel.includes("تنفيذ الفحص والمزامنة") && settingsPanel.includes("آخر فحص مكتمل") && settingsPanel.includes("نتائج الاستخدام") && !/credential|service.role|bucket/i.test(settingsPanel));
check("execution remains blocked until the current preview is reliable", settingsPanel.includes("const canApplyScan") && settingsPanel.includes("!canApplyScan || scanBusy !== null"));
check("choosing PDF automatically enables the document kind", settingsPanel.includes('setAllowedKinds((current) => [...new Set([...current, "document" as const])])'));
const reconciliation = source("src/lib/admin/media-catalog/reconciliation.ts");
check("Dry Run simulates Catalog registration before provider reference discovery", reconciliation.includes("simulatedCatalogAsset") && reconciliation.includes("simulatedMap.set") && reconciliation.includes("assetMap: simulatedMap"));
check("Reconciliation state is bound to environment provider and registry version", ["environmentKey: context.identity", "provider: context.provider", "environment: context.environment", "MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION"].every((token) => reconciliation.includes(token)));
check("Media Settings adopts Form Runtime with explicit validation and colocated field feedback", settingsAction.includes("Number.isInteger") && settingsAction.includes("fieldErrors") && settingsPanel.includes("AdminFormRuntime") && settingsPanel.includes("AdminFormError") && settingsPanel.includes("AdminFeedbackChannelViewport"));
check(
  "Media Recovery reuses one in-flight queue read during effect replay",
  recoveryCenter.includes("const queueRequestRef = useRef<Promise<MediaRecoveryQueue> | null>(null)") &&
    recoveryCenter.includes("if (queueRequestRef.current) return queueRequestRef.current") &&
    recoveryCenter.includes("queueRequestRef.current === request") &&
    recoveryCenter.includes("void requestQueue()") &&
    !recoveryCenter.includes("void requestRecoveryQueue()"),
);

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
check("shared picker adopts the viewport modal owner, locks the root scroller, and keeps one neutral themed media scroller", picker.includes("<VenesiaModal") && picker.includes('size="xl"') && picker.includes('bodyClassName="flex flex-col !overflow-hidden !p-0"') && picker.includes("data-media-picker-scroll") && picker.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") && !picker.includes("admin-scrollbar") && picker.includes("flex-1 overflow-y-auto") && sharedModal.includes('root.style.overflow = "hidden"') && sharedModal.includes('document.body.style.overflow = "hidden"') && !picker.includes("overflow-x-hidden") && !core.includes("overflow-x-hidden"));
check("duplicate media-browse route is closed", !existsSync(resolve(ROOT, "src/app/api/admin/media-browse/route.ts")));
check("topics-without-image report exists with server pagination", existsSync(resolve(ROOT, "src/app/admin/reports/topics-without-image/page.tsx")) && source("src/lib/admin/media-catalog/reports.ts").includes("range(from, from + pageSize - 1)"));

const passed = checks.filter((item) => item.ok).length;
console.log(`\nMedia Library system: ${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exitCode = 1;
