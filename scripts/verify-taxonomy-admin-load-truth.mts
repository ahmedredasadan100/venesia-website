import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DATABASE_SENTINEL = "raw-database-secret-sentinel";

function loadTypeScriptModule(
  path: string,
  dependencies: Record<string, unknown> = {},
  jsx = false,
) {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} as Record<string, unknown> };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier: string) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unsupported dependency ${specifier} while loading ${path}`);
    },
  );
  return commonJsModule.exports;
}

type RuntimeLoadResult<T = unknown> = {
  status: string;
  data: T;
  error: Error & { code?: string };
};

async function callLoader<T = unknown>(
  owner: Record<string, unknown>,
  name: string,
  ...args: unknown[]
): Promise<RuntimeLoadResult<T>> {
  const candidate = owner[name];
  assert.equal(typeof candidate, "function", `${name} must be callable`);
  return (await (candidate as (...values: unknown[]) => unknown)(
    ...args,
  )) as RuntimeLoadResult<T>;
}

function callPage(page: Record<string, unknown>, ...args: unknown[]) {
  const candidate = page.default;
  assert.equal(typeof candidate, "function", "page default export must be callable");
  return (candidate as (...values: unknown[]) => unknown)(...args);
}

const categoryHierarchy = loadTypeScriptModule(
  "src/lib/admin/content/category-hierarchy.ts",
);

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createSupabase(
  responses: Record<string, Array<QueryResult | Promise<QueryResult>>>,
) {
  return {
    from(table: string) {
      const response = responses[table]?.shift();
      if (!response) throw new Error(`No fake response registered for ${table}`);

      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const method of ["select", "eq", "is", "order", "maybeSingle"]) {
        builder[method] = chain;
      }
      builder.then = (
        resolveResult: (value: QueryResult) => unknown,
        rejectResult: (reason: unknown) => unknown,
      ) => Promise.resolve(response).then(resolveResult, rejectResult);
      return builder;
    },
  };
}

function loadOwner(
  responses: Record<string, Array<QueryResult | Promise<QueryResult>>>,
) {
  const supabase = createSupabase(responses);
  return loadTypeScriptModule(
    "src/lib/admin/content/load-taxonomy-form-data.ts",
    {
      "server-only": {},
      "./category-hierarchy": categoryHierarchy,
      "../../supabase-admin": { getSupabaseAdmin: () => supabase },
    },
  );
}

const publishedCategory = {
  id: 10,
  name: "Published category",
  slug: "published-category",
  parent_id: null,
  sort_order: 1,
  is_active: true,
  status: "published",
  color_token: "gold",
};

const unpublishedCategory = {
  ...publishedCategory,
  id: 11,
  name: "Persisted unpublished category",
  slug: "persisted-unpublished-category",
  status: "unpublished",
};

const publishedSeries = {
  id: 20,
  name: "Published series",
  slug: "published-series",
  status: "published",
  deleted_at: null,
  category_id: 10,
};

const unpublishedSeries = {
  ...publishedSeries,
  id: 21,
  name: "Persisted unpublished series",
  slug: "persisted-unpublished-series",
  status: "unpublished",
  category_id: 11,
};

let passed = 0;
let failed = 0;

async function verify(label: string, assertion: () => unknown | Promise<unknown>) {
  try {
    await assertion();
    passed += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}`);
    console.error(error);
  }
}

async function captureError(action: () => unknown | Promise<unknown>) {
  try {
    await action();
    return null;
  } catch (error) {
    return error;
  }
}

function databaseError() {
  return { message: RAW_DATABASE_SENTINEL, code: "XX999" };
}

function marker(name: string) {
  return Object.assign(function ComponentMarker() {}, { displayName: name });
}

function defaultModule(value: unknown) {
  return { __esModule: true, default: value };
}

