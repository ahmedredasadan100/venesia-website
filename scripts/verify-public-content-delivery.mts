import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path, { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createJiti } from "jiti";
import ts from "typescript";

type CommonJsModule = { exports: Record<string, unknown> };
type CommonJsFactory = (
  require: (specifier: string) => unknown,
  targetModule: CommonJsModule,
  exports: Record<string, unknown>,
  filename: string,
  directory: string,
) => void;

type QueryError = {
  code: string;
  message: string;
};

type QueryResult = {
  data: unknown;
  error: QueryError | null;
  count?: number | null;
};

type QueryOperation = {
  method: string;
  args: unknown[];
};

type QueryPlanStep = {
  label: string;
  table: string;
  result?: QueryResult;
  thrown?: Error;
  inspect?: (operations: readonly QueryOperation[]) => void;
};

type PublicCollectionResult = {
  featured: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

type PublicFilterOptions = {
  categories: Array<{ slug: string; name: string }>;
  series: Array<{ slug: string; name: string }>;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const read = (filename: string) =>
  readFileSync(resolve(ROOT, filename), "utf8").replace(/^\uFEFF/u, "");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function loadTranspiledModule(
  filename: string,
  overrides: Record<string, unknown> = {},
) {
  const absoluteFilename = resolve(ROOT, filename);
  const compiled = ts.transpileModule(read(filename), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteFilename,
  }).outputText;
  const targetModule: CommonJsModule = { exports: {} };
  const wrapper = new vm.Script(
    `(function (require, module, exports, __filename, __dirname) { ${compiled}\n})`,
    { filename: absoluteFilename },
  );
  const factory = wrapper.runInThisContext() as CommonJsFactory;
  factory(
    (specifier) =>
      Object.prototype.hasOwnProperty.call(overrides, specifier)
        ? overrides[specifier]
        : nativeRequire(specifier),
    targetModule,
    targetModule.exports,
    absoluteFilename,
    dirname(absoluteFilename),
  );
  return targetModule.exports;
}

const queryPlan: QueryPlanStep[] = [];
const queryLog: Array<{
  label: string;
  table: string;
  operations: readonly QueryOperation[];
}> = [];

function replaceQueryPlan(steps: QueryPlanStep[]) {
  queryPlan.splice(0, queryPlan.length, ...steps);
}

function success(
  data: unknown,
  options: { count?: number | null } = {},
): QueryResult {
  return {
    data,
    error: null,
    ...(Object.prototype.hasOwnProperty.call(options, "count")
      ? { count: options.count }
      : {}),
  };
}

function failure(message: string): QueryResult {
  return {
    data: null,
    error: { code: "P1GHI", message },
    count: null,
  };
}

class SupabaseQueryMock implements PromiseLike<QueryResult> {
  readonly #operations: QueryOperation[] = [];
  readonly table: string;

  constructor(table: string) {
    this.table = table;
  }

  #record(method: string, args: unknown[]) {
    this.#operations.push({ method, args });
    return this;
  }

  select(...args: unknown[]) {
    return this.#record("select", args);
  }

  in(...args: unknown[]) {
    return this.#record("in", args);
  }

  eq(...args: unknown[]) {
    return this.#record("eq", args);
  }

  is(...args: unknown[]) {
    return this.#record("is", args);
  }

  not(...args: unknown[]) {
    return this.#record("not", args);
  }

  neq(...args: unknown[]) {
    return this.#record("neq", args);
  }

  or(...args: unknown[]) {
    return this.#record("or", args);
  }

  order(...args: unknown[]) {
    return this.#record("order", args);
  }

  range(...args: unknown[]) {
    return this.#record("range", args);
  }

  limit(...args: unknown[]) {
    return this.#record("limit", args);
  }

  maybeSingle(...args: unknown[]) {
    return this.#record("maybeSingle", args);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => {
        const step = queryPlan.shift();
        assert.ok(
          step,
          `Unexpected Supabase query for ${this.table}: ${JSON.stringify(this.#operations)}`,
        );
        assert.equal(
          this.table,
          step.table,
          `${step.label}: expected ${step.table}, received ${this.table}`,
        );
        step.inspect?.(this.#operations);
        queryLog.push({
          label: step.label,
          table: this.table,
          operations: [...this.#operations],
        });
        if (step.thrown) throw step.thrown;
        assert.ok(step.result, `${step.label}: missing mock query result`);
        return step.result;
      })
      .then(onfulfilled, onrejected);
  }
}

const cacheEntries = new Map<string, unknown>();
let cacheHits = 0;
let cacheWrites = 0;

function unstableCacheMock<Args extends unknown[], Result>(
  callback: (...args: Args) => Promise<Result> | Result,
  keyParts: readonly unknown[] = [],
) {
  return async (...args: Args): Promise<Result> => {
    const key = JSON.stringify([keyParts, args]);
    if (cacheEntries.has(key)) {
      cacheHits += 1;
      return cacheEntries.get(key) as Result;
    }

    // This is deliberately fulfilled-only: a rejected callback never writes.
    const result = await callback(...args);
    cacheEntries.set(key, result);
    cacheWrites += 1;
    return result;
  };
}

function resetScenario() {
  replaceQueryPlan([]);
  queryLog.length = 0;
  cacheEntries.clear();
  cacheHits = 0;
  cacheWrites = 0;
}

