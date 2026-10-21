import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as nodePath from "node:path";
import * as nodeUtil from "node:util";

import ts from "typescript";

import {
  DASHBOARD_CONTRACT_VERSION,
  DASHBOARD_MIGRATION_VERSION,
  parseDashboardReadModel,
  type AdminDashboardModel,
} from "../src/lib/admin/dashboard/dashboard-contract.ts";

// Execute the real parser, loader, managed identity parser, reference extractor,
// and Catalog availability owner against in-memory transport doubles. This test
// never loads credentials or contacts a database, Storage, or another service.
const root = nodePath.resolve(import.meta.dirname, "..");
const endpoint = "https://dashboard-fixture.supabase.co";
const imageBucket = "dashboard-fixture-images";
const documentsBucket = "dashboard-fixture-documents";
const registryVersion = "media-reference-providers-v7-complete-managed-rebind";
const localImage = "/images/dashboard-isolated-fixture.png";
const imageUrl = (name: string) => `${endpoint}/storage/v1/object/public/${imageBucket}/images/${name}.png`;

function loadModule<T>(relativePath: string, dependencies: Record<string, unknown> = {}): T {
  const commonJsModule = { exports: {} };
  const output = ts.transpileModule(readFileSync(nodePath.resolve(root, relativePath), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  Function("exports", "module", "require", output)(commonJsModule.exports, commonJsModule, (specifier: string) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected Dashboard verification dependency: ${specifier}`);
  });
  return commonJsModule.exports as T;
}

type OptionalImageFields = { image?: unknown; image_alt?: unknown };

function rawReadModel() {
  return {
    contractVersion: DASHBOARD_CONTRACT_VERSION,
    checkedAt: "2026-10-20T00:00:00.000Z",
    kpis: {
      topics: { total: 23, published: 17, unpublished: 6, featured: 3 },
      categories: { total: 3, published: 2, unpublished: 1 },
      projects: { total: 11, published: 9, unpublished: 2 },
      pages: { total: 7, published: 5, unpublished: 2 },
      media: { total: 57, active: 53, issues: 4 },
    },
    contentHealth: {
      topicsMissingImage: 2,
      topicsMissingSeoDescription: 3,
      categoriesMissingImage: 1,
      staleUnpublished: 4,
    },
    recentTopics: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      title: `عنوان محتوى كامل ${index + 1}`,
      content_type: "article",
      slug: `topic-${index + 1}`,
      status: "published",
      category: "الأخبار",
      updated_at: `2026-10-${20 - index}T00:00:00.000Z`,
      published_at: "2026-10-01T00:00:00.000Z",
    } as {
      id: number; title: string; content_type: string; slug: string;
      status: string; category: string; updated_at: string; published_at: string;
    } & OptionalImageFields)),
    recentProjects: Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      code: `C${index + 35}`,
      arabic_name: `اسم المشروع الكامل ${index + 1}`,
      slug: `project-${index + 1}`,
      publication_status: "published",
      updated_at: `2026-10-${20 - index}T00:00:00.000Z`,
    } as {
      id: number; code: string; arabic_name: string; slug: string;
      publication_status: string; updated_at: string;
    } & OptionalImageFields)),
    databaseDiagnostics: {
      source: "public.admin_dashboard_truth_v1()",
      migrationVersion: DASHBOARD_MIGRATION_VERSION,
      migrationRegistered: true,
      rls: { topics: true, projects: true, pages: true, media_assets: true },
      missingIndexes: [] as string[],
      rpcAclServiceOnly: true,
      checkedAt: "2026-10-20T00:00:00.000Z",
    },
  };
}

type RawModel = ReturnType<typeof rawReadModel>;
type CatalogRow = { bucket: string; object_key: string; status: string; missing_object: boolean };
type CatalogQuery = { table: string; columns: string; filters: Array<[string, unknown]>; keys: string[] };

let rpcResult: { data: RawModel | null; error: { message: string } | null } = { data: rawReadModel(), error: null };
let catalogRows: CatalogRow[] = [];
let catalogError: Error | null = null;
let resolverError: Error | null = null;
let authError: Error | null = null;
let auditError: Error | null = null;
let mediaError: Error | null = null;
let localAvailable = false;
let reads: string[] = [];
let queries: CatalogQuery[] = [];
let availabilityCalls: unknown[] = [];
let loggedErrors: unknown[][] = [];

function reset() {
  rpcResult = { data: rawReadModel(), error: null };
  catalogRows = [];
  catalogError = null;
  resolverError = null;
  authError = null;
  auditError = null;
  mediaError = null;
  localAvailable = false;
  reads = [];
  queries = [];
  availabilityCalls = [];
  loggedErrors = [];
}

function activeAsset(name: string, overrides: Partial<CatalogRow> = {}): CatalogRow {
  return { bucket: imageBucket, object_key: `images/${name}.png`, status: "active", missing_object: false, ...overrides };
}

const supabase = {
  async rpc(name: string) {
    reads.push("rpc");
    assert.equal(name, "admin_dashboard_truth_v1");
    return rpcResult;
  },
  from(table: string) {
    reads.push("catalog");
    assert.equal(table, "media_assets");
    const call: CatalogQuery = { table, columns: "", filters: [], keys: [] };
    queries.push(call);
    const query = {
      select(columns: string) { call.columns = columns; return query; },
      eq(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      in(column: string, values: string[]) {
        assert.equal(column, "object_key");
        call.keys = values;
        return query;
      },
      async then<T>(fulfilled: (value: { data: CatalogRow[] | null; error: Error | null }) => T) {
        return fulfilled({ data: catalogError ? null : catalogRows.filter(row => call.keys.includes(row.object_key)), error: catalogError });
      },
    };
    return query;
  },
};

const contractModule = loadModule<typeof import("../src/lib/admin/dashboard/dashboard-contract.ts")>(
  "src/lib/admin/dashboard/dashboard-contract.ts",
);
const adapter = loadModule<typeof import("../src/lib/admin/media-storage-adapter.ts")>(
  "src/lib/admin/media-storage-adapter.ts",
);
const mediaPaths = loadModule<typeof import("../src/lib/admin/media-library-paths.ts")>(
  "src/lib/admin/media-library-paths.ts", { path: nodePath, "./media-storage-adapter": adapter },
);
const imagePolicy = loadModule<typeof import("../src/lib/admin/media-intelligence/cms-upload-policy.ts")>(
  "src/lib/admin/media-intelligence/cms-upload-policy.ts",
);
const managedPrefixes = [
  { bucket: imageBucket, kind: "image" as const, root: "images" as const, origin: endpoint, pathname: `/storage/v1/object/public/${imageBucket}/` },
  { bucket: documentsBucket, kind: "document" as const, root: "files" as const, origin: endpoint, pathname: `/storage/v1/object/public/${documentsBucket}/` },
];
const managedIdentity = {
  parseManagedStorageAsset: (value: string) => adapter.parseManagedMediaUrl(value, managedPrefixes),
};
const localResolver = loadModule<typeof import("../src/lib/media/resolve-local-public-image.ts")>(
  "src/lib/media/resolve-local-public-image.ts", {
    "server-only": {}, "node:path": nodePath,
    "node:fs": { existsSync: (path: string) => path === nodePath.join(root, "public", localImage.slice(1)) ? localAvailable : existsSync(path) },
  },
);
const providers = loadModule<typeof import("../src/lib/admin/media-catalog/reference-providers.ts")>(
  "src/lib/admin/media-catalog/reference-providers.ts", {
    "server-only": {}, "node:util": nodeUtil,
    "../projects/project-media-reference-rebind": {}, "../../page-blocks/admin-queries": {},
    "../../storage/upload-cms-asset": managedIdentity, "../../supabase-admin": { getSupabaseAdmin: () => supabase },
    "../content/content-types": {}, "../../content/public-content-path": {}, "./identity": {},
    "../seo/entity-seo-persistence": {},
  },
);
const catalogAvailability = loadModule<typeof import("../src/lib/admin/media-catalog/deleted-reference-state.ts")>(
  "src/lib/admin/media-catalog/deleted-reference-state.ts", {
    "server-only": {}, "../../media/resolve-local-public-image": localResolver,
    "../../supabase-admin": { getSupabaseAdmin: () => supabase },
    "../../storage/upload-cms-asset": managedIdentity, "./reference-providers": providers,
  },
);
const loader = loadModule<{ loadAdminDashboard(): Promise<AdminDashboardModel> }>(
  "src/lib/admin/dashboard/load-admin-dashboard.ts", {
    "server-only": {}, "../../supabase-admin": { getSupabaseAdmin: () => supabase },
    "../../logging/logger": { logError: (...args: unknown[]) => loggedErrors.push(args) },
    "../audit/audit-actions": { AUDIT_ACTION_LABELS: {} },
    "../audit/cms-audit-actions": { formatCmsAuditActionLabel: () => null },
    "../audit/list-admin-audit-logs": { listAdminAuditLogs: async (filters: unknown) => {
      reads.push("audit");
      assert.deepEqual(filters, { page: 1, pageSize: 6, sortDirection: "desc" });
      if (auditError) throw auditError;
      return { items: [], total: 0 };
    } },
    "../auth/require-admin-session": { requireAdminSession: async () => {
      reads.push("auth");
      if (authError) throw authError;
      return { id: 1 };
    } },
    "../media-catalog/catalog": { getMediaCatalogRuntimeState: async () => {
      reads.push("diagnostics");
      if (mediaError) throw mediaError;
      return {
        state: "synced", provider: "supabase", environment: "production",
        environmentKey: "production:supabase:dashboard-fixture", providerRegistryVersion: registryVersion,
        lastSuccessfulReconciliationAt: "2026-10-19T00:00:00.000Z", lastCatalogSync: null, lastScanAt: null,
        storageAssetCount: 57, catalogAssetCount: 57, warnings: [],
      };
    } },
    "../media-catalog/reference-providers": providers,
    "../media-catalog/deleted-reference-state": { readUnavailableManagedValues: async (value: unknown) => {
      availabilityCalls.push(value);
      if (resolverError) throw resolverError;
      return catalogAvailability.readUnavailableManagedValues(value);
    } },
    "../media-storage-adapter": adapter, "../media-library-paths": mediaPaths,
    "../media-intelligence/cms-upload-policy": imagePolicy,
    "../../media/resolve-local-public-image": localResolver,
    "./dashboard-contract": contractModule,
  },
);

let passed = 0;
function check(name: string, run: () => void) {
  run();
  console.log(`PASS ${++passed} ${name}`);
}
async function checkLoader(name: string, setup: (raw: RawModel) => void, verify: (model: AdminDashboardModel) => void) {
  reset();
  setup(rpcResult.data!);
  const result = await loader.loadAdminDashboard();
  verify(result);
  assert.equal(reads[0], "auth", "authorization must precede every source and Catalog read");
  assert.ok(queries.length <= 1, "Dashboard thumbnails must use at most one Catalog batch");
  for (const query of queries) {
    assert.equal(query.columns, "bucket,object_key,status,missing_object");
    assert.deepEqual(query.filters, [["provider", "supabase"]]);
    assert.ok(query.keys.length <= 10);
  }
  console.log(`PASS ${++passed} ${name}`);
}
function assertReadyPreserved(model: AdminDashboardModel) {
  const raw = rawReadModel();
  assert.equal(model.state, "ready");
  assert.equal(model.readModel.status, "ready");
  assert.deepEqual(model.readModel.data?.kpis, raw.kpis);
  assert.deepEqual(model.readModel.data?.contentHealth, raw.contentHealth);
  assert.equal(model.readModel.data?.recentTopics.length, 6);
  assert.equal(model.readModel.data?.recentProjects.length, 4);
  assert.deepEqual(model.readModel.data?.recentTopics.map(row => row.id), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(model.readModel.data?.recentProjects.map(row => row.id), [1, 2, 3, 4]);
  assert.deepEqual(model.readModel.data?.databaseDiagnostics, raw.databaseDiagnostics);
  assert.equal(model.media.data?.lastUpdatedAt, "2026-10-19T00:00:00.000Z");
}

const environmentKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_STORAGE_BUCKET_IMAGES", "SUPABASE_STORAGE_BUCKET_DOCUMENTS"] as const;
const previousEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = endpoint;
  process.env.SUPABASE_STORAGE_BUCKET_IMAGES = imageBucket;
  process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS = documentsBucket;

  check("legacy RPC without optional image fields parses to null", () => {
    const model = parseDashboardReadModel(rawReadModel());
    for (const row of [...model.recentTopics, ...model.recentProjects]) {
      assert.equal(row.image, null);
      assert.equal(row.imageAlt, null);
    }
  });
  check("new RPC preserves and normalizes source image and authored alt", () => {
    const raw = rawReadModel();
    raw.recentTopics[0].image = `  ${imageUrl("topic")}  `;
    raw.recentTopics[0].image_alt = "  صورة المقال  ";
    raw.recentProjects[0].image = imageUrl("project");
    raw.recentProjects[0].image_alt = "صورة المشروع";
    const model = parseDashboardReadModel(raw);
    assert.equal(model.recentTopics[0].image, imageUrl("topic"));
    assert.equal(model.recentTopics[0].imageAlt, "صورة المقال");
    assert.equal(model.recentProjects[0].image, imageUrl("project"));
    assert.equal(model.recentProjects[0].imageAlt, "صورة المشروع");
  });
  for (const malformed of [undefined, null, "", " \t ", 7, true, {}, []]) {
    check(`optional malformed image and alt remain nullable (${JSON.stringify(malformed)})`, () => {
      const raw = rawReadModel();
      raw.recentTopics[0].image = malformed;
      raw.recentTopics[0].image_alt = malformed;
      raw.recentProjects[0].image = malformed;
      raw.recentProjects[0].image_alt = malformed;
      const model = parseDashboardReadModel(raw);
      assert.equal(model.recentTopics[0].image, null);
      assert.equal(model.recentTopics[0].imageAlt, null);
      assert.equal(model.recentProjects[0].image, null);
      assert.equal(model.recentProjects[0].imageAlt, null);
    });
  }
  check("optional fields do not weaken required contract validation", () => {
    for (const mutate of [
      (raw: RawModel) => { raw.recentTopics[0].title = ""; },
      (raw: RawModel) => { raw.recentProjects[0].id = -1; },
      (raw: RawModel) => { raw.kpis.topics.total = Number.NaN; },
      (raw: RawModel) => { raw.databaseDiagnostics.rpcAclServiceOnly = "true" as unknown as boolean; },
    ]) {
      const raw = rawReadModel(); mutate(raw);
      assert.throws(() => parseDashboardReadModel(raw));
    }
  });
  await checkLoader("legacy RPC loads unchanged with zero Catalog queries", () => {}, model => {
    assertReadyPreserved(model);
    assert.equal(queries.length, 0);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
  });
  await checkLoader("all ten RPC rows resolve through exactly one batched Catalog read", raw => {
    raw.recentTopics.forEach((row, index) => { row.image = imageUrl(`topic-${index}`); catalogRows.push(activeAsset(`topic-${index}`)); });
    raw.recentProjects.forEach((row, index) => { row.image = imageUrl(`project-${index}`); catalogRows.push(activeAsset(`project-${index}`)); });
  }, model => {
    assertReadyPreserved(model);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].keys.length, 10);
    assert.equal(availabilityCalls.length, 1);
    assert.ok(model.readModel.data?.recentTopics.every(row => row.image));
    assert.ok(model.readModel.data?.recentProjects.every(row => row.image));
  });
  await checkLoader("duplicate image references remain one unique Catalog key", raw => {
    [...raw.recentTopics, ...raw.recentProjects].forEach(row => { row.image = imageUrl("shared"); });
    catalogRows.push(activeAsset("shared"));
  }, model => {
    assertReadyPreserved(model);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].keys, ["images/shared.png"]);
  });
  await checkLoader("unexpected extra RPC rows cannot expand the ten-image query budget", raw => {
    raw.recentTopics.push({ ...raw.recentTopics[0], id: 7, title: "عنوان زائد محفوظ", image: imageUrl("extra-topic") });
    raw.recentProjects.push({ ...raw.recentProjects[0], id: 5, arabic_name: "مشروع زائد محفوظ", image: imageUrl("extra-project") });
    raw.recentTopics.slice(0, 6).forEach((row, index) => { row.image = imageUrl(`topic-${index}`); catalogRows.push(activeAsset(`topic-${index}`)); });
    raw.recentProjects.slice(0, 4).forEach((row, index) => { row.image = imageUrl(`project-${index}`); catalogRows.push(activeAsset(`project-${index}`)); });
  }, model => {
    assert.equal(model.state, "ready");
    assert.equal(model.readModel.data?.recentTopics.length, 7);
    assert.equal(model.readModel.data?.recentProjects.length, 5);
    assert.equal(model.readModel.data?.recentTopics[6].image, null);
    assert.equal(model.readModel.data?.recentTopics[6].title, "عنوان زائد محفوظ");
    assert.equal(model.readModel.data?.recentProjects[4].image, null);
    assert.equal(model.readModel.data?.recentProjects[4].arabicName, "مشروع زائد محفوظ");
    assert.equal(queries[0].keys.length, 10);
    assert.ok(!queries[0].keys.some(key => key.includes("extra-")));
  });
  await checkLoader("mixed availability removes only affected images and preserves authored alt", raw => {
    raw.recentTopics[0].image = imageUrl("active");
    raw.recentTopics[0].image_alt = "صورة نشطة";
    raw.recentTopics[1].image = imageUrl("deleted");
    raw.recentTopics[1].image_alt = "صورة محذوفة";
    raw.recentTopics[2].image = imageUrl("unknown");
    catalogRows.push(activeAsset("active"), activeAsset("deleted", { status: "deleted" }));
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, imageUrl("active"));
    assert.equal(model.readModel.data?.recentTopics[0].imageAlt, "صورة نشطة");
    assert.equal(model.readModel.data?.recentTopics[1].image, null);
    assert.equal(model.readModel.data?.recentTopics[1].imageAlt, "صورة محذوفة");
    assert.equal(model.readModel.data?.recentTopics[2].image, null);
    assert.equal(queries.length, 1);
  });
  for (const status of ["deleted", "deleting", "missing"]) {
    await checkLoader(`Catalog ${status} image falls back while counts and readiness survive`, raw => {
      raw.recentTopics[0].image = imageUrl(status);
      catalogRows.push(activeAsset(status, { status }));
    }, model => {
      assertReadyPreserved(model);
      assert.equal(model.readModel.data?.recentTopics[0].image, null);
    });
  }
  await checkLoader("Catalog missing_object image falls back", raw => {
    raw.recentProjects[0].image = imageUrl("object-missing");
    catalogRows.push(activeAsset("object-missing", { missing_object: true }));
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentProjects[0].image, null);
  });
  await checkLoader("unknown Catalog identity falls back", raw => {
    raw.recentTopics[0].image = imageUrl("unknown");
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
  });
  await checkLoader("bucket identity prevents same-key foreign Catalog row approval", raw => {
    raw.recentTopics[0].image = imageUrl("wrong-bucket");
    catalogRows.push(activeAsset("wrong-bucket", { bucket: "foreign-bucket" }));
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
  });
  await checkLoader("Catalog outage blanks only image presentation", raw => {
    raw.recentTopics[0].image = imageUrl("topic");
    raw.recentProjects[0].image = imageUrl("project");
    catalogError = new Error("injected isolated Catalog failure");
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
    assert.equal(model.readModel.data?.recentProjects[0].image, null);
    assert.equal(loggedErrors.length, 1);
    assert.ok(!JSON.stringify(loggedErrors).includes(imageUrl("topic")), "logs must not disclose source URLs");
  });
  await checkLoader("resolver exception blanks image presentation without changing source readiness", raw => {
    raw.recentTopics[0].image = imageUrl("topic");
    resolverError = new Error("injected isolated resolver exception");
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
    assert.equal(queries.length, 0);
    assert.equal(loggedErrors.length, 1);
  });
  const rejectedImages = [
    "https://foreign-fixture.supabase.co/storage/v1/object/public/dashboard-fixture-images/images/a.png",
    `${endpoint}/storage/v1/object/authenticated/${imageBucket}/images/a.png`,
    `${endpoint}/storage/v1/object/sign/${imageBucket}/images/a.png?token=private-fixture`,
    `${imageUrl("a")}?token=private-fixture`, `${imageUrl("a")}#fragment`,
    `${endpoint}/storage/v1/object/public/${documentsBucket}/files/a.pdf`,
    `${endpoint}/storage/v1/object/public/${imageBucket}/images/a.pdf`,
    "javascript:alert(1)", "data:image/png;base64,ZmFrZQ==", "blob:https://example.test/id",
    "https://dashboard-fixture.supabase.co.evil.test/storage/v1/object/public/dashboard-fixture-images/images/a.png",
    `https://user:password@dashboard-fixture.supabase.co/storage/v1/object/public/${imageBucket}/images/a.png`,
    `http://dashboard-fixture.supabase.co/storage/v1/object/public/${imageBucket}/images/a.png`,
    "//example.test/a.png", "/images/../secret.png", "/images/%2e%2e/secret.png",
    "/images/a\\..\\secret.png", "/files/a.pdf", "/images/a.png?token=private-fixture",
  ];
  for (const [index, image] of rejectedImages.entries()) {
    await checkLoader(`unapproved reference ${index + 1} is rejected before Catalog`, raw => {
      raw.recentTopics[0].image = image;
    }, model => {
      assertReadyPreserved(model);
      assert.equal(model.readModel.data?.recentTopics[0].image, null);
      assert.equal(queries.length, 0);
    });
  }
  for (const [name, image] of [
    ["embedded newline", imageUrl("line\nbreak")],
    ["embedded tab", imageUrl("tab\tname")],
    ["embedded carriage return", imageUrl("carriage\rreturn")],
    ["raw double quote", imageUrl('double"quote')],
    ["raw whitespace", imageUrl("filename space")],
    ["raw angle brackets", imageUrl("angle<brackets>")],
    ["multiple URLs separated by newline", `${imageUrl("one")}\n${imageUrl("two")}`],
    ["oversized multiline URL payload", Array.from({ length: 101 }, (_, index) => imageUrl(`injected-${index}`)).join("\n")],
  ]) {
    await checkLoader(`${name} cannot bypass Catalog identity or expand its query budget`, raw => {
      raw.recentTopics[0].image = image;
    }, model => {
      assertReadyPreserved(model);
      assert.equal(model.readModel.data?.recentTopics[0].image, null);
      assert.equal(queries.length, 0);
      assert.equal(availabilityCalls.length, 0);
    });
  }
  await checkLoader("raw apostrophe retains one exact identity and unknown image still falls back", raw => {
    raw.recentTopics[0].image = imageUrl("single'quote");
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].keys, ["images/single'quote.png"]);
  });
  await checkLoader("canonical Catalog owner can approve an exact active apostrophe identity", raw => {
    raw.recentTopics[0].image = imageUrl("single'quote");
    catalogRows.push(activeAsset("single'quote"));
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, imageUrl("single'quote"));
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].keys, ["images/single'quote.png"]);
  });
  await checkLoader("missing safe local public image falls back without Catalog query", raw => {
    raw.recentTopics[0].image = "/images/dashboard-missing.png";
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, null);
    assert.equal(queries.length, 0);
  });
  await checkLoader("isolated safe local image uses existing filesystem owner without Catalog query", raw => {
    localAvailable = true;
    raw.recentTopics[0].image = localImage;
  }, model => {
    assertReadyPreserved(model);
    assert.equal(model.readModel.data?.recentTopics[0].image, localImage);
    assert.equal(queries.length, 0);
  });
  await checkLoader("base RPC failure remains partial, not a fabricated image-ready model", () => {
    rpcResult = { data: null, error: { message: "isolated RPC failure" } };
  }, model => {
    assert.equal(model.state, "partial");
    assert.equal(model.readModel.status, "unavailable");
    assert.equal(model.readModel.data, null);
    assert.equal(queries.length, 0);
  });
  await checkLoader("independent audit/diagnostic failures retain image data and partial status", raw => {
    raw.recentTopics[0].image = imageUrl("topic");
    catalogRows.push(activeAsset("topic"));
    auditError = new Error("isolated audit failure");
    mediaError = new Error("isolated diagnostic failure");
  }, model => {
    assert.equal(model.state, "partial");
    assert.equal(model.readModel.status, "ready");
    assert.equal(model.readModel.data?.recentTopics[0].image, imageUrl("topic"));
    assert.equal(model.audit.status, "unavailable");
    assert.equal(model.media.status, "unavailable");
  });
  reset();
  authError = new Error("isolated unauthorized session");
  await assert.rejects(loader.loadAdminDashboard(), /isolated unauthorized session/);
  assert.deepEqual(reads, ["auth"]);
  assert.equal(queries.length, 0);
  assert.equal(availabilityCalls.length, 0);
  console.log(`PASS ${++passed} rejected authorization prevents all source and Catalog reads`);
  console.log(`Dashboard thumbnail isolation: ${passed} checks passed; no network or persistent mutation.`);
} finally {
  for (const key of environmentKeys) {
    const previous = previousEnvironment[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}