function createJsxRecorder() {
  const renders: Array<{ type: unknown; props: Record<string, unknown> }> = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => {
    const node = { type, props };
    renders.push(node);
    return node;
  };
  return {
    renders,
    runtime: { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  };
}

const ui = {
  AdminActionButton: marker("AdminActionButton"),
  AdminEntityPreviewActions: marker("AdminEntityPreviewActions"),
  AdminPageContextHeader: marker("AdminPageContextHeader"),
  AdminPageExperience: marker("AdminPageExperience"),
};

function makeNotFound() {
  const signal = new Error("NEXT_NOT_FOUND_TEST_SIGNAL");
  let calls = 0;
  return {
    signal,
    get calls() {
      return calls;
    },
    notFound() {
      calls += 1;
      throw signal;
    },
  };
}

async function runOwnerChecks() {
  await verify("existing Category record returns data with raw updated_at", async () => {
    const owner = loadOwner({
      topic_categories: [
        {
          data: {
            id: 1,
            name: "Category",
            slug: "category",
            parent_id: null,
            is_active: true,
            status: "published",
            color_token: "gold",
            updated_at: "2026-09-08T10:00:00.000Z",
          },
          error: null,
        },
      ],
    });
    const result = await callLoader<{ id: number; updated_at: string }>(
      owner,
      "loadCategoryFormRecord",
      1,
    );
    assert.equal(result.status, "data");
    assert.equal(result.data.id, 1);
    assert.equal(result.data.updated_at, "2026-09-08T10:00:00.000Z");
  });

  await verify("missing Category record returns not_found", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: null, error: null }],
    });
    const result = await callLoader(owner, "loadCategoryFormRecord", 404);
    assert.deepEqual(result, { status: "not_found" });
  });

  await verify("Category edit record without a revision fails closed", async () => {
    const owner = loadOwner({
      topic_categories: [
        {
          data: {
            id: 1,
            name: "Category",
            slug: "category",
            parent_id: null,
            is_active: true,
            status: "published",
            color_token: "gold",
            updated_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await callLoader(owner, "loadCategoryFormRecord", 1);
    assert.equal(result.status, "error");
  });

  await verify("Series edit record without a revision fails closed", async () => {
    const owner = loadOwner({
      topic_series: [
        {
          data: {
            id: 1,
            name: "Series",
            slug: "series",
            status: "published",
            category_id: 10,
            updated_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await callLoader(owner, "loadSeriesFormRecord", 1);
    assert.equal(result.status, "error");
  });

  await verify("Category database error returns safe error, never not_found", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: null, error: databaseError() }],
    });
    const result = await callLoader(owner, "loadCategoryFormRecord", 1);
    assert.equal(result.status, "error");
    assert.equal(result.error.code, "ADMIN_TAXONOMY_FORM_LOAD_FAILED");
    assert.equal(result.error.message.includes(RAW_DATABASE_SENTINEL), false);
  });

  await verify("Series database error returns safe error, never not_found", async () => {
    const owner = loadOwner({
      topic_series: [{ data: null, error: databaseError() }],
    });
    const result = await callLoader(owner, "loadSeriesFormRecord", 1);
    assert.equal(result.status, "error");
    assert.equal(result.error.message.includes(RAW_DATABASE_SENTINEL), false);
  });

  await verify("Topic database error returns safe error, never not_found", async () => {
    const owner = loadOwner({
      topics: [{ data: null, error: databaseError() }],
    });
    const result = await callLoader(owner, "loadTopicFormRecord", 1);
    assert.equal(result.status, "error");
    assert.equal(result.error.message.includes(RAW_DATABASE_SENTINEL), false);
  });

  await verify("Category option error cannot become an empty success", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: null, error: databaseError() }],
    });
    const result = await callLoader(owner, "loadCategoryParentFormOptions");
    assert.equal(result.status, "error");
    assert.equal("data" in result, false);
  });

  await verify("null Category option payload cannot become an empty success", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: null, error: null }],
    });
    const result = await callLoader(owner, "loadCategoryParentFormOptions");
    assert.equal(result.status, "error");
  });

  await verify("genuinely empty optional parent options remain valid data", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [], error: null }],
    });
    const result = await callLoader(owner, "loadCategoryParentFormOptions");
    assert.deepEqual(result, { status: "data", data: [] });
  });

  await verify("empty required Series category options fail closed", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [], error: null }],
    });
    const result = await callLoader(owner, "loadSeriesCategoryFormOptions");
    assert.equal(result.status, "error");
  });

  await verify("Series options require both active and published eligibility", async () => {
    const inactivePublishedCategory = {
      ...publishedCategory,
      id: 12,
      name: "Inactive published drift",
      slug: "inactive-published-drift",
      is_active: false,
    };
    const owner = loadOwner({
      topic_categories: [
        {
          data: [publishedCategory, inactivePublishedCategory],
          error: null,
        },
      ],
    });
    const result = await callLoader<Array<{ value: string }>>(
      owner,
      "loadSeriesCategoryFormOptions",
    );
    assert.equal(result.status, "data");
    assert.deepEqual(
      result.data.map((option: { value: string }) => option.value),
      ["10"],
    );
  });

  await verify("Series options preserve the persisted unpublished Category id", async () => {
    const owner = loadOwner({
      topic_categories: [
        { data: [publishedCategory, unpublishedCategory], error: null },
      ],
    });
    const result = await callLoader<Array<{ value: string }>>(
      owner,
      "loadSeriesCategoryFormOptions",
      11,
    );
    assert.equal(result.status, "data");
    assert.deepEqual(
      result.data.map((option: { value: string }) => option.value),
      ["10", "11"],
    );
  });

  await verify("missing persisted Series Category dependency fails closed", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [publishedCategory], error: null }],
    });
    const result = await callLoader(
      owner,
      "loadSeriesCategoryFormOptions",
      999,
    );
    assert.equal(result.status, "error");
  });

  await verify("partial Topic taxonomy failure cannot return partial data", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [publishedCategory], error: null }],
      topic_series: [{ data: null, error: databaseError() }],
    });
    const result = await callLoader(
      owner,
      "loadTopicTaxonomyFormDependencies",
    );
    assert.equal(result.status, "error");
    assert.equal("data" in result, false);
    assert.equal(result.error.message.includes(RAW_DATABASE_SENTINEL), false);
  });

  await verify("empty required Topic Category dependency fails closed", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [], error: null }],
      topic_series: [{ data: [], error: null }],
    });
    const result = await callLoader(
      owner,
      "loadTopicTaxonomyFormDependencies",
    );
    assert.equal(result.status, "error");
  });

  await verify("Topic dependencies preserve persisted unpublished ids", async () => {
    const owner = loadOwner({
      topic_categories: [
        { data: [publishedCategory, unpublishedCategory], error: null },
      ],
      topic_series: [
        { data: [publishedSeries, unpublishedSeries], error: null },
      ],
    });
    const result = await callLoader<{
      categories: Array<{ id: number }>;
      series: Array<{ id: number }>;
    }>(owner, "loadTopicTaxonomyFormDependencies", {
      currentCategoryId: 11,
      currentSeriesId: 21,
    });
    assert.equal(result.status, "data");
    assert.deepEqual(
      result.data.categories.map((category: { id: number }) => category.id),
      [10, 11],
    );
    assert.deepEqual(
      result.data.series.map((series: { id: number }) => series.id),
      [20, 21],
    );
  });

  await verify("missing persisted Topic taxonomy id fails closed", async () => {
    const owner = loadOwner({
      topic_categories: [{ data: [publishedCategory], error: null }],
      topic_series: [{ data: [publishedSeries], error: null }],
    });
    const result = await callLoader(
      owner,
      "loadTopicTaxonomyFormDependencies",
      { currentCategoryId: 10, currentSeriesId: 999 },
    );
    assert.equal(result.status, "error");
  });
}