async function verifyInstalledNextCacheRejectsWithoutWriting() {
  type IncrementalCacheGlobal = typeof globalThis & {
    AsyncLocalStorage?: typeof AsyncLocalStorage;
    __incrementalCache?: unknown;
  };

  const cacheGlobal = globalThis as IncrementalCacheGlobal;
  const hadIncrementalCache = Object.prototype.hasOwnProperty.call(
    cacheGlobal,
    "__incrementalCache",
  );
  const previousIncrementalCache = cacheGlobal.__incrementalCache;
  const hadAsyncLocalStorage = Object.prototype.hasOwnProperty.call(
    cacheGlobal,
    "AsyncLocalStorage",
  );
  const previousAsyncLocalStorage = cacheGlobal.AsyncLocalStorage;
  const stored = new Map<string, unknown>();
  let sourceAttempts = 0;
  let setCalls = 0;

  cacheGlobal.AsyncLocalStorage = AsyncLocalStorage;
  cacheGlobal.__incrementalCache = {
    isOnDemandRevalidate: false,
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => stored.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      setCalls += 1;
      stored.set(key, { value, isStale: false });
    },
  };

  try {
    const { unstable_cache: nextUnstableCache } = await import("next/cache.js");
    const cached = nextUnstableCache(
      async () => {
        sourceAttempts += 1;
        if (sourceAttempts === 1) {
          throw new Error("installed Next cache transient failure");
        }
        return { status: "recovered" as const };
      },
      ["p1-ghi-installed-next-cache"],
      { revalidate: 300, tags: ["p1-ghi-proof"] },
    );

    await assert.rejects(cached);
    check(
      "installed Next unstable_cache does not call set for a rejection",
      setCalls === 0 && stored.size === 0,
    );
    check(
      "installed Next unstable_cache retries the source after rejection",
      (await cached()).status === "recovered" &&
        sourceAttempts === 2 &&
        setCalls === 1,
    );
    check(
      "installed Next unstable_cache reuses only the fulfilled recovery",
      (await cached()).status === "recovered" &&
        sourceAttempts === 2 &&
        setCalls === 1,
    );
  } finally {
    if (hadIncrementalCache) {
      cacheGlobal.__incrementalCache = previousIncrementalCache;
    } else {
      delete cacheGlobal.__incrementalCache;
    }
    if (hadAsyncLocalStorage) {
      cacheGlobal.AsyncLocalStorage = previousAsyncLocalStorage;
    } else {
      Reflect.deleteProperty(cacheGlobal, "AsyncLocalStorage");
    }
  }
}

async function expectQueryFailure(
  label: string,
  operation: () => Promise<unknown>,
) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }

  check(`${label} rejects instead of resolving fallback data`, caught instanceof Error);
  const code = (caught as Error & { code?: unknown }).code;
  check(`${label} keeps semantic query-failure identity`, code === "query_failed");
  return caught;
}

async function expectContractFailure(
  label: string,
  operation: () => Promise<unknown>,
) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }

  check(`${label} rejects instead of resolving invalid Rich Media`, caught instanceof Error);
  const code = (caught as Error & { code?: unknown }).code;
  check(`${label} keeps semantic contract-failure identity`, code === "contract_failed");
  return caught;
}

async function captureFailure(operation: () => Promise<unknown>) {
  try {
    await operation();
    return null;
  } catch (error) {
    return error;
  }
}

function assertPlanConsumed(label: string) {
  check(`${label} consumes the exact Supabase plan`, queryPlan.length === 0);
}

const jiti = createJiti(import.meta.url);
const contentTypes = await jiti.import<Record<string, unknown>>(
  "../src/lib/admin/content/content-types.ts",
);
const categoryHierarchy = await jiti.import<Record<string, unknown>>(
  "../src/lib/admin/content/category-hierarchy.ts",
);
const mediaPayload = await jiti.import<Record<string, unknown>>(
  "../src/lib/admin/media-topic-payload.ts",
);
const contentDates = await jiti.import<Record<string, unknown>>(
  "../src/lib/content-dates.ts",
);
const readingTime = await jiti.import<Record<string, unknown>>(
  "../src/lib/content/reading-time.ts",
);
const publicContentPath = await jiti.import<Record<string, unknown>>(
  "../src/lib/content/public-content-path.ts",
);
const publicContract = await jiti.import<Record<string, unknown>>(
  "../src/lib/content/public-content-read/contract.ts",
);

const loggedFailures: Array<{ message: unknown; error: unknown }> = [];
const owner = loadTranspiledModule(
  "src/lib/content/public-content-read/owner.ts",
  {
    "server-only": {},
    "next/cache": { unstable_cache: unstableCacheMock },
    react: {
      // React cache is render-pass/request memoization. Identity here models a
      // fresh request for the required transient-failure recovery proof.
      cache: <FunctionType extends (...args: never[]) => unknown>(
        callback: FunctionType,
      ) => callback,
    },
    "../../admin/content/content-types": contentTypes,
    "../../admin/content/category-hierarchy": categoryHierarchy,
    "../../admin/media-topic-payload": mediaPayload,
    "../../content-dates": contentDates,
    "../../logging": {
      logError: (message: unknown, error: unknown) => {
        loggedFailures.push({ message, error });
      },
    },
    "../../media/resolve-local-public-image": {
      resolveLocalPublicImage: (
        source: string | null | undefined,
        fallback: string,
      ) => source?.trim() || fallback,
    },
    "../../supabase-admin": {
      getSupabaseAdmin: () => ({
        from: (table: string) => new SupabaseQueryMock(table),
      }),
    },
    "../reading-time": readingTime,
    "../public-content-path": publicContentPath,
    "./contract": publicContract,
  },
);

const loadPublicContentCollection = owner.loadPublicContentCollection as (
  input: Record<string, unknown>,
) => Promise<PublicCollectionResult>;
const loadPublicContentDetail = owner.loadPublicContentDetail as (
  contentType: string,
  slug: string,
) => Promise<Record<string, unknown> | null>;
const loadPublicContentFilterOptions = owner.loadPublicContentFilterOptions as () =>
  Promise<PublicFilterOptions>;

const mediaTypes = await jiti.import<Record<string, unknown>>(
  "../src/lib/media-center/types.ts",
);
const mediaAdapter = loadTranspiledModule(
  "src/lib/media-center/adapt-topic-row.ts",
  {
    "../content/public-content-read/owner": owner,
    "../content/public-content-read/contract": publicContract,
    "./types": mediaTypes,
  },
);
const adaptPublicContentToMediaItem =
  mediaAdapter.adaptPublicContentToMediaItem as (
    item: Record<string, unknown>,
  ) => Record<string, unknown> | null;

const MARKDOWN_FIXTURE = [
  "## عنوان تمثيلي",
  "نص تمثيلي آمن.",
  "",
  "- عنصر أول",
  "- عنصر ثان",
  "",
  "[رابط داخلي](/topics/example)",
].join("\n");

const GALLERY_IMAGES = [
  {
    url: "https://cdn.example.test/gallery/second.jpg",
    alt: "الصورة الثانية أولًا",
    caption: "تعليق الترتيب الأول",
  },
  {
    url: "https://cdn.example.test/gallery/first.jpg",
    alt: "الصورة الأولى ثانيًا",
    caption: "تعليق الترتيب الثاني",
  },
  {
    url: "https://cdn.example.test/gallery/third.jpg",
    alt: "الصورة الثالثة",
    caption: null,
  },
] as const;

function topicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    slug: "p1-ghi-fixture",
    title: "P1 GHI fixture",
    excerpt: "Representative excerpt",
    content: MARKDOWN_FIXTURE,
    image: "https://cdn.example.test/canonical-cover.jpg",
    image_alt: "Canonical cover alt",
    category: "Category",
    category_slug: "category",
    series: "Series",
    series_slug: "series",
    date_label: "10 سبتمبر 2026",
    published_at: "2026-09-10T12:00:00.000Z",
    updated_at: "2026-09-10T12:00:00.000Z",
    content_type: "article",
    is_featured: false,
    is_popular: false,
    media_payload: null,
    media_kind: null,
    media_duration: null,
    media_thumbnail: null,
    media_gallery_cover: null,
    media_gallery_cover_alt: null,
    media_project: null,
    seo_title: "",
    seo_description: "",
    seo_keywords: [],
    focus_keyword: "",
    canonical_url: "",
    robots_index: true,
    robots_follow: true,
    og_image: "",
    og_image_alt: "",
    faq: [],
    show_title_on_page: true,
    show_image_on_page: true,
    show_excerpt_on_page: true,
    show_date_on_page: true,
    show_category_on_page: true,
    show_series_on_page: true,
    show_intro_card_on_page: true,
    show_faq_on_page: true,
    show_faq_title_on_page: true,
    ...overrides,
  };
}

function rangeIs(from: number, to: number) {
  return (operations: readonly QueryOperation[]) => {
    const range = operations.findLast(
      (operation) => operation.method === "range",
    );
    assert.deepEqual(range?.args, [from, to]);
  };
}

await verifyInstalledNextCacheRejectsWithoutWriting();

// The cache double itself must never write a rejected value and must retain a
// successful value. Every owner recovery scenario below then proves it uses
// this fulfilled-only boundary correctly.
resetScenario();
let directCacheAttempts = 0;
const directlyCached = unstableCacheMock(async () => {
  directCacheAttempts += 1;
  if (directCacheAttempts === 1) throw new Error("transient direct failure");
  return "recovered";
}, ["fulfilled-only-contract"]);
await assert.rejects(directlyCached);
check("rejected cache callback writes no entry", cacheWrites === 0);
check("second cache attempt reaches its source", (await directlyCached()) === "recovered");
check("fulfilled cache callback writes exactly once", cacheWrites === 1);
check("valid cached data remains reusable", (await directlyCached()) === "recovered");
check("valid cache hit avoids a third source call", directCacheAttempts === 2 && cacheHits === 1);

resetScenario();
replaceQueryPlan([
  {
    label: "collection data",
    table: "topics",
    result: success([topicRow()], { count: 1 }),
  },
]);
const collectionData = await loadPublicContentCollection({
  contentTypes: ["article"],
  page: 1,
  pageSize: 12,
});
check(
  "collection Data is distinct and complete",
  collectionData.items.length === 1 &&
    collectionData.items[0]?.slug === "p1-ghi-fixture" &&
    collectionData.totalCount === 1,
);
assertPlanConsumed("collection Data");
const collectionReadsAfterData = queryLog.length;
await loadPublicContentCollection({
  contentTypes: ["article"],
  page: 1,
  pageSize: 12,
});
check(
  "valid collection result retains current cache behavior",
  queryLog.length === collectionReadsAfterData && cacheHits === 1,
);

const COLLECTION_GALLERY_COVER =
  "https://cdn.example.test/gallery/projected-cover.jpg";
const COLLECTION_GALLERY_COVER_ALT = "وصف الغلاف المحفوظ في المعرض";
let observedRichMediaCollectionProjection = false;
resetScenario();
replaceQueryPlan([
  {
    label: "collection Gallery projection aliases",
    table: "topics",
    inspect: (operations) => {
      const select = operations.find(
        (operation) => operation.method === "select",
      );
      const projection = select?.args[0];
      if (typeof projection !== "string") {
        throw new TypeError("Collection select projection must be a string.");
      }
      assert.ok(
        projection.includes("media_kind:media_payload->>kind") &&
          projection.includes(
            "media_gallery_cover:media_payload->images->0->>url",
          ) &&
          projection.includes(
            "media_gallery_cover_alt:media_payload->images->0->>alt",
          ) &&
          projection.includes("media_thumbnail:media_payload->>thumbnail"),
      );
      observedRichMediaCollectionProjection = true;
    },
    result: success(
      [
        topicRow({
          id: 108,
          slug: "collection-gallery-projection",
          content_type: "gallery",
          image: "https://cdn.example.test/gallery/legacy-explicit-cover.jpg",
          image_alt: "Legacy explicit cover alt",
          media_kind: "gallery",
          media_gallery_cover: COLLECTION_GALLERY_COVER,
          media_gallery_cover_alt: COLLECTION_GALLERY_COVER_ALT,
        }),
      ],
      { count: 1 },
    ),
  },
]);
const galleryCollection = await loadPublicContentCollection({
  contentTypes: ["gallery"],
  page: 1,
  pageSize: 17,
});
const galleryCollectionItem = galleryCollection.items[0];
check(
  "Collection query dynamically requests every Rich Media projection alias",
  observedRichMediaCollectionProjection,
);
check(
  "Collection Gallery gives the persisted payload cover priority over the legacy image field",
  galleryCollectionItem?.image === COLLECTION_GALLERY_COVER,
);
check(
  "Collection Gallery preserves the projected payload cover Alt",
  galleryCollectionItem?.imageAlt === COLLECTION_GALLERY_COVER_ALT &&
    galleryCollectionItem.mediaKind === "gallery",
);
assertPlanConsumed("Collection Gallery projection aliases");

const COLLECTION_VIDEO_THUMBNAIL =
  "https://cdn.example.test/video/projected-thumbnail.jpg";
