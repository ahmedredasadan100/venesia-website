import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { createJiti } from "jiti";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url);
const TEMP_PREFIX = "venesia-taxonomy-revision-";
const INITIAL_REVISION = "2026-09-08T10:00:00.000001+00:00";
const FIRST_SAVED_REVISION = "2026-09-08T10:00:01.123456+00:00";
const SECOND_SAVED_REVISION = "2026-09-08T10:00:02.654321+00:00";

type WebpackStats = {
  hasErrors: () => boolean;
  toJson: (options: unknown) => {
    errors?: unknown[];
    warnings?: unknown[];
  };
};

type WebpackCompiler = {
  run: (
    callback: (error?: Error | null, stats?: WebpackStats) => void,
  ) => void;
  close: (callback: (error?: Error | null) => void) => void;
};

type TaxonomyRevisionHarnessState = {
  actionCalls: number;
  mountCount: number;
  submissions: Array<Array<[string, string]>>;
};

type TaxonomyActionResult = {
  status: string;
  mode: string;
  revision: number;
  code?: string;
  savedRevision?: string;
};

type TaxonomyActionMockState = {
  reset: () => void;
  categoryCurrentRead: Record<string, unknown>;
  seriesCurrentRead: Record<string, unknown>;
  seriesCategoryRead: Record<string, unknown>;
  categoryMutationResult: Record<string, unknown>;
  seriesMutationResult: Record<string, unknown>;
  createSeriesMutationResult: Record<string, unknown>;
  categoryMutationInputs: Array<Record<string, unknown>>;
  seriesMutationInputs: Array<Record<string, unknown>>;
  createSeriesMutationInputs: Array<Record<string, unknown>>;
  auditCalls: Array<Record<string, unknown>>;
  revalidatePaths: string[];
  topicRevalidations: number;
};

type TaxonomyActionHarness = {
  qa: TaxonomyActionMockState;
  updateCategoryForm: (
    previousState: TaxonomyActionResult,
    formData: FormData,
  ) => Promise<TaxonomyActionResult>;
  updateSeriesForm: (
    previousState: TaxonomyActionResult,
    formData: FormData,
  ) => Promise<TaxonomyActionResult>;
  createSeriesForm: (
    previousState: TaxonomyActionResult,
    formData: FormData,
  ) => Promise<TaxonomyActionResult>;
};

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function extractFunction(source: string, start: string, end?: string) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function validateTempPath(tempPath: string) {
  const resolvedTempPath = path.resolve(tempPath);
  const resolvedOsTemp = path.resolve(tmpdir());
  assert.ok(
    resolvedTempPath.startsWith(`${resolvedOsTemp}${path.sep}`) &&
      path.basename(resolvedTempPath).startsWith(TEMP_PREFIX),
    `Refusing to remove unexpected temp path: ${resolvedTempPath}`,
  );
  return resolvedTempPath;
}

const entrySource = String.raw`
import * as React from "react";
import { createRoot } from "react-dom/client";
import AdminFeedbackProvider from "@admin-feedback-provider";
import AdminFormRuntime, { useAdminFormRuntime } from "@admin-form-runtime";
import TaxonomyExpectedRevisionInput from "@taxonomy-expected-revision";

const resultRevisions = [
  "${FIRST_SAVED_REVISION}",
  "${SECOND_SAVED_REVISION}",
];

const qa = {
  actionCalls: 0,
  mountCount: 0,
  submissions: [],
};
window.__TAXONOMY_REVISION_QA__ = qa;

function RuntimeProbe() {
  const runtime = useAdminFormRuntime();
  return React.createElement("output", {
    id: "qa-runtime-state",
    "data-status": runtime.state.status,
    "data-revision": String(runtime.state.revision),
  });
}

function MountProbe() {
  React.useEffect(() => {
    qa.mountCount += 1;
  }, []);
  return null;
}

function Harness() {
  const action = React.useCallback(async (previousState, formData) => {
    const callIndex = qa.actionCalls;
    qa.actionCalls += 1;
    qa.submissions.push(Array.from(formData.entries()));
    return {
      status: "success",
      mode: "edit",
      revision: previousState.revision + 1,
      code: "updated",
      entityId: 17,
      savedRevision: resultRevisions[callIndex],
    };
  }, []);

  return React.createElement(
    AdminFeedbackProvider,
    null,
    React.createElement(
      AdminFormRuntime,
      {
        action,
        mode: "edit",
        entityKey: "qa-taxonomy-revision",
        formId: "qa-taxonomy-form",
      },
      React.createElement(MountProbe),
      React.createElement(TaxonomyExpectedRevisionInput, {
        initialRevision: "${INITIAL_REVISION}",
      }),
      React.createElement("input", {
        id: "qa-name",
        name: "name",
        defaultValue: "Series QA",
      }),
      React.createElement("button", { id: "qa-save", type: "submit" }, "Save"),
      React.createElement(RuntimeProbe),
    ),
  );
}

createRoot(document.getElementById("root")).render(React.createElement(Harness));
`;