async function runCategoryRouteChecks() {
  const CategoryForm = marker("CategoryForm");

  async function renderEdit(
    loader: Record<string, unknown>,
    id = "1",
  ) {
    const navigation = makeNotFound();
    const recorder = createJsxRecorder();
    const page = loadTypeScriptModule(
      "src/app/admin/content/categories/[id]/page.tsx",
      {
        "react/jsx-runtime": recorder.runtime,
        "next/navigation": { notFound: navigation.notFound },
        "../../../../../components/admin/ui": ui,
        "../../../../../lib/admin/auth/require-admin-session": {
          requireAdminSession: async () => undefined,
        },
        "../../../../../lib/admin/content/load-taxonomy-form-data": loader,
        "../CategoryForm": defaultModule(CategoryForm),
      },
      true,
    );
    const error = await captureError(() =>
      callPage(page, { params: Promise.resolve({ id }) }),
    );
    return { error, navigation, recorder, CategoryForm };
  }

  await verify("Category Edit maps true absence only to notFound", async () => {
    const outcome = await renderEdit({
      loadCategoryFormRecord: async () => ({ status: "not_found" }),
      loadCategoryParentFormOptions: async () => {
        throw new Error("options must not load after absence");
      },
    });
    assert.equal(outcome.error, outcome.navigation.signal);
    assert.equal(outcome.navigation.calls, 1);
    assert.equal(
      outcome.recorder.renders.some((render) => render.type === outcome.CategoryForm),
      false,
    );
  });

  await verify("Category Edit sends record error to boundary without a Form", async () => {
    const boundaryError = new Error("safe category boundary error");
    const outcome = await renderEdit({
      loadCategoryFormRecord: async () => ({
        status: "error",
        error: boundaryError,
      }),
      loadCategoryParentFormOptions: async () => ({ status: "data", data: [] }),
    });
    assert.equal(outcome.error, boundaryError);
    assert.equal(outcome.navigation.calls, 0);
    assert.equal(
      outcome.recorder.renders.some((render) => render.type === outcome.CategoryForm),
      false,
    );
  });

  await verify("Category Edit blocks Form when parent options fail", async () => {
    const boundaryError = new Error("safe options boundary error");
    const outcome = await renderEdit({
      loadCategoryFormRecord: async () => ({
        status: "data",
        data: {
          id: 31,
          name: "Category",
          parent_id: 10,
          updated_at: "2026-09-08T11:00:00.000Z",
        },
      }),
      loadCategoryParentFormOptions: async () => ({
        status: "error",
        error: boundaryError,
      }),
    });
    assert.equal(outcome.error, boundaryError);
    assert.equal(outcome.navigation.calls, 0);
    assert.equal(
      outcome.recorder.renders.some((render) => render.type === outcome.CategoryForm),
      false,
    );
  });

  await verify("Category Edit passes persisted record and revision unchanged", async () => {
    const category = {
      id: 31,
      name: "Category",
      parent_id: 10,
      updated_at: "2026-09-08T11:00:00.000Z",
    };
    const outcome = await renderEdit({
      loadCategoryFormRecord: async () => ({ status: "data", data: category }),
      loadCategoryParentFormOptions: async () => ({
        status: "data",
        data: [{ value: "10", label: "Parent" }],
      }),
    });
    assert.equal(outcome.error, null);
    const form = outcome.recorder.renders.find(
      (render) => render.type === outcome.CategoryForm,
    );
    assert.equal(form?.props.category, category);
    assert.equal((form?.props.category as typeof category).id, 31);
    assert.equal(
      (form?.props.category as typeof category).updated_at,
      "2026-09-08T11:00:00.000Z",
    );
  });

  await verify("Category Create blocks Form when optional-data read fails", async () => {
    const recorder = createJsxRecorder();
    const boundaryError = new Error("safe category options error");
    const page = loadTypeScriptModule(
      "src/app/admin/content/categories/new/page.tsx",
      {
        "react/jsx-runtime": recorder.runtime,
        "../../../../../components/admin/ui": ui,
        "../../../../../lib/admin/auth/require-admin-session": {
          requireAdminSession: async () => undefined,
        },
        "../../../../../lib/admin/content/load-taxonomy-form-data": {
          loadCategoryParentFormOptions: async () => ({
            status: "error",
            error: boundaryError,
          }),
        },
        "../CategoryForm": defaultModule(CategoryForm),
      },
      true,
    );
    const error = await captureError(() => callPage(page));
    assert.equal(error, boundaryError);
    assert.equal(
      recorder.renders.some((render) => render.type === CategoryForm),
      false,
    );
  });
}