resetScenario();
replaceQueryPlan([
  {
    label: "collection Video projection aliases",
    table: "topics",
    result: success(
      [
        topicRow({
          id: 109,
          slug: "collection-video-projection",
          content_type: "video",
          image: "https://cdn.example.test/video/legacy-explicit-cover.jpg",
          image_alt: "وصف الصورة المصغرة المنشورة",
          media_kind: "video",
          media_thumbnail: COLLECTION_VIDEO_THUMBNAIL,
          media_duration: "8:04",
        }),
      ],
      { count: 1 },
    ),
  },
]);
const videoCollection = await loadPublicContentCollection({
  contentTypes: ["video"],
  page: 1,
  pageSize: 18,
});
const videoCollectionItem = videoCollection.items[0];
const adaptedCollectionVideo = videoCollectionItem
  ? adaptPublicContentToMediaItem(videoCollectionItem)
  : null;
check(
  "Collection Video gives media_payload thumbnail priority over the legacy image field",
  videoCollectionItem?.image === COLLECTION_VIDEO_THUMBNAIL,
);
check(
  "Collection Video adapter preserves projected thumbnail, type, duration, and Alt",
  adaptedCollectionVideo?.image === COLLECTION_VIDEO_THUMBNAIL &&
    adaptedCollectionVideo.type === "video" &&
    adaptedCollectionVideo.duration === "8:04" &&
    adaptedCollectionVideo.imageAlt === "وصف الصورة المصغرة المنشورة",
);
assertPlanConsumed("Collection Video projection aliases");

resetScenario();
const mismatchedCollectionInput = {
  contentTypes: ["gallery"],
  page: 1,
  pageSize: 19,
};
replaceQueryPlan([
  {
    label: "mismatched collection Rich Media kind",
    table: "topics",
    result: success(
      [
        topicRow({
          id: 110,
          slug: "mismatched-collection-rich-media",
          content_type: "gallery",
          image: "",
          media_kind: "video",
          media_thumbnail: COLLECTION_VIDEO_THUMBNAIL,
        }),
      ],
      { count: 1 },
    ),
  },
]);
await expectContractFailure("Collection mismatched Rich Media kind", () =>
  loadPublicContentCollection(mismatchedCollectionInput),
);
check(
  "Collection Rich Media contract failure writes no false collection cache entry",
  cacheWrites === 0,
);
replaceQueryPlan([
  {
    label: "collection Rich Media recovery",
    table: "topics",
    result: success(
      [
        topicRow({
          id: 111,
          slug: "collection-rich-media-recovered",
          content_type: "gallery",
          image: "",
          media_kind: "gallery",
          media_gallery_cover: COLLECTION_GALLERY_COVER,
          media_gallery_cover_alt: COLLECTION_GALLERY_COVER_ALT,
        }),
      ],
      { count: 1 },
    ),
  },
]);
const recoveredRichMediaCollection = await loadPublicContentCollection(
  mismatchedCollectionInput,
);
check(
  "Collection request after Rich Media contract failure reaches source and succeeds",
  recoveredRichMediaCollection.items[0]?.slug ===
    "collection-rich-media-recovered" && queryLog.length === 2,
);
check(
  "Collection cache stores only the valid Rich Media recovery",
  cacheWrites === 1,
);
assertPlanConsumed("Collection Rich Media contract recovery");

resetScenario();
replaceQueryPlan([
  {
    label: "genuine empty collection",
    table: "topics",
    result: success([], { count: 0 }),
  },
]);
const genuineEmpty = await loadPublicContentCollection({
  contentTypes: ["article"],
  page: 1,
  pageSize: 7,
});
check(
  "genuine Empty remains a successful zero-result collection",
  genuineEmpty.items.length === 0 &&
    genuineEmpty.totalCount === 0 &&
    genuineEmpty.page === 1 &&
    genuineEmpty.totalPages === 1,
);
assertPlanConsumed("genuine Empty");

resetScenario();
const collectionRecoveryInput = {
  contentTypes: ["article"],
  page: 1,
  pageSize: 9,
};
replaceQueryPlan([
  {
    label: "collection query failure",
    table: "topics",
    result: failure("collection source unavailable"),
  },
]);
await expectQueryFailure("collection Query Failure", () =>
  loadPublicContentCollection(collectionRecoveryInput),
);
check("collection Query Failure is not cached", cacheWrites === 0);
replaceQueryPlan([
  {
    label: "collection recovery",
    table: "topics",
    result: success([topicRow({ id: 102, slug: "collection-recovered" })], {
      count: 1,
    }),
  },
]);
const recoveredCollection = await loadPublicContentCollection(
  collectionRecoveryInput,
);
check(
  "request after collection failure reaches source and succeeds",
  recoveredCollection.items[0]?.slug === "collection-recovered" &&
    queryLog.length === 2,
);
check("recovered collection success is cached", cacheWrites === 1);
await loadPublicContentCollection(collectionRecoveryInput);
check(
  "recovered collection cache serves only valid data",
  queryLog.length === 2 && cacheHits === 1,
);
assertPlanConsumed("collection recovery");

resetScenario();
replaceQueryPlan([
  {
    label: "collection null exact count",
    table: "topics",
    result: success([], { count: null }),
  },
]);
const nullCollectionCountFailure = await captureFailure(() =>
  loadPublicContentCollection({
    contentTypes: ["article"],
    page: 1,
    pageSize: 16,
  }),
);
check(
  "collection count:null is contract_failed and is never cached",
  (nullCollectionCountFailure as { code?: unknown } | null)?.code ===
    "contract_failed" && cacheWrites === 0,
);
assertPlanConsumed("collection null exact count");

resetScenario();
const thrownRecoveryInput = {
  contentTypes: ["article"],
  page: 1,
  pageSize: 10,
};
replaceQueryPlan([
  {
    label: "collection thrown exception",
    table: "topics",
    thrown: new Error("transport exception"),
  },
]);
await assert.rejects(() => loadPublicContentCollection(thrownRecoveryInput));
check("thrown query exception is not cached", cacheWrites === 0);
replaceQueryPlan([
  {
    label: "collection recovery after exception",
    table: "topics",
    result: success([topicRow({ id: 103, slug: "exception-recovered" })], {
      count: 1,
    }),
  },
]);
const exceptionRecovery = await loadPublicContentCollection(
  thrownRecoveryInput,
);
check(
  "request after thrown query exception can succeed",
  exceptionRecovery.items[0]?.slug === "exception-recovered" &&
    queryLog.length === 2,
);
assertPlanConsumed("thrown exception recovery");