const navigationMockSource = String.raw`
export { unstable_rethrow } from "next/dist/client/components/unstable-rethrow.browser";
export function useRouter() {
  return {
    push() {}, replace() {}, back() {}, forward() {}, refresh() {},
    prefetch() { return Promise.resolve(); },
  };
}
export function usePathname() { return "/admin/content/series/17"; }
export function useSearchParams() { return new URLSearchParams(); }
`;

const taxonomyActionEntrySource = String.raw`
export {
  createSeriesForm,
  updateCategoryForm,
  updateSeriesForm,
} from "@taxonomy-form-actions";
export { qa } from "@taxonomy-action-state";
`;

const taxonomyActionStateMockSource = String.raw`
export const qa = {
  reset() {
    qa.categoryCurrentRead = {
      id: 7,
      slug: "category-seven",
      status: "published",
    };
    qa.seriesCurrentRead = {
      id: 9,
      slug: "series-nine",
      status: "published",
      category_id: 3,
    };
    qa.seriesCategoryRead = {
      id: 3,
      is_active: true,
      status: "published",
    };
    qa.topicRows = [];
    qa.categoryMutationResult = {
      ok: true,
      code: "updated",
      category: {
        id: 7,
        published_at: null,
        updated_at: "${FIRST_SAVED_REVISION}",
      },
      topics_updated: 0,
    };
    qa.seriesMutationResult = {
      ok: true,
      code: "updated",
      series: {
        id: 9,
        updated_at: "${FIRST_SAVED_REVISION}",
      },
      topics_updated: 0,
    };
    qa.createSeriesMutationResult = {
      ok: true,
      code: "created",
      series: {
        id: 10,
        updated_at: "${FIRST_SAVED_REVISION}",
      },
    };
    qa.databaseReads = [];
    qa.categoryMutationInputs = [];
    qa.seriesMutationInputs = [];
    qa.createSeriesMutationInputs = [];
    qa.auditCalls = [];
    qa.revalidatePaths = [];
    qa.topicRevalidations = 0;
  },
};
qa.reset();
`;

const taxonomyAuthMockSource = String.raw`
export async function requireAdminSession() {
  return { id: 41, username: "qa-admin", email: "qa@example.test", is_active: true };
}
`;

const taxonomyAuditMockSource = String.raw`
import { qa } from "./taxonomy-action-state.mock.js";
export async function recordCmsAdminAudit(input, actor) {
  qa.auditCalls.push({ input, actor });
}
`;

const taxonomyMutationMockSource = String.raw`
import { qa } from "./taxonomy-action-state.mock.js";
export async function updateTopicCategoryAtomically(input) {
  qa.categoryMutationInputs.push(input);
  return qa.categoryMutationResult;
}
export async function updateTopicSeriesAtomically(input) {
  qa.seriesMutationInputs.push(input);
  return qa.seriesMutationResult;
}
export async function createTopicSeriesAtomically(input) {
  qa.createSeriesMutationInputs.push(input);
  return qa.createSeriesMutationResult;
}
`;

const taxonomyCacheMockSource = String.raw`
import { qa } from "./taxonomy-action-state.mock.js";
export function revalidateTopicsCache() {
  qa.topicRevalidations += 1;
}
`;