async function runSeriesRouteChecks() {
  const SeriesForm = marker("SeriesForm");

  async function renderEdit(loader: Record<string, unknown>) {
    const navigation = makeNotFound();
    const recorder = createJsxRecorder();
    const page = loadTypeScriptModule(
      "src/app/admin/content/series/[id]/page.tsx",
      {
        "react/jsx-runtime": recorder.runtime,
        "next/navigation": { notFound: navigation.notFound },
        "../../../../../components/admin/ui": ui,
        "../../../../../lib/admin/auth/require-admin-session": {
          requireAdminSession: async () => undefined,
        },
        "../../../../../lib/admin/content/load-taxonomy-form-data": loader,
        "../SeriesForm": defaultModule(SeriesForm),
      },
      true,
    );
    const error = await captureError(() =>
      callPage(page, { params: Promise.resolve({ id: "5" }) }),
    );
    return { error, navigation, recorder, SeriesForm };
  }

  await verify("Series Edit maps true absence only to notFound", async () => {
    const outcome = await renderEdit({
      loadSeriesFormRecord: async () => ({ status: "not_found" }),
      loadSeriesCategoryFormOptions: async () => ({ status: "data", data: [] }),
    });
    assert.equal(outcome.error, outcome.navigation.signal);
    assert.equal(outcome.navigation.calls, 1);
    assert.equal(
      outcome.recorder.renders.some((render) => render.type === outcome.SeriesForm),
      false,
    );
  });

  await verify("Series Edit blocks Form on dependency failure", async () => {
    const boundaryError = new Error("safe series options error");
    const series = {
      id: 5,
      name: "Series",
      category_id: 11,
      updated_at: "2026-09-08T12:00:00.000Z",
    };
    const outcome = await renderEdit({
      loadSeriesFormRecord: async () => ({ status: "data", data: series }),
      loadSeriesCategoryFormOptions: async () => ({
        status: "error",
        error: boundaryError,
      }),
    });
    assert.equal(outcome.error, boundaryError);
    assert.equal(outcome.navigation.calls, 0);
    assert.equal(
      outcome.recorder.renders.some((render) => render.type === outcome.SeriesForm),
      false,
    );
  });

  await verify("Series Edit passes persisted record and revision unchanged", async () => {
    const series = {
      id: 5,
      name: "Series",
      category_id: 11,
      updated_at: "2026-09-08T12:00:00.000Z",
    };
    const outcome = await renderEdit({
      loadSeriesFormRecord: async () => ({ status: "data", data: series }),
      loadSeriesCategoryFormOptions: async () => ({
        status: "data",
        data: [{ value: "11", label: "Persisted Category" }],
      }),
    });
    assert.equal(outcome.error, null);
    const form = outcome.recorder.renders.find(
      (render) => render.type === outcome.SeriesForm,
    );
    assert.equal(form?.props.series, series);
    assert.equal((form?.props.series as typeof series).category_id, 11);
    assert.equal(
      (form?.props.series as typeof series).updated_at,
      "2026-09-08T12:00:00.000Z",
    );
  });

  await verify("Series Create blocks Form when required options are unavailable", async () => {
    const recorder = createJsxRecorder();
    const boundaryError = new Error("safe required options error");
    const page = loadTypeScriptModule(
      "src/app/admin/content/series/new/page.tsx",
      {
        "react/jsx-runtime": recorder.runtime,
        "../../../../../components/admin/ui": ui,
        "../../../../../lib/admin/auth/require-admin-session": {
          requireAdminSession: async () => undefined,
        },
        "../../../../../lib/admin/content/load-taxonomy-form-data": {
          loadSeriesCategoryFormOptions: async () => ({
            status: "error",
            error: boundaryError,
          }),
        },
        "../SeriesForm": defaultModule(SeriesForm),
      },
      true,
    );
    const error = await captureError(() => callPage(page));
    assert.equal(error, boundaryError);
    assert.equal(
      recorder.renders.some((render) => render.type === SeriesForm),
      false,
    );
  });
}

