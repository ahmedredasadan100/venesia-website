import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const checks = [];

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const output = ts.transpileModule(source(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      if (specifier.startsWith("node:") || ["crypto", "path"].includes(specifier)) {
        return nativeRequire(specifier);
      }
      throw new Error(`Unsupported dependency ${specifier} while loading ${relativePath}`);
    },
  );
  return commonJsModule.exports;
}

const storageContract = loadTypeScriptModule("src/lib/admin/media-storage-adapter.ts");
const mediaPaths = loadTypeScriptModule("src/lib/admin/media-library-paths.ts", {
  path: nativeRequire("node:path"),
  "./media-storage-adapter": storageContract,
});
const uploadPolicy = loadTypeScriptModule(
  "src/lib/admin/media-intelligence/cms-upload-policy.ts",
);

check(
  "production always selects Supabase even when filesystem is requested",
  storageContract.resolveMediaStorageProvider({
    NODE_ENV: "production",
    CMS_STORAGE_UPLOADS: "filesystem",
  }) === "supabase",
);
check(
  "Vercel Preview always selects Supabase",
  storageContract.resolveMediaStorageProvider({
    NODE_ENV: "development",
    VERCEL: "1",
    VERCEL_ENV: "preview",
  }) === "supabase",
);
check(
  "local development uses Supabase for every managed mutation",
  storageContract.resolveMediaStorageProvider({ NODE_ENV: "development" }) === "supabase",
);
check(
  "local development keeps filesystem as read-only browse-through only",
  storageContract.shouldIncludeLocalFilesystemReadThrough({ NODE_ENV: "development" }) === true &&
    storageContract.shouldIncludeLocalFilesystemReadThrough({ NODE_ENV: "production" }) === false,
);

assert.equal(mediaPaths.normalizeMediaFolder("images/topics"), "images/topics");
for (const unsafeFolder of [
  "../images",
  "images/../files",
  "/etc",
  "other/folder",
  "images/%2e%2e/secrets",
]) {
  assert.throws(() => mediaPaths.normalizeMediaFolder(unsafeFolder));
}
check("media folders reject traversal and non-media roots", true);

const storageObjects = new Map();
const storageOrigin = "https://project.supabase.co";

function bucketObjects(bucket) {
  if (!storageObjects.has(bucket)) storageObjects.set(bucket, new Map());
  return storageObjects.get(bucket);
}