const nextCacheMockSource = String.raw`
import { qa } from "./taxonomy-action-state.mock.js";
export function revalidatePath(value) {
  qa.revalidatePaths.push(String(value));
}
`;

const supabaseAdminMockSource = String.raw`
import { qa } from "./taxonomy-action-state.mock.js";

function resolveRead(table, selection) {
  qa.databaseReads.push({ table, selection });
  if (table === "topic_categories" && selection.includes("is_active")) {
    return { data: qa.seriesCategoryRead, error: null };
  }
  if (table === "topic_categories") {
    return { data: qa.categoryCurrentRead, error: null };
  }
  if (table === "topic_series") {
    return { data: qa.seriesCurrentRead, error: null };
  }
  if (table === "topics") {
    return { data: qa.topicRows, error: null };
  }
  return { data: null, error: null };
}

function query(table) {
  let selection = "";
  const builder = {
    select(value) { selection = String(value); return builder; },
    eq() { return builder; },
    is() { return builder; },
    limit() { return builder; },
    maybeSingle() { return Promise.resolve(resolveRead(table, selection)); },
    single() { return Promise.resolve(resolveRead(table, selection)); },
    then(resolve, reject) {
      return Promise.resolve(resolveRead(table, selection)).then(resolve, reject);
    },
  };
  return builder;
}

export function getSupabaseAdmin() {
  return { from: query };
}
`;

async function compileServerActionHarness(rootDir: string, tempDir: string) {
  const mockPaths = {
    state: path.join(tempDir, "taxonomy-action-state.mock.js"),
    auth: path.join(tempDir, "taxonomy-auth.mock.js"),
    audit: path.join(tempDir, "taxonomy-audit.mock.js"),
    mutations: path.join(tempDir, "taxonomy-mutations.mock.js"),
    taxonomyCache: path.join(tempDir, "taxonomy-cache.mock.js"),
    nextCache: path.join(tempDir, "next-cache.mock.js"),
    supabase: path.join(tempDir, "supabase-admin.mock.js"),
  };
  await Promise.all([
    writeFile(mockPaths.state, taxonomyActionStateMockSource, "utf8"),
    writeFile(mockPaths.auth, taxonomyAuthMockSource, "utf8"),
    writeFile(mockPaths.audit, taxonomyAuditMockSource, "utf8"),
    writeFile(mockPaths.mutations, taxonomyMutationMockSource, "utf8"),
    writeFile(mockPaths.taxonomyCache, taxonomyCacheMockSource, "utf8"),
    writeFile(mockPaths.nextCache, nextCacheMockSource, "utf8"),
    writeFile(mockPaths.supabase, supabaseAdminMockSource, "utf8"),
  ]);

  const { loadBindings } = require("next/dist/build/swc") as {
    loadBindings: () => Promise<unknown>;
  };
  await loadBindings();
  const webpack = (
    require("next/dist/compiled/webpack/webpack") as {
      webpack: ((config: unknown) => WebpackCompiler) & {
        DefinePlugin: new (definitions: Record<string, unknown>) => unknown;
      };
    }
  ).webpack;
  const compiler = webpack({
    mode: "development",
    target: "node",
    context: rootDir,
    entry: `data:text/javascript;charset=utf-8,${encodeURIComponent(taxonomyActionEntrySource)}`,
    output: {
      path: tempDir,
      filename: "taxonomy-actions.bundle.cjs",
      library: { type: "commonjs2" },
    },
    devtool: false,
    optimization: { minimize: false },
    plugins: [
      new webpack.DefinePlugin({
        "process.env": JSON.stringify({}),
      }),
    ],
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
      modules: [path.join(rootDir, "node_modules"), "node_modules"],
      alias: {
        "@taxonomy-form-actions": path.join(
          rootDir,
          "src/app/admin/content/taxonomy-form-actions.ts",
        ),
        "@taxonomy-action-state": mockPaths.state,
        "../../../lib/admin/auth/require-admin-session$": mockPaths.auth,
        "../../../lib/admin/audit-log$": mockPaths.audit,
        "../../../lib/admin/content/taxonomy-mutations$": mockPaths.mutations,
        "../../../lib/cache/revalidate-public-cache-tags$":
          mockPaths.taxonomyCache,
        "../../../lib/supabase-admin$": mockPaths.supabase,
        "next/cache": mockPaths.nextCache,
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: require.resolve(
                "next/dist/build/webpack/loaders/next-swc-loader",
              ),
              options: {
                rootDir,
                isServer: true,
                compilerType: "server",
                hasReactRefresh: false,
                nextConfig: {},
                jsConfig: {},
                supportedBrowsers: undefined,
                swcCacheDir: path.join(tempDir, "server-swc-cache"),
                serverComponents: false,
                serverReferenceHashSalt: "taxonomy-form-actions-qa",
                esm: false,
                transpilePackages: [],
              },
            },
          ],
        },
      ],
    },
  });

  return await new Promise<unknown[]>((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error || !stats) {
        compiler.close(() => reject(error ?? new Error("Webpack returned no stats.")));
        return;
      }
      const info = stats.toJson({ all: false, errors: true, warnings: true });
      compiler.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (stats.hasErrors()) {
          reject(new Error(JSON.stringify(info.errors ?? [], null, 2)));
          return;
        }
        resolve(info.warnings ?? []);
      });
    });
  });
}