function topicDependencies(
  loader: Record<string, unknown>,
  recorder: ReturnType<typeof createJsxRecorder>,
  navigation: ReturnType<typeof makeNotFound>,
  ArticleEditor: unknown,
  MediaContentForm: unknown,
) {
  return {
    "react/jsx-runtime": recorder.runtime,
    "next/navigation": { notFound: navigation.notFound },
    "../../../../../components/admin/AdminNotice": defaultModule(
      marker("AdminNotice"),
    ),
    "../../../../../components/admin/content/editors/ArticleEditor":
      defaultModule(ArticleEditor),
    "../../../../../components/admin/content/editors/ArticleCreateEditor":
      defaultModule(ArticleEditor),
    "../../../../../components/admin/content/editors/media/MediaContentForm":
      defaultModule(MediaContentForm),
    "../../../../../components/admin/ui": ui,
    "../../../../../lib/admin/content/category-hierarchy": categoryHierarchy,
    "../../../../../lib/admin/content/load-taxonomy-form-data": loader,
    "../../../../../lib/admin/content/content-types": {
      getContentTypeLabel: (value: string) => value,
      isContentType: (value: string) => ["article", "gallery"].includes(value),
      isMediaEditableContentType: (value: string) => value === "gallery",
      resolveContentEditor: (value: string) =>
        value === "article" ? "article" : value === "gallery" ? "media" : null,
    },
    "../../../../../lib/admin/auth/require-admin-session": {
      requireAdminSession: async () => undefined,
    },
    "../../../../../lib/admin/media-topic-payload": {
      parseMediaTopicPayload: () => null,
    },
    "../../../../../lib/admin/content-routes": {
      ADMIN_CONTENT_ROUTES: { topics: "/admin/content/topics" },
      isAdminContentReturnPath: () => false,
    },
    "../../../../../lib/admin/content/entity-preview-capabilities": {
      buildAdminContentPreviewCapability: () => ({}),
    },
  };
}