resetScenario();
const searchInput = {
  contentTypes: ["article"],
  page: 1,
  pageSize: 11,
  search: "فينيسيا",
};
replaceQueryPlan([
  {
    label: "uncached search failure",
    table: "topics",
    result: failure("search query failed"),
  },
]);
await expectQueryFailure("search Query Failure", () =>
  loadPublicContentCollection(searchInput),
);
replaceQueryPlan([
  {
    label: "uncached search recovery",
    table: "topics",
    result: success([topicRow({ id: 104, slug: "search-recovered" })], {
      count: 1,
    }),
  },
]);
const recoveredSearch = await loadPublicContentCollection(searchInput);
check(
  "search failure is not Empty and the next request succeeds",
  recoveredSearch.items[0]?.slug === "search-recovered" &&
    queryLog.length === 2 &&
    cacheWrites === 0,
);
assertPlanConsumed("search recovery");

resetScenario();
replaceQueryPlan([
  {
    label: "genuine detail not found",
    table: "topics",
    result: success(null),
  },
]);
const genuineNotFound = await loadPublicContentDetail(
  "article",
  "genuine-not-found",
);
check("genuine Not Found remains distinct as null", genuineNotFound === null);
assertPlanConsumed("genuine Not Found");
await loadPublicContentDetail("article", "genuine-not-found");
check(
  "genuine Not Found retains current valid cache behavior",
  queryLog.length === 1 && cacheHits === 1,
);

resetScenario();
replaceQueryPlan([
  {
    label: "detail query failure",
    table: "topics",
    result: failure("detail source unavailable"),
  },
]);
await expectQueryFailure("detail Query Failure", () =>
  loadPublicContentDetail("article", "detail-recovery"),
);
check("detail Query Failure is not cached as Not Found", cacheWrites === 0);
replaceQueryPlan([
  {
    label: "detail recovery",
    table: "topics",
    result: success(topicRow({ id: 105, slug: "detail-recovery" })),
  },
]);
const recoveredDetail = await loadPublicContentDetail(
  "article",
  "detail-recovery",
);
check(
  "request after detail failure reaches source and succeeds",
  recoveredDetail?.slug === "detail-recovery" && queryLog.length === 2,
);
check("recovered detail success is cached", cacheWrites === 1);
await loadPublicContentDetail("article", "detail-recovery");
check(
  "recovered detail cache cannot replay the earlier failure",
  queryLog.length === 2 && cacheHits === 1,
);
assertPlanConsumed("detail recovery");

async function verifyFilterOptionFailure(
  failedTable: "topic_categories" | "topic_series",
) {
  resetScenario();
  replaceQueryPlan([
    {
      label: `${failedTable} filter options`,
      table: "topic_categories",
      result:
        failedTable === "topic_categories"
          ? failure("category options failed")
          : success([{ slug: "category", name: "Category" }]),
    },
    {
      label: `${failedTable} filter options`,
      table: "topic_series",
      result:
        failedTable === "topic_series"
          ? failure("series options failed")
          : success([{ slug: "series", name: "Series" }]),
    },
  ]);
  await expectQueryFailure(`${failedTable} filter-options failure`, () =>
    loadPublicContentFilterOptions(),
  );
  check(`${failedTable} filter-options failure is not cached`, cacheWrites === 0);
  replaceQueryPlan([
    {
      label: `${failedTable} filter options recovery`,
      table: "topic_categories",
      result: success([{ slug: "category", name: "Category" }]),
    },
    {
      label: `${failedTable} filter options recovery`,
      table: "topic_series",
      result: success([{ slug: "series", name: "Series" }]),
    },
  ]);
  const recovered = await loadPublicContentFilterOptions();
  check(
    `${failedTable} filter-options next request succeeds without partial truth`,
    recovered.categories.length === 1 &&
      recovered.series.length === 1 &&
      queryLog.length === 4,
  );
  check(`${failedTable} recovered filter options are cached`, cacheWrites === 1);
  await loadPublicContentFilterOptions();
  check(
    `${failedTable} filter-options cache contains only recovered data`,
    queryLog.length === 4 && cacheHits === 1,
  );
  assertPlanConsumed(`${failedTable} filter-options recovery`);
}

await verifyFilterOptionFailure("topic_categories");
await verifyFilterOptionFailure("topic_series");

resetScenario();
replaceQueryPlan([
  {
    label: "category filter options null data",
    table: "topic_categories",
    result: success(null),
  },
  {
    label: "series filter options paired success",
    table: "topic_series",
    result: success([]),
  },
]);
const nullFilterOptionsFailure = await captureFailure(() =>
  loadPublicContentFilterOptions(),
);
check(
  "filter-options data:null/error:null is contract_failed and is never cached",
  (nullFilterOptionsFailure as { code?: unknown } | null)?.code ===
    "contract_failed" && cacheWrites === 0,
);
assertPlanConsumed("filter-options null data");

resetScenario();
const hierarchyInput = {
  contentTypes: ["article"],
  page: 1,
  pageSize: 13,
  categorySlugs: ["parent"],
};
replaceQueryPlan([
  {
    label: "category hierarchy failure",
    table: "topic_categories",
    result: failure("hierarchy unavailable"),
  },
  {
    // A fallback implementation will consume this and falsely resolve Data;
    // the correct implementation throws before issuing this collection read.
    label: "forbidden collection fallback after hierarchy failure",
    table: "topics",
    result: success([topicRow()], { count: 1 }),
  },
]);
await expectQueryFailure("category-hierarchy Query Failure", () =>
  loadPublicContentCollection(hierarchyInput),
);
check(
  "category-hierarchy failure stops before a narrowed collection fallback",
  queryLog.length === 1 && cacheWrites === 0,
);
replaceQueryPlan([
  {
    label: "category hierarchy recovery",
    table: "topic_categories",
    result: success([
      {
        id: 1,
        name: "Parent",
        slug: "parent",
        parent_id: null,
        sort_order: 1,
        is_active: true,
        status: "published",
      },
      {
        id: 2,
        name: "Child",
        slug: "child",
        parent_id: 1,
        sort_order: 2,
        is_active: true,
        status: "published",
      },
    ]),
  },
  {
    label: "collection after hierarchy recovery",
    table: "topics",
    inspect: (operations) => {
      const categoryFilter = operations.find(
        (operation) =>
          operation.method === "in" &&
          operation.args[0] === "category_slug",
      );
      assert.deepEqual(categoryFilter?.args[1], ["parent", "child"]);
    },
    result: success([topicRow({ id: 106, slug: "hierarchy-recovered" })], {
      count: 1,
    }),
  },
]);
const recoveredHierarchy = await loadPublicContentCollection(hierarchyInput);
check(
  "category-hierarchy next request reaches full source scope and succeeds",
  recoveredHierarchy.items[0]?.slug === "hierarchy-recovered" &&
    queryLog.length === 3,
);
assertPlanConsumed("category-hierarchy recovery");