async function compileHarness(rootDir: string, tempDir: string) {
  const navigationMockPath = path.join(tempDir, "next-navigation.mock.js");
  await writeFile(navigationMockPath, navigationMockSource, "utf8");

  const { loadBindings } = require("next/dist/build/swc") as {
    loadBindings: () => Promise<unknown>;
  };
  await loadBindings();

  const webpack = (
    require("next/dist/compiled/webpack/webpack") as {
      webpack: ((config: unknown) => WebpackCompiler) & {
        DefinePlugin: new (definitions: Record<string, unknown>) => unknown;
      };
    }
  ).webpack;
  const compiler = webpack({
    mode: "development",
    target: "web",
    context: rootDir,
    entry: `data:text/javascript;charset=utf-8,${encodeURIComponent(entrySource)}`,
    output: {
      path: tempDir,
      filename: "taxonomy-revision.bundle.js",
    },
    devtool: false,
    optimization: { minimize: false },
    plugins: [
      new webpack.DefinePlugin({
        "process.env": JSON.stringify({}),
      }),
    ],
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
      modules: [path.join(rootDir, "node_modules"), "node_modules"],
      alias: {
        "@admin-feedback-provider": path.join(
          rootDir,
          "src/components/admin/AdminFeedbackProvider.tsx",
        ),
        "@admin-form-runtime": path.join(
          rootDir,
          "src/components/admin/ui/AdminFormRuntime.tsx",
        ),
        "@taxonomy-expected-revision": path.join(
          rootDir,
          "src/app/admin/content/TaxonomyExpectedRevisionInput.tsx",
        ),
        "next/navigation": navigationMockPath,
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: require.resolve(
                "next/dist/build/webpack/loaders/next-swc-loader",
              ),
              options: {
                rootDir,
                isServer: false,
                compilerType: "client",
                hasReactRefresh: false,
                nextConfig: {},
                jsConfig: {},
                supportedBrowsers: undefined,
                swcCacheDir: path.join(tempDir, "swc-cache"),
                serverComponents: false,
                serverReferenceHashSalt: "taxonomy-form-revision-qa",
                esm: false,
                transpilePackages: [],
              },
            },
          ],
        },
      ],
    },
  });

  return await new Promise<unknown[]>((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error || !stats) {
        compiler.close(() => reject(error ?? new Error("Webpack returned no stats.")));
        return;
      }
      const info = stats.toJson({ all: false, errors: true, warnings: true });
      compiler.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (stats.hasErrors()) {
          reject(new Error(JSON.stringify(info.errors ?? [], null, 2)));
          return;
        }
        resolve(info.warnings ?? []);
      });
    });
  });
}