async function runTopicRouteChecks() {
  const ArticleEditor = marker("ArticleEditor");
  const MediaContentForm = marker("MediaContentForm");

  async function renderEdit(loader: Record<string, unknown>) {
    const navigation = makeNotFound();
    const recorder = createJsxRecorder();
    const page = loadTypeScriptModule(
      "src/app/admin/content/topics/[id]/page.tsx",
      topicDependencies(
        loader,
        recorder,
        navigation,
        ArticleEditor,
        MediaContentForm,
      ),
      true,
    );
    const error = await captureError(() =>
      callPage(page, {
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({}),
      }),
    );
    return { error, navigation, recorder };
  }

  await verify("Topic Edit maps true absence only to notFound", async () => {
    const outcome = await renderEdit({
      loadTopicFormRecord: async () => ({ status: "not_found" }),
      loadTopicTaxonomyFormDependencies: async () => {
        throw new Error("dependencies must not load after absence");
      },
      invalidTopicFormRecord: () => ({ status: "error", error: new Error() }),
    });
    assert.equal(outcome.error, outcome.navigation.signal);
    assert.equal(outcome.navigation.calls, 1);
    assert.equal(
      outcome.recorder.renders.some(
        (render) =>
          render.type === ArticleEditor || render.type === MediaContentForm,
      ),
      false,
    );
  });

  await verify("Topic Edit sends record error to boundary, not 404", async () => {
    const boundaryError = new Error("safe topic record error");
    const outcome = await renderEdit({
      loadTopicFormRecord: async () => ({
        status: "error",
        error: boundaryError,
      }),
      loadTopicTaxonomyFormDependencies: async () => ({ status: "data" }),
      invalidTopicFormRecord: () => ({ status: "error", error: new Error() }),
    });
    assert.equal(outcome.error, boundaryError);
    assert.equal(outcome.navigation.calls, 0);
    assert.equal(
      outcome.recorder.renders.some(
        (render) =>
          render.type === ArticleEditor || render.type === MediaContentForm,
      ),
      false,
    );
  });

  await verify("Topic Edit blocks all editors when taxonomy dependencies fail", async () => {
    const boundaryError = new Error("safe taxonomy dependency error");
    let dependencyInput: unknown;
    const topic = {
      id: 7,
      content_type: "article",
      category_id: 11,
      series_id: 21,
    };
    const outcome = await renderEdit({
      loadTopicFormRecord: async () => ({ status: "data", data: topic }),
      loadTopicTaxonomyFormDependencies: async (input: unknown) => {
        dependencyInput = input;
        return { status: "error", error: boundaryError };
      },
      invalidTopicFormRecord: () => ({ status: "error", error: new Error() }),
    });
    assert.equal(outcome.error, boundaryError);
    assert.deepEqual(dependencyInput, {
      currentCategoryId: 11,
      currentSeriesId: 21,
    });
    assert.equal(
      outcome.recorder.renders.some(
        (render) =>
          render.type === ArticleEditor || render.type === MediaContentForm,
      ),
      false,
    );
  });

  await verify("Topic Edit passes persisted ids to the Article editor", async () => {
    const topic = {
      id: 7,
      content_type: "article",
      category_id: 11,
      series_id: 21,
    };
    const categories = [unpublishedCategory];
    const series = [unpublishedSeries];
    const outcome = await renderEdit({
      loadTopicFormRecord: async () => ({ status: "data", data: topic }),
      loadTopicTaxonomyFormDependencies: async () => ({
        status: "data",
        data: { categories, series },
      }),
      invalidTopicFormRecord: () => ({ status: "error", error: new Error() }),
    });
    assert.equal(outcome.error, null);
    const editor = outcome.recorder.renders.find(
      (render) => render.type === ArticleEditor,
    );
    assert.equal(editor?.props.topic, topic);
    assert.equal(editor?.props.categories, categories);
    assert.equal(editor?.props.series, series);
  });

  await verify("invalid persisted Topic editor contract is an error, not 404", async () => {
    const contractError = new Error("safe topic contract error");
    const outcome = await renderEdit({
      loadTopicFormRecord: async () => ({
        status: "data",
        data: {
          id: 7,
          content_type: "unknown",
          category_id: 11,
          series_id: 21,
        },
      }),
      loadTopicTaxonomyFormDependencies: async () => ({ status: "data" }),
      invalidTopicFormRecord: () => ({
        status: "error",
        error: contractError,
      }),
    });
    assert.equal(outcome.error, contractError);
    assert.equal(outcome.navigation.calls, 0);
  });

  await verify("Topic Create blocks every editor on dependency failure", async () => {
    const navigation = makeNotFound();
    const recorder = createJsxRecorder();
    const boundaryError = new Error("safe create dependency error");
    const loader = {
      loadTopicTaxonomyFormDependencies: async () => ({
        status: "error",
        error: boundaryError,
      }),
    };
    const page = loadTypeScriptModule(
      "src/app/admin/content/topics/new/page.tsx",
      topicDependencies(
        loader,
        recorder,
        navigation,
        ArticleEditor,
        MediaContentForm,
      ),
      true,
    );
    const error = await captureError(() =>
      callPage(page, { searchParams: Promise.resolve({}) }),
    );
    assert.equal(error, boundaryError);
    assert.equal(
      recorder.renders.some(
        (render) =>
          render.type === ArticleEditor || render.type === MediaContentForm,
      ),
      false,
    );
  });

  await verify("Topic Create receives complete taxonomy data only", async () => {
    const navigation = makeNotFound();
    const recorder = createJsxRecorder();
    const categories = [publishedCategory];
    const series = [publishedSeries];
    const loader = {
      loadTopicTaxonomyFormDependencies: async () => ({
        status: "data",
        data: { categories, series },
      }),
    };
    const page = loadTypeScriptModule(
      "src/app/admin/content/topics/new/page.tsx",
      topicDependencies(
        loader,
        recorder,
        navigation,
        ArticleEditor,
        MediaContentForm,
      ),
      true,
    );
    const error = await captureError(() =>
      callPage(page, { searchParams: Promise.resolve({}) }),
    );
    assert.equal(error, null);
    const editor = recorder.renders.find(
      (render) => render.type === ArticleEditor,
    );
    assert.equal(editor?.props.categories, categories);
    assert.equal(editor?.props.series, series);
  });
}