async function verifyFeaturedFailure(mode: "manual" | "automatic") {
  resetScenario();
  const input = {
    contentTypes: ["article"],
    page: 1,
    pageSize: mode === "manual" ? 14 : 15,
    featuredSelection:
      mode === "manual"
        ? { mode: "manual", topicId: 901 }
        : { mode: "automatic" },
  };
  replaceQueryPlan([
    {
      label: `${mode} featured failure`,
      table: "topics",
      result: failure(`${mode} featured unavailable`),
    },
    {
      // A `return null` implementation will continue here and resolve a list.
      label: `forbidden list fallback after ${mode} featured failure`,
      table: "topics",
      result: success([topicRow()], { count: 1 }),
    },
  ]);
  await expectQueryFailure(`${mode} featured Query Failure`, () =>
    loadPublicContentCollection(input),
  );
  check(
    `${mode} featured failure cannot degrade to an unfeatured cached list`,
    queryLog.length === 1 && cacheWrites === 0,
  );

  const featuredId = mode === "manual" ? 901 : 902;
  replaceQueryPlan([
    {
      label: `${mode} featured recovery`,
      table: "topics",
      result: success([
        topicRow({
          id: featuredId,
          slug: `${mode}-featured-item`,
          is_featured: true,
        }),
      ]),
    },
    {
      label: `${mode} featured list recovery`,
      table: "topics",
      result: success(
        [topicRow({ id: featuredId + 10, slug: `${mode}-regular-item` })],
        { count: 1 },
      ),
    },
  ]);
  const recovered = await loadPublicContentCollection(input);
  check(
    `${mode} featured next request recovers featured and regular Data`,
    recovered.featured?.id === featuredId &&
      recovered.items[0]?.slug === `${mode}-regular-item` &&
      queryLog.length === 3,
  );
  check(`${mode} featured recovered Data is cached`, cacheWrites === 1);
  await loadPublicContentCollection(input);
  check(
    `${mode} featured cache reuses only valid recovered Data`,
    queryLog.length === 3 && cacheHits === 1,
  );
  assertPlanConsumed(`${mode} featured recovery`);
}

await verifyFeaturedFailure("manual");
await verifyFeaturedFailure("automatic");

resetScenario();
const normalizedPageInput = {
  contentTypes: ["article"],
  page: 3,
  pageSize: 2,
};
replaceQueryPlan([
  {
    label: "out-of-range page count",
    table: "topics",
    inspect: rangeIs(4, 5),
    result: success([], { count: 1 }),
  },
  {
    label: "normalized-page query failure",
    table: "topics",
    inspect: rangeIs(0, 1),
    result: failure("normalized page failed"),
  },
]);
await expectQueryFailure("normalized-page Query Failure", () =>
  loadPublicContentCollection(normalizedPageInput),
);
check("normalized-page failure is not cached as Empty", cacheWrites === 0);
replaceQueryPlan([
  {
    label: "out-of-range page count recovery",
    table: "topics",
    inspect: rangeIs(4, 5),
    result: success([], { count: 1 }),
  },
  {
    label: "normalized-page recovery",
    table: "topics",
    inspect: rangeIs(0, 1),
    result: success([topicRow({ id: 107, slug: "normalized-recovered" })]),
  },
]);
const normalizedRecovery = await loadPublicContentCollection(
  normalizedPageInput,
);
check(
  "normalized-page next request reaches source and returns Data",
  normalizedRecovery.items[0]?.slug === "normalized-recovered" &&
    normalizedRecovery.page === 1 &&
    normalizedRecovery.totalCount === 1 &&
    queryLog.length === 4,
);
check("normalized-page recovered Data is cached", cacheWrites === 1);
assertPlanConsumed("normalized-page recovery");

function findGalleryImages(value: unknown): unknown[] | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as { url?: unknown }).url === "string",
      )
    ) {
      return value;
    }
    for (const item of value) {
      const nested = findGalleryImages(item);
      if (nested) return nested;
    }
    return null;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findGalleryImages(nestedValue);
    if (nested) return nested;
  }
  return null;
}

resetScenario();
replaceQueryPlan([
  {
    label: "gallery detail Rich Media",
    table: "topics",
    result: success(
      topicRow({
        id: 201,
        slug: "gallery-rich-media",
        content_type: "gallery",
        image: "",
        image_alt: "Gallery cover alt",
        media_payload: {
          kind: "gallery",
          images: GALLERY_IMAGES,
        },
      }),
    ),
  },
]);
const galleryDetail = await loadPublicContentDetail(
  "gallery",
  "gallery-rich-media",
);
check("gallery detail resolves as Data", Boolean(galleryDetail));
check(
  "Public Content Read preserves Gallery order, URL identity, Alt, and Caption",
  JSON.stringify(findGalleryImages(galleryDetail)) ===
    JSON.stringify(GALLERY_IMAGES),
);
check(
  "Gallery legal cover is the first persisted Gallery identity when no explicit cover exists",
  galleryDetail?.image === GALLERY_IMAGES[0].url &&
    galleryDetail.imageAlt === GALLERY_IMAGES[0].alt,
);
const adaptedGallery = galleryDetail
  ? adaptPublicContentToMediaItem(galleryDetail)
  : null;
check("Gallery adapter produces a public Media item", Boolean(adaptedGallery));
check(
  "Gallery adapter preserves the complete ordered Rich Media contract",
  JSON.stringify(findGalleryImages(adaptedGallery)) ===
    JSON.stringify(GALLERY_IMAGES),
);
check(
  "Gallery captions never replace published Markdown body",
  adaptedGallery?.content === MARKDOWN_FIXTURE,
);
assertPlanConsumed("Gallery Rich Media");