async function startHarnessServer(bundlePath: string) {
  const bundle = await readFile(bundlePath);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    if (requestUrl.pathname === "/taxonomy-revision.bundle.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(bundle);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      '<!doctype html><html><body><main id="root"></main><script src="/taxonomy-revision.bundle.js"></script></body></html>',
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Harness server did not bind.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function categoryEditForm(expectedRevision?: string) {
  const formData = new FormData();
  formData.set("id", "7");
  formData.set("name", "Category seven updated");
  formData.set("parent_id", "");
  formData.set("is_published", "on");
  formData.set("color_token", "gold");
  if (expectedRevision !== undefined) {
    formData.set("expected_updated_at", expectedRevision);
  }
  return formData;
}

function seriesEditForm(expectedRevision?: string) {
  const formData = new FormData();
  formData.set("id", "9");
  formData.set("name", "Series nine updated");
  formData.set("category_id", "3");
  formData.set("is_published", "on");
  if (expectedRevision !== undefined) {
    formData.set("expected_updated_at", expectedRevision);
  }
  return formData;
}

function seriesCreateForm() {
  const formData = new FormData();
  formData.set("name", "Atomic Series");
  formData.set("slug", "atomic-series");
  formData.set("category_id", "3");
  formData.set("is_published", "on");
  return formData;
}

function hasNoSuccessEffects(qa: TaxonomyActionMockState) {
  return (
    qa.auditCalls.length === 0 &&
    qa.revalidatePaths.length === 0 &&
    qa.topicRevalidations === 0
  );
}

const editInitialState: TaxonomyActionResult = {
  status: "idle",
  mode: "edit",
  revision: 0,
};
const createInitialState: TaxonomyActionResult = {
  status: "idle",
  mode: "create",
  revision: 0,
};

const rootDir = process.cwd();
const validation = await jiti.import<
  typeof import("../src/lib/admin/content/taxonomy-form-validation.ts")
>("../src/lib/admin/content/taxonomy-form-validation.ts");

const validRevisionData = new FormData();
validRevisionData.set("expected_updated_at", INITIAL_REVISION);
const validRevision = validation.parseTaxonomyExpectedRevision(validRevisionData);
check(
  "valid revision preserves the exact PostgreSQL microsecond string",
  validRevision.ok && validRevision.value === INITIAL_REVISION,
);
const missingRevision = validation.parseTaxonomyExpectedRevision(new FormData());
check(
  "missing revision is a typed rejection",
  !missingRevision.ok && missingRevision.reason === "missing",
);
const invalidRevisionData = new FormData();
invalidRevisionData.set("expected_updated_at", "not-a-revision");
const invalidRevision = validation.parseTaxonomyExpectedRevision(invalidRevisionData);
check(
  "invalid revision is a typed rejection",
  !invalidRevision.ok && invalidRevision.reason === "invalid",
);

const [actionsSource, mutationsSource, categoryFormSource, seriesFormSource] =
  await Promise.all([
    readFile(path.join(rootDir, "src/app/admin/content/taxonomy-form-actions.ts"), "utf8"),
    readFile(path.join(rootDir, "src/lib/admin/content/taxonomy-mutations.ts"), "utf8"),
    readFile(path.join(rootDir, "src/app/admin/content/categories/CategoryForm.tsx"), "utf8"),
    readFile(path.join(rootDir, "src/app/admin/content/series/SeriesForm.tsx"), "utf8"),
  ]);
const updateCategorySource = extractFunction(
  actionsSource,
  "export async function updateCategoryForm",
  "export async function createSeriesForm",
);
const createSeriesSource = extractFunction(
  actionsSource,
  "export async function createSeriesForm",
  "export async function updateSeriesForm",
);
const updateSeriesSource = extractFunction(
  actionsSource,
  "export async function updateSeriesForm",
);

check(
  "both taxonomy edit consumers submit the shared server-owned revision control",
  categoryFormSource.includes("TaxonomyExpectedRevisionInput") &&
    seriesFormSource.includes("TaxonomyExpectedRevisionInput"),
);
check(
  "category and series updates pass expected revisions to their canonical RPC owner",
  updateCategorySource.includes("expectedUpdatedAt: expectedRevision.value") &&
    updateSeriesSource.includes("expectedUpdatedAt: expectedRevision.value") &&
    (mutationsSource.match(/p_expected_updated_at:/g)?.length ?? 0) === 2,
);
check(
  "series create delegates to the canonical atomic RPC without a direct insert",
  createSeriesSource.includes("createTopicSeriesAtomically") &&
    !createSeriesSource.includes('.from("topic_series")') &&
    mutationsSource.includes('"admin_create_topic_series"'),
);

const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
let server: Server | null = null;
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  const actionWarnings = await compileServerActionHarness(rootDir, tempDir);
  const actionHarness = require(
    path.join(tempDir, "taxonomy-actions.bundle.cjs"),
  ) as TaxonomyActionHarness;
  const qa = actionHarness.qa;

  qa.reset();
  const freshCategory = await actionHarness.updateCategoryForm(
    editInitialState,
    categoryEditForm(INITIAL_REVISION),
  );
  check(
    "actual Category action forwards the exact fresh revision and emits success effects",
    qa.categoryMutationInputs[0]?.expectedUpdatedAt === INITIAL_REVISION &&
      freshCategory.status === "success" &&
      freshCategory.savedRevision === FIRST_SAVED_REVISION &&
      qa.auditCalls.length === 1 &&
      qa.topicRevalidations === 1 &&
      qa.revalidatePaths.length > 0,
  );

  qa.reset();
  const freshSeries = await actionHarness.updateSeriesForm(
    editInitialState,
    seriesEditForm(INITIAL_REVISION),
  );
  check(
    "actual Series action forwards the exact fresh revision and emits success effects",
    qa.seriesMutationInputs[0]?.expectedUpdatedAt === INITIAL_REVISION &&
      freshSeries.status === "success" &&
      freshSeries.savedRevision === FIRST_SAVED_REVISION &&
      qa.auditCalls.length === 1 &&
      qa.topicRevalidations === 1 &&
      qa.revalidatePaths.length > 0,
  );

  qa.reset();
  qa.seriesMutationResult = {
    ok: false,
    code: "series_category_conflict",
  };
  const relationshipConflict = await actionHarness.updateSeriesForm(
    editInitialState,
    seriesEditForm(INITIAL_REVISION),
  );
  check(
    "actual Series action returns the database relationship conflict with zero success effects",
    relationshipConflict.status === "error" &&
      relationshipConflict.code === "series_category_conflict" &&
      qa.seriesMutationInputs.length === 1 &&
      hasNoSuccessEffects(qa),
  );

  for (const [label, action, form, resultKey, inputKey] of [
    [
      "Category",
      actionHarness.updateCategoryForm,
      categoryEditForm,
      "categoryMutationResult",
      "categoryMutationInputs",
    ],
    [
      "Series",
      actionHarness.updateSeriesForm,
      seriesEditForm,
      "seriesMutationResult",
      "seriesMutationInputs",
    ],
  ] as const) {
    qa.reset();
    qa[resultKey] = { ok: false, code: "revision_conflict" };
    const conflict = await action(editInitialState, form(INITIAL_REVISION));
    check(
      `actual ${label} action returns typed conflict with zero success effects`,
      conflict.status === "error" &&
        conflict.code === "revision_conflict" &&
        qa[inputKey][0]?.expectedUpdatedAt === INITIAL_REVISION &&
        hasNoSuccessEffects(qa),
    );

    qa.reset();
    const missing = await action(editInitialState, form());
    check(
      `actual ${label} action rejects a missing revision before mutation`,
      missing.status === "error" &&
        missing.code === "revision_missing" &&
        qa[inputKey].length === 0 &&
        hasNoSuccessEffects(qa),
    );

    qa.reset();
    const invalid = await action(editInitialState, form("not-a-revision"));
    check(
      `actual ${label} action rejects an invalid revision before mutation`,
      invalid.status === "error" &&
        invalid.code === "revision_invalid" &&
        qa[inputKey].length === 0 &&
        hasNoSuccessEffects(qa),
    );
  }

  qa.reset();
  qa.seriesCurrentRead = {
    id: 9,
    slug: "series-nine",
    status: "published",
    category_id: 2,
  };
  qa.seriesCategoryRead = {
    id: 3,
    is_active: true,
    status: "unpublished",
  };
  const unpublishedCandidate = await actionHarness.updateSeriesForm(
    editInitialState,
    seriesEditForm(INITIAL_REVISION),
  );
  check(
    "actual Series action rejects a non-current Category unless active and published",
    unpublishedCandidate.status === "error" &&
      qa.seriesMutationInputs.length === 0 &&
      hasNoSuccessEffects(qa),
  );

  qa.reset();
  const createdSeries = await actionHarness.createSeriesForm(
    createInitialState,
    seriesCreateForm(),
  );
  check(
    "actual Series create action delegates to the atomic RPC before success effects",
    createdSeries.status === "success" &&
      qa.createSeriesMutationInputs[0]?.categoryId === 3 &&
      qa.auditCalls.length === 1 &&
      qa.topicRevalidations === 1 &&
      qa.revalidatePaths.length > 0,
  );

  qa.reset();
  qa.createSeriesMutationResult = {
    ok: false,
    code: "category_unavailable",
  };
  const rejectedSeries = await actionHarness.createSeriesForm(
    createInitialState,
    seriesCreateForm(),
  );
  check(
    "actual Series create rejection returns typed failure with zero success effects",
    rejectedSeries.status === "error" &&
      rejectedSeries.code === "category_unavailable" &&
      qa.createSeriesMutationInputs.length === 1 &&
      hasNoSuccessEffects(qa),
  );

  const warnings = await compileHarness(rootDir, tempDir);
  const harness = await startHarnessServer(
    path.join(tempDir, "taxonomy-revision.bundle.js"),
  );
  server = harness.server;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const browserIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    browserIssues.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });

  await page.goto(harness.url, { waitUntil: "networkidle" });
  const revisionInput = page.locator('input[name="expected_updated_at"]');
  await revisionInput.waitFor({ state: "attached" });
  check(
    "edit form opens with its exact source revision",
    (await revisionInput.inputValue()) === INITIAL_REVISION,
  );

  await page.locator("#qa-save").click();
  await page.waitForFunction(
    () => document.querySelector("#qa-runtime-state")?.getAttribute("data-revision") === "1",
  );
  await page.waitForFunction(
    (revision) =>
      document.querySelector<HTMLInputElement>('input[name="expected_updated_at"]')?.value === revision,
    FIRST_SAVED_REVISION,
  );
  const firstState = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __TAXONOMY_REVISION_QA__: TaxonomyRevisionHarnessState;
        }
      ).__TAXONOMY_REVISION_QA__,
  );
  check(
    "first successful save advances the hidden revision without remounting",
    firstState.mountCount === 1 &&
      firstState.submissions[0]?.find(([name]: [string, string]) => name === "expected_updated_at")?.[1] ===
        INITIAL_REVISION,
  );

  await page.locator("#qa-name").fill("Series QA second save");
  await page.locator("#qa-save").click();
  await page.waitForFunction(
    () => document.querySelector("#qa-runtime-state")?.getAttribute("data-revision") === "2",
  );
  await page.waitForFunction(
    (revision) =>
      document.querySelector<HTMLInputElement>('input[name="expected_updated_at"]')?.value === revision,
    SECOND_SAVED_REVISION,
  );
  const finalState = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __TAXONOMY_REVISION_QA__: TaxonomyRevisionHarnessState;
        }
      ).__TAXONOMY_REVISION_QA__,
  );
  check(
    "second save from the same mounted screen submits the first save's raw revision",
    finalState.mountCount === 1 &&
      finalState.actionCalls === 2 &&
      finalState.submissions[1]?.find(([name]: [string, string]) => name === "expected_updated_at")?.[1] ===
        FIRST_SAVED_REVISION &&
      (await revisionInput.inputValue()) === SECOND_SAVED_REVISION,
  );
  check(
    "browser harness has no runtime or compilation issues",
    browserIssues.length === 0 &&
      warnings.length === 0 &&
      actionWarnings.length === 0,
  );
} finally {
  await browser?.close();
  if (server) await stopServer(server);
  await rm(validateTempPath(tempDir), { recursive: true, force: true });
}

console.log(`Taxonomy form revision QA passed (${passed}/22).`);