async function runAdminErrorBoundaryCheck() {
  await verify("Admin error boundary exposes the Next.js reset retry contract", () => {
    const recorder = createJsxRecorder();
    let resetCalls = 0;
    const page = loadTypeScriptModule(
      "src/app/admin/error.tsx",
      {
        react: {
          useEffect(effect: () => void) {
            effect();
          },
        },
        "react/jsx-runtime": recorder.runtime,
        "../../components/admin/ui/AdminPageContextHeader": defaultModule(
          ui.AdminPageContextHeader,
        ),
        "../../components/admin/ui/AdminPageExperience": defaultModule(
          ui.AdminPageExperience,
        ),
        "../../lib/logging": { logError() {} },
      },
      true,
    );

    callPage(page, {
      error: new Error("safe boundary fixture"),
      reset: () => {
        resetCalls += 1;
      },
    });
    const retryButton = recorder.renders.find(
      (render) => render.type === "button",
    );
    assert.equal(typeof retryButton?.props.onClick, "function");
    (retryButton?.props.onClick as () => void)();
    assert.equal(resetCalls, 1);
  });
}

await runOwnerChecks();
await runCategoryRouteChecks();
await runSeriesRouteChecks();
await runTopicRouteChecks();
await runAdminErrorBoundaryCheck();

console.log(
  `verify-taxonomy-admin-load-truth: ${passed}/${passed + failed} passed`,
);
if (failed) process.exit(1);