const VIDEO_THUMBNAIL = "https://cdn.example.test/video/thumbnail.jpg";
resetScenario();
replaceQueryPlan([
  {
    label: "video thumbnail detail",
    table: "topics",
    result: success(
      topicRow({
        id: 202,
        slug: "video-thumbnail",
        content_type: "video",
        image: "",
        image_alt: "Video thumbnail alt",
        media_payload: {
          kind: "video",
          provider: "youtube",
          video_url: "https://youtu.be/dQw4w9WgXcQ",
          thumbnail: VIDEO_THUMBNAIL,
          duration: "3:32",
        },
      }),
    ),
  },
]);
const videoDetail = await loadPublicContentDetail("video", "video-thumbnail");
const adaptedVideo = videoDetail
  ? adaptPublicContentToMediaItem(videoDetail)
  : null;
check("Video detail and adapter produce Data", Boolean(videoDetail && adaptedVideo));
check(
  "legal Video thumbnail reaches the public Media contract without arbitrary fallback",
  videoDetail?.image === VIDEO_THUMBNAIL &&
    adaptedVideo?.image === VIDEO_THUMBNAIL &&
    adaptedVideo?.imageAlt === "Video thumbnail alt",
);
assertPlanConsumed("Video thumbnail");

async function verifyInvalidRichMediaDetail(
  label: string,
  contentType: "gallery" | "video",
  slug: string,
  overrides: Record<string, unknown>,
) {
  resetScenario();
  replaceQueryPlan([
    {
      label,
      table: "topics",
      result: success(
        topicRow({
          id: contentType === "gallery" ? 301 : 302,
          slug,
          content_type: contentType,
          image: "",
          ...overrides,
        }),
      ),
    },
  ]);
  await expectContractFailure(label, () =>
    loadPublicContentDetail(contentType, slug),
  );
  check(`${label} writes no false Detail cache entry`, cacheWrites === 0);
  assertPlanConsumed(label);
}

await verifyInvalidRichMediaDetail(
  "Gallery Detail with zero images",
  "gallery",
  "gallery-zero-images",
  {
    media_payload: { kind: "gallery", images: [] },
  },
);
await verifyInvalidRichMediaDetail(
  "Gallery Detail with a blank image URL",
  "gallery",
  "gallery-blank-image-url",
  {
    media_payload: {
      kind: "gallery",
      images: [
        {
          url: "https://cdn.example.test/gallery/valid-first.jpg",
          alt: "صورة أولى صالحة",
          caption: null,
        },
        { url: "   ", alt: "صورة بلا رابط", caption: "تعليق" },
      ],
    },
  },
);
await verifyInvalidRichMediaDetail(
  "Gallery Detail with mismatched Video payload",
  "gallery",
  "gallery-video-payload-mismatch",
  {
    media_payload: {
      kind: "video",
      provider: "youtube",
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      thumbnail: VIDEO_THUMBNAIL,
      duration: null,
    },
  },
);
await verifyInvalidRichMediaDetail(
  "Gallery Detail with malformed payload",
  "gallery",
  "gallery-malformed-payload",
  {
    media_payload: {
      kind: "gallery",
      images: [{ url: 42, alt: "نوع رابط غير صالح", caption: null }],
    },
  },
);
await verifyInvalidRichMediaDetail(
  "Video Detail with invalid YouTube URL",
  "video",
  "video-invalid-youtube",
  {
    media_payload: {
      kind: "video",
      provider: "youtube",
      video_url: "https://example.test/not-youtube",
      thumbnail: VIDEO_THUMBNAIL,
      duration: "1:23",
    },
  },
);
await verifyInvalidRichMediaDetail(
  "Video Detail with mismatched Gallery payload",
  "video",
  "video-gallery-payload-mismatch",
  {
    media_payload: {
      kind: "gallery",
      images: [
        {
          url: "https://cdn.example.test/gallery/not-a-video.jpg",
          alt: "بيانات معرض لا فيديو",
          caption: null,
        },
      ],
    },
  },
);
await verifyInvalidRichMediaDetail(
  "Video Detail with malformed payload",
  "video",
  "video-malformed-payload",
  {
    media_payload: {
      kind: "video",
      provider: "vimeo",
      video_url: "https://vimeo.com/123",
      thumbnail: VIDEO_THUMBNAIL,
      duration: null,
    },
  },
);

const richText = await jiti.import<Record<string, unknown>>(
  "../src/lib/rich-text/html-utils.ts",
);
const renderArticleMarkdownHtml = richText.renderArticleMarkdownHtml as (
  value: string,
) => string;
const renderedMarkdown = renderArticleMarkdownHtml(MARKDOWN_FIXTURE);
const renderedUnsafeMarkdown = renderArticleMarkdownHtml(
  "[خطر](javascript:alert(1)) <script>alert(1)</script>",
);
check(
  "representative Markdown renders semantic heading, text, list, and link",
  renderedMarkdown.includes("<h2>عنوان تمثيلي</h2>") &&
    renderedMarkdown.includes("<p>نص تمثيلي آمن.</p>") &&
    renderedMarkdown.includes("<ul><li>عنصر أول</li><li>عنصر ثان</li></ul>") &&
    renderedMarkdown.includes('href="/topics/example"'),
);
check(
  "representative Markdown retains shared link safety and strips executable HTML",
  renderedMarkdown.includes('rel="noopener noreferrer"') &&
    renderedMarkdown.includes('target="_blank"') &&
    !renderedUnsafeMarkdown.includes('href="javascript:') &&
    !renderedUnsafeMarkdown.includes("<script"),
);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

function catchClauses(sourceText: string, filename: string) {
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    extname(filename) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const clauses: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCatchClause(node)) clauses.push(node.block.getText(sourceFile));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return clauses;
}

function inspectMediaDetailArticleGallery(sourceText: string, filename: string) {
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const directGalleryMaps: string[] = [];
  const forbiddenGalleryTransforms: string[] = [];
  const publicMediaImageSources: string[] = [];
  const forbiddenMethods = new Set([
    "filter",
    "reverse",
    "slice",
    "sort",
    "splice",
    "toReversed",
    "toSorted",
  ]);

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const receiver = node.expression.expression;
      const method = node.expression.name.text;
      if (
        method === "map" &&
        ts.isPropertyAccessExpression(receiver) &&
        ts.isIdentifier(receiver.expression) &&
        receiver.expression.text === "item" &&
        receiver.name.text === "galleryImages"
      ) {
        directGalleryMaps.push(node.getText(sourceFile));
      }
      if (
        forbiddenMethods.has(method) &&
        receiver.getText(sourceFile).includes("galleryImages")
      ) {
        forbiddenGalleryTransforms.push(node.getText(sourceFile));
      }
    }

    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(sourceFile) === "PublicMediaImage"
    ) {
      const sourceAttribute = node.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "src",
      );
      if (
        sourceAttribute?.initializer &&
        ts.isJsxExpression(sourceAttribute.initializer) &&
        sourceAttribute.initializer.expression
      ) {
        publicMediaImageSources.push(
          sourceAttribute.initializer.expression.getText(sourceFile),
        );
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return {
    directGalleryMaps,
    forbiddenGalleryTransforms,
    publicMediaImageSources,
  };
}