function createStorageClient() {
  return {
    storage: {
      from(bucket) {
        return {
          getPublicUrl(objectPath) {
            return {
              data: {
                publicUrl: `${storageOrigin}/storage/v1/object/public/${bucket}/${objectPath}`,
              },
            };
          },
          async upload(objectPath, body, options) {
            const objects = bucketObjects(bucket);
            if (objects.has(objectPath) && !options?.upsert) {
              return { data: null, error: { message: "Already exists" } };
            }
            const byteLength = body?.byteLength ?? body?.length ?? 0;
            objects.set(objectPath, {
              body,
              contentType: options?.contentType ?? null,
              size: byteLength,
              createdAt: new Date().toISOString(),
            });
            return { data: { path: objectPath }, error: null };
          },
          async list(prefix) {
            const entries = new Map();
            for (const [objectPath, object] of bucketObjects(bucket)) {
              if (!objectPath.startsWith(`${prefix}/`)) continue;
              const remainder = objectPath.slice(prefix.length + 1);
              const [name, ...rest] = remainder.split("/");
              if (!name) continue;
              if (rest.length) {
                entries.set(name, { id: null, name, metadata: null });
              } else {
                entries.set(name, {
                  id: objectPath,
                  name,
                  created_at: object.createdAt,
                  metadata: {
                    size: object.size,
                    mimetype: object.contentType,
                  },
                });
              }
            }
            return {
              data: [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)),
              error: null,
            };
          },
          async remove(objectPaths) {
            const objects = bucketObjects(bucket);
            for (const objectPath of objectPaths) objects.delete(objectPath);
            return { data: objectPaths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };
}

const fakeSupabase = createStorageClient();
const storageModule = loadTypeScriptModule("src/lib/storage/upload-cms-asset.ts", {
  "server-only": {},
  crypto: nativeRequire("node:crypto"),
  path: nativeRequire("node:path"),
  "../admin/media-intelligence/cms-upload-policy": uploadPolicy,
  "../admin/media-storage-adapter": storageContract,
  "../admin/media-library-paths": mediaPaths,
  "../supabase-admin": { getSupabaseStorageAdmin: () => fakeSupabase },
});
const adapter = storageModule.createSupabaseCmsMediaStorageAdapter(fakeSupabase);

function mockFile(name, type, bytes, declaredSize = bytes.length) {
  return {
    name,
    type,
    size: declaredSize,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

const pngBytes = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const uploaded = await adapter.uploadImage(
  "images/topics",
  mockFile("../Runtime QA Image.PNG", "image/png", pngBytes),
);
check(
  "upload returns a stable public Supabase URL",
  uploaded.path.startsWith(
    `${storageOrigin}/storage/v1/object/public/cms-images/images/topics/`,
  ),
  uploaded.path,
);
check(
  "uploaded filename is sanitized and collision-resistant",
  /^runtime-qa-image-\d+-[a-f0-9-]{12}\.png$/.test(uploaded.filename),
  uploaded.filename,
);

const listing = await adapter.listFolder("images/topics");
const listedAsset = listing.items.find((item) => item.path === uploaded.path);
check("uploaded image appears in the Media Library listing", Boolean(listedAsset));
check(
  "Media Library exposes managed metadata",
  listedAsset?.managed === true &&
    listedAsset.provider === "supabase" &&
    listedAsset.contentType === "image/png" &&
    listedAsset.sizeBytes === pngBytes.length &&
    Boolean(listedAsset.uploadedAt),
);

const replacement = await adapter.uploadImage(
  "images/topics",
  mockFile("replacement.png", "image/png", Buffer.concat([pngBytes, Buffer.from([1])])),
  { replacePath: uploaded.path },
);
check(
  "replacement creates a distinct canonical object without same-path overwrite",
  replacement.path !== uploaded.path &&
    adapter.isManagedAsset(replacement.path) &&
    (await adapter.listImagePaths("images", 20)).includes(uploaded.path),
);
check(
  "recursive image listing returns the managed public URL",
  (await adapter.listImagePaths("images", 20)).includes(uploaded.path),
);

await assert.rejects(
  adapter.uploadImage(
    "images/topics",
    mockFile("disguised.png", "text/plain", pngBytes),
  ),
  /غير متطابقين/,
);
check("disguised MIME is rejected", true);

await assert.rejects(
  adapter.uploadImage(
    "images/topics",
    mockFile(
      "oversized.png",
      "image/png",
      pngBytes,
      uploadPolicy.CMS_MAX_IMAGE_BYTES + 1,
    ),
  ),
  /الحد المسموح/,
);
check("oversized image is rejected before upload", true);

check("managed Supabase URLs are recognized", adapter.isManagedAsset(uploaded.path));
check("legacy /images paths remain unmanaged", !adapter.isManagedAsset("/images/venesia-5.png"));
check(
  "external URLs remain unmanaged",
  !adapter.isManagedAsset("https://example.com/storage/v1/object/public/cms-images/images/x.png"),
);
await assert.rejects(
  adapter.deleteAsset("/images/venesia-5.png"),
  /ليس أصلًا مُدارًا/,
);
check("delete rejects unmanaged legacy assets", true);

await adapter.deleteAsset(uploaded.path);
check(
  "delete removes a managed asset",
  !(await adapter.listImagePaths("images", 20)).includes(uploaded.path),
);

const topicValidation = loadTypeScriptModule(
  "src/lib/admin/content-workflow/topic-publish-validation.ts",
  {
    "./brand-tone-guardrails": loadTypeScriptModule(
      "src/lib/admin/content-workflow/brand-tone-guardrails.ts",
    ),
  },
);
const validTopic = {
  title: "Runtime media topic",
  slug: "runtime-media-topic",
  excerpt: "A sufficiently long topic excerpt for publish validation.",
  content: "Topic body",
  image:
    `${storageOrigin}/storage/v1/object/public/cms-images/images/topics/runtime.png`,
  imageAlt: "Runtime image",
  categorySlug: "news",
  seoTitle: "Runtime media storage topic title that is valid",
  seoDescription:
    "A sufficiently detailed SEO description used to prove that a durable media URL passes the same topic publish checklist without a path-specific restriction.",
  focusKeyword: "runtime media",
  faq: [],
};
check(
  "Publish Checklist accepts a managed Storage image URL",
  topicValidation.getTopicPublishValidationError(validTopic) === null,
);
check(
  "Publish Checklist continues to accept a legacy /images URL",
  topicValidation.getTopicPublishValidationError({
    ...validTopic,
    image: "/images/venesia-5.png",
  }) === null,
);

const facadeSource = source("src/lib/admin/media-library.ts");
const supabaseAdminSource = source("src/lib/supabase-admin.ts");
const articleHelperSource = source(
  "src/app/admin/content/topics/article-actions/helpers.ts",
);
const mediaHelperSource = source(
  "src/app/admin/content/topics/media-actions/helpers.ts",
);
check(
  "media facade isolates filesystem behind local read-only list paths",
  facadeSource.includes("shouldIncludeLocalFilesystemReadThrough") &&
    facadeSource.includes('import("./media-library-fs")') &&
    facadeSource.includes("getManagedMediaStorageAdapter") &&
    facadeSource.includes("savePublicMediaUpload") &&
    facadeSource.includes("deletePublicMediaAsset") &&
    !source("src/lib/admin/media-library-fs.ts").includes("registerCatalogUpload"),
);
check(
  "Storage uses a dedicated request timeout without changing database queries",
  supabaseAdminSource.includes("SUPABASE_STORAGE_REQUEST_TIMEOUT_MS = 60_000") &&
    supabaseAdminSource.includes(
      "createSupabaseFetch(SUPABASE_STORAGE_REQUEST_TIMEOUT_MS)",
    ) &&
    source("src/lib/storage/upload-cms-asset.ts").includes(
      "getSupabaseStorageAdmin",
    ),
);
check(
  "topic forms use the shared picker and reject legacy direct file payloads",
  !/(fs\/promises|mkdir\(|writeFile\(|public["',\s]+["']images)/.test(
    `${articleHelperSource}\n${mediaHelperSource}`,
  ) &&
    articleHelperSource.includes("الرفع المباشر من نموذج الموضوع متوقف") &&
    mediaHelperSource.includes("الرفع المباشر من نموذج المحتوى متوقف"),
);

const routeSource = source("src/app/api/admin/media-library/route.ts");
check(
  "upload and delete API handlers authenticate before reading request data",
  (routeSource.match(/await requireAdminApi\(\)/g) ?? []).length === 4 &&
    routeSource.indexOf("await requireAdminApi()") < routeSource.indexOf("request.formData()") &&
    routeSource.lastIndexOf("await requireAdminApi()") < routeSource.lastIndexOf("request.json()"),
);
check(
  "delete API delegates to the fail-closed reservation Saga",
  routeSource.includes("safelyDeleteMediaAsset") &&
    routeSource.includes('result.eligibility.state === "in_use"') &&
    routeSource.includes("workflow?.repairRequired") &&
    routeSource.includes("media_delete_post_reservation_reference") &&
    routeSource.includes("media_delete_finalization_failed") &&
    routeSource.includes("تم منع العملية لحماية المحتوى"),
);

const nextConfigSource = source("next.config.ts");
check(
  "next/image allows only public Supabase Storage object paths",
  nextConfigSource.includes('hostname: "**.supabase.co"') &&
    nextConfigSource.includes('pathname: "/storage/v1/object/public/**"'),
);

const migrationSource = source(
  "sql/migrations/20260722160000_cms_media_storage_buckets.sql",
);
check(
  "migration provisions public buckets with MIME and size limits",
  migrationSource.includes("'cms-images'") &&
    migrationSource.includes("5242880") &&
    migrationSource.includes("image/avif") &&
    migrationSource.includes("'cms-documents'") &&
    migrationSource.includes("12582912") &&
    migrationSource.includes("application/pdf"),
);

function walkSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return [fullPath];
  });
}

const clientTokenLeaks = walkSourceFiles(resolve(ROOT, "src"))
  .filter((file) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(file)))
  .filter((file) => {
    const value = readFileSync(file, "utf8");
    return /^\s*["']use client["'];/m.test(value) &&
      /(SUPABASE_SERVICE_ROLE_KEY|BLOB_READ_WRITE_TOKEN)/.test(value);
  });
check(
  "no storage write token is referenced by a Client Component",
  clientTokenLeaks.length === 0,
  clientTokenLeaks.join(", "),
);

const passed = checks.filter((item) => item.ok).length;
console.log(`\nProduction media storage: ${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exitCode = 1;
