import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
check("safe delete checks persisted references and storage existence", safeDelete.includes("listCatalogReferences") && safeDelete.includes("verifyManagedStorageAssetExists"));
check("safe delete never treats uncertainty as zero references", safeDelete.includes('state: "uncertain"') && safeDelete.includes('state: "safe_to_delete"'));
check("unused view is suppressed while catalog or provider registry is uncertain", source("src/lib/admin/media-catalog/catalog.ts").includes("لا يمكن إعلان أي أصل كغير مستخدم") && source("src/lib/admin/media-catalog/catalog.ts").includes("MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION"));

const synchronization = source("src/lib/admin/media-catalog/synchronization.ts");
check("rebind proves live registry parity, retains the old asset and compensates failures", synchronization.includes("media_reference_rebind_drift") && synchronization.includes("scanAllMediaReferenceProviders") && synchronization.includes("compensationFailures") && synchronization.includes("previousAssetRetained: true"));
check("projects synchronize parent and child media domains", synchronization.includes('"project_media"') && synchronization.includes('"project_floor_plans"'));

const route = source("src/app/api/admin/media-library/route.ts");
check("Media API is private no-store and authenticates every verb", route.includes('"Cache-Control": "private, no-store, max-age=0"') && (route.match(/await requireAdminApi\(\)/g) ?? []).length === 4);
check("upload compensation removes a new object when catalog registration fails", route.includes("registerCatalogUpload") && route.includes("deletePublicMediaAsset(saved.path).catch"));
check("catalog upload rejects unindexed local filesystem writes before mutation", route.includes('resolveMediaStorageProvider() !== "supabase"') && route.indexOf('resolveMediaStorageProvider() !== "supabase"') < route.indexOf("savePublicDocumentUpload(folder, file)"));
check("catalog registration records checksum and supported image dimensions", source("src/lib/admin/media-catalog/catalog.ts").includes("readUploadBinaryMetadata") && source("src/lib/admin/media-catalog/binary-metadata.ts").includes('createHash("sha256")'));
check("replace-all uses the reference synchronization owner", route.includes("rebindAllSupportedMediaReferences") && route.includes('operation === "replace_all"'));
check("Manage physical move uses live reference proof, Storage move, rebind and compensation", route.includes('operation === "move_asset"') && source("src/lib/admin/media-catalog/physical-move.ts").includes("scanAllMediaReferenceProviders") && source("src/lib/admin/media-catalog/physical-move.ts").includes("moveManagedStorageAsset") && source("src/lib/admin/media-catalog/physical-move.ts").includes("rollbackFailures"));

const core = source("src/components/admin/media/MediaLibraryCore.tsx");
const picker = source("src/components/admin/media/AdminMediaPickerModal.tsx");
check("Manage and Select reuse one Media Library core", core.includes("data-media-library-mode") && picker.includes("<MediaLibraryCore"));
check("picker selection changes a field only after explicit confirmation", picker.includes("onConfirmSelection") && core.includes("تأكيد الاختيار"));
check("media previews use optimized next/image with responsive sizes", core.includes('from "next/image"') && core.includes("sizes={") && !core.includes("unoptimized"));
check("picker traps focus, supports Escape, and restores focus", picker.includes('event.key === "Escape"') && picker.includes("event.key !== \"Tab\"") && picker.includes("previousFocus"));
check("multi-upload, folders, smart views, metadata and safe replacement are present", ["uploadFiles", "createFolder", "SMART_VIEWS", "updateMetadata", "stageReplacement"].every((token) => core.includes(token)));
check("physical rename and move controls stay out of Select Mode", core.includes('mode === "manage" && selectedAssets.length === 1') && !picker.includes("move_asset"));
check("shared NoImage visual exists", existsSync(resolve(ROOT, "src/components/admin/media/MediaNoImage.tsx")));

const settings = source("src/lib/admin/media-catalog/settings.ts");
check("media settings expose policy but never provider credentials", settings.includes("maxImageBytes") && settings.includes("safeDeletePolicy") && !/service.role|credential|secret/i.test(settings));
check("duplicate media-browse route is closed", !existsSync(resolve(ROOT, "src/app/api/admin/media-browse/route.ts")));
check("topics-without-image report exists with server pagination", existsSync(resolve(ROOT, "src/app/admin/reports/topics-without-image/page.tsx")) && source("src/lib/admin/media-catalog/reports.ts").includes("range(from, from + pageSize - 1)"));

const passed = checks.filter((item) => item.ok).length;
console.log(`\nMedia Library system: ${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exitCode = 1;