const ownerSource = read("src/lib/content/public-content-read/owner.ts");
const productionSources = walk(resolve(ROOT, "src"))
  .filter((filename) => [".ts", ".tsx"].includes(extname(filename)))
  .map((filename) => ({
    filename,
    relativePath: relative(ROOT, filename).replaceAll("\\", "/"),
    source: readFileSync(filename, "utf8"),
  }));
const catchFallbackPattern =
  /\breturn\s+(?:null|\[\]|emptyCollection\b|EMPTY_RESULT\b)|(?:items|entries)\s*:\s*\[\]/u;
const ownerCatchFallbacks = catchClauses(
  ownerSource,
  "src/lib/content/public-content-read/owner.ts",
).filter((clause) => catchFallbackPattern.test(clause));
check(
  "Public Content Read owner has no catch-clause conversion to Empty or Not Found",
  ownerCatchFallbacks.length === 0,
);

const directConsumerSources = productionSources.filter(
  ({ relativePath, source }) =>
    relativePath !== "src/lib/content/public-content-read/owner.ts" &&
    (source.includes("public-content-read/owner") ||
      source.includes("public-content-read\"")),
);
const consumerCatchFallbacks = directConsumerSources.flatMap(
  ({ relativePath, source }) =>
    catchClauses(source, relativePath)
      .filter((clause) => catchFallbackPattern.test(clause))
      .map((clause) => ({ relativePath, clause })),
);
const isAllowedSitemapPartialSourceFallback = (fallback: {
  relativePath: string;
  clause: string;
}) =>
  fallback.relativePath === "src/lib/seo/generate-sitemap-entries.ts" &&
  fallback.clause.includes("source failed") &&
  fallback.clause.includes("continuing without it") &&
  fallback.clause.includes("entries: []") &&
  fallback.clause.includes("error:");
const allowedConsumerCatchFallbacks = consumerCatchFallbacks.filter(
  isAllowedSitemapPartialSourceFallback,
);
const unapprovedConsumerCatchFallbacks = consumerCatchFallbacks.filter(
  (fallback) => !isAllowedSitemapPartialSourceFallback(fallback),
);
check(
  "direct consumers contain no unapproved catch fallback that collapses Public Content failure",
  unapprovedConsumerCatchFallbacks.length === 0,
);
check(
  "the only allowed consumer fallback is the observable sitemap partial-source contract",
  allowedConsumerCatchFallbacks.length === 1 &&
    consumerCatchFallbacks.length === allowedConsumerCatchFallbacks.length,
);
check(
  "legacy query-error branches cannot return cached Empty or Not Found sentinels",
  !ownerSource.includes("return emptyCollection(input, featured)") &&
    !/if\s*\([^)]*\.error[^)]*\)\s*\{[\s\S]{0,500}?return\s+null/u.test(
      ownerSource,
    ),
);

const mediaAdapterSource = read("src/lib/media-center/adapt-topic-row.ts");
const mediaTypesSource = read("src/lib/media-center/types.ts");
const mediaDetailArticleSource = read(
  "src/components/media-center/MediaDetailArticle.tsx",
);
const mediaDetailArticleGallery = inspectMediaDetailArticleGallery(
  mediaDetailArticleSource,
  "src/components/media-center/MediaDetailArticle.tsx",
);
check(
  "Public Detail projection keeps media_payload at the Public Content Read owner",
  ownerSource.includes("PUBLIC_CONTENT_DETAIL_SELECT") &&
    ownerSource.includes("media_payload") &&
    ownerSource.includes("parseMediaTopicPayload(row.media_payload)"),
);
check(
  "Media adapter exposes Gallery data instead of converting captions into body paragraphs",
  mediaTypesSource.includes("galleryImages") &&
    mediaAdapterSource.includes("galleryImages") &&
    !mediaAdapterSource.includes("galleryCaptions") &&
    !mediaAdapterSource.includes("splitMarkdownParagraphs"),
);
check(
  "MediaDetailArticle directly maps the persisted Gallery array without an intermediate projection",
  mediaDetailArticleGallery.directGalleryMaps.length === 1,
);
const directGalleryMap = mediaDetailArticleGallery.directGalleryMaps[0] ?? "";
check(
  "MediaDetailArticle preserves Gallery order and cardinality without sort/filter/reverse/slice",
  mediaDetailArticleGallery.forbiddenGalleryTransforms.length === 0,
);
check(
  "MediaDetailArticle binds each persisted Gallery URL directly with no URL substitution",
  mediaDetailArticleGallery.publicMediaImageSources.length === 1 &&
    mediaDetailArticleGallery.publicMediaImageSources[0] === "image.url",
);
check(
  "MediaDetailArticle consumes Gallery Alt and Caption from the same direct map item",
  directGalleryMap.includes("image.alt") &&
    directGalleryMap.includes("image.caption") &&
    directGalleryMap.includes("<figcaption"),
);
check(
  "public Media Markdown adopts the existing sanitized RichTextContent owner",
  mediaDetailArticleSource.includes("RichTextContent") &&
    mediaDetailArticleSource.includes('mode="markdown"') &&
    !mediaDetailArticleSource.includes("content.map((paragraph)") &&
    !mediaDetailArticleSource.includes("function renderMarkdown") &&
    !mediaDetailArticleSource.includes("renderArticleMarkdownHtml("),
);

check(
  "failure diagnostics remain observable at the owner boundary",
  loggedFailures.length >= 8,
);

console.log(
  `verify:public-content-delivery passed (${passed} assertions; Data/Empty/Not Found/Query Failure/cache recovery/Rich Media/Markdown).`,
);
