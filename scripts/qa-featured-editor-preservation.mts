import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";

const require = createRequire(import.meta.url);
const TEMP_PREFIX = "venesia-featured-editor-preservation-";

type BrowserIssue = {
  kind: "console" | "pageerror" | "requestfailed";
  detail: string;
};

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

type FeaturedHarnessState = {
  actionCalls: number;
  submissions: number[][];
  persistedIds: number[];
  mountInitial: () => void;
  reloadPersisted: (returnedIds?: number[]) => void;
  runPublicIntegration: () => Promise<{
    resolvedIds: number[];
    renderedIds: number[];
    renderedText: string;
    emptyMarkup: string;
    requests: Array<{ includeIds?: number[] }>;
  }>;
};

type FeaturedHarnessWindow = Window & {
  __FEATURED_PRESERVATION_QA__: FeaturedHarnessState;
};

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
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
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import FeaturedModuleEditClient from "@featured-editor";
import FeaturedModuleSection from "@featured-section";
import { buildFeaturedModuleConfig, parseFeaturedModuleConfig } from "@featured-config";
import { resolveFeaturedItems } from "@featured-resolver";

const initialIds = [701, 999001, 503, 999002];
const baseItems = [
  {
    id: 701,
    contentType: "article",
    slug: "topic-701",
    href: "/topics/701",
    title: "Available item 701",
    excerpt: "First excerpt",
    image: "/images/first.jpg",
    imageAlt: "First",
    category: "Reference",
    categorySlug: "reference-category",
    series: "",
    seriesSlug: "",
    date: "2026-09-01",
    publishedAt: "2026-09-01T00:00:00.000Z",
    isFeatured: true,
    isPopular: false,
    mediaProject: "",
    mediaKind: null,
    mediaDuration: "",
    display: {
      title: true,
      image: true,
      excerpt: true,
      date: true,
      category: true,
      series: true,
      introCard: true,
    },
  },
  {
    id: 503,
    contentType: "article",
    slug: "topic-503",
    href: "/topics/503",
    title: "Available item 503",
    excerpt: "Third excerpt",
    image: "/images/third.jpg",
    imageAlt: "Third",
    category: "Reference",
    categorySlug: "reference-category",
    series: "",
    seriesSlug: "",
    date: "2026-08-01",
    publishedAt: "2026-08-01T00:00:00.000Z",
    isFeatured: true,
    isPopular: false,
    mediaProject: "",
    mediaKind: null,
    mediaDuration: "",
    display: {
      title: true,
      image: true,
      excerpt: true,
      date: true,
      category: true,
      series: true,
      introCard: true,
    },
  },
];

const returningItem = {
  ...baseItems[0],
  id: 999001,
  slug: "topic-999001",
  href: "/topics/999001",
  title: "Returned item 999001",
  image: "/images/returned.jpg",
  imageAlt: "Returned",
  date: "2026-09-02",
  publishedAt: "2026-09-02T00:00:00.000Z",
};

const baseConfig = parseFeaturedModuleConfig({
  source: { kind: "categories", categorySlug: "reference-category" },
  selection: { mode: "manual", topicIds: initialIds },
  itemLimit: 6,
  itemsPerView: 6,
  display: {
    title: true,
    image: false,
    category: false,
    series: false,
    excerpt: false,
    date: false,
  },
  presentation: {
    variant: "list",
    eyebrow: "اختيارات",
    title: "عنوان محفوظ",
    description: "وصف محفوظ",
    ctaText: "التفاصيل",
  },
});

const qa = {
  actionCalls: 0,
  submissions: [],
  persistedIds: [],
  persistedConfig: baseConfig,
  publicSourceItems: [],
  publicRequests: [],
  generation: 0,
  mountInitial: null,
  reloadPersisted: null,
  runPublicIntegration: null,
};

window.__FEATURED_PRESERVATION_QA__ = qa;
const editorRoot = createRoot(document.getElementById("editor-root"));
const publicRoot = createRoot(document.getElementById("public-root"));

function editorOptions(returnedIds = []) {
  const returned = returnedIds.includes(returningItem.id) ? [returningItem] : [];
  return {
    categories: [
      {
        id: 1,
        slug: "reference-category",
        name: "Reference",
        parentId: null,
        depth: 0,
        scopeSlugs: ["reference-category"],
      },
    ],
    items: [...baseItems, ...returned].map((item) => ({
      id: item.id,
      contentType: item.contentType,
      title: item.title,
      categorySlug: item.categorySlug,
      publishedAt: item.publishedAt,
    })),
  };
}

function FeaturedHarness({ config, options }) {
  const updateAction = React.useCallback(async (formData) => {
    const ids = formData.getAll("manual_topic_ids").map(Number);
    qa.actionCalls += 1;
    qa.submissions.push(ids);
    qa.persistedConfig = buildFeaturedModuleConfig(formData);
    qa.persistedIds =
      qa.persistedConfig.selection.mode === "manual"
        ? [...qa.persistedConfig.selection.topicIds]
        : [];
  }, []);

  return React.createElement(FeaturedModuleEditClient, {
    block: {
      id: 41,
      name: "Featured preservation QA",
      slug: "featured-preservation-qa",
      description: "Isolated QA only",
      status: "published",
    },
    config,
    editorOptions: options,
    assignmentContext: {},
    saved: false,
    updateAction,
  });
}

function mountEditor(config, returnedIds = []) {
  qa.generation += 1;
  flushSync(() => {
    editorRoot.render(
      React.createElement(FeaturedHarness, {
        key: "featured-generation-" + qa.generation,
        config,
        options: editorOptions(returnedIds),
      }),
    );
  });
}

qa.mountInitial = () => {
  qa.actionCalls = 0;
  qa.submissions.length = 0;
  qa.persistedIds = [];
  qa.persistedConfig = baseConfig;
  mountEditor(baseConfig);
};

qa.reloadPersisted = (returnedIds = []) => {
  mountEditor(qa.persistedConfig, returnedIds);
};

function resolvedModule(config, items) {
  return {
    assignmentId: 1,
    templateId: 41,
    sortOrder: 1,
    ...config,
    items,
  };
}

qa.runPublicIntegration = async () => {
  qa.publicRequests.length = 0;
  qa.publicSourceItems = [baseItems[1], baseItems[0]];
  const resolved = await resolveFeaturedItems(baseConfig);
  flushSync(() => {
    publicRoot.render(
      React.createElement(FeaturedModuleSection, {
        module: resolvedModule(baseConfig, resolved),
      }),
    );
  });
  const renderedIds = Array.from(
    document.querySelectorAll("#public-root article"),
  ).map((article) =>
    Number(
      article
        .querySelector("a[href^='/topics/']")
        ?.getAttribute("data-qa-content-id"),
    ),
  );
  const renderedText = document.getElementById("public-root").textContent || "";

  qa.publicSourceItems = [];
  const empty = await resolveFeaturedItems(baseConfig);
  flushSync(() => {
    publicRoot.render(
      React.createElement(FeaturedModuleSection, {
        module: resolvedModule(baseConfig, empty),
      }),
    );
  });

  return {
    resolvedIds: resolved.map((item) => item.id),
    renderedIds,
    renderedText,
    emptyMarkup: document.getElementById("public-root").innerHTML,
    requests: qa.publicRequests.map((input) => ({
      includeIds: input.includeIds ? [...input.includeIds] : undefined,
    })),
  };
};
`;

const uiMockSource = String.raw`
import * as React from "react";

export const ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME = "";

export function AdminCheckbox({ label, checked, onChange }) {
  return React.createElement("input", {
    type: "checkbox",
    "aria-label": label,
    checked,
    onChange,
  });
}

export function AdminFormGrid({ children }) {
  return React.createElement("div", null, children);
}

export function AdminFormListboxSelect({ name, label, value, onChange, options }) {
  return React.createElement(
    "select",
    {
      name,
      "aria-label": label,
      value,
      onChange: (event) => onChange(event.currentTarget.value),
    },
    options.map((option) =>
      React.createElement(
        "option",
        { key: option.value, value: option.value },
        option.label,
      ),
    ),
  );
}

export function AdminFormSwitch({
  name,
  value = "on",
  uncheckedValue = "false",
  defaultChecked = false,
}) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("input", {
      type: "hidden",
      name,
      value: uncheckedValue,
    }),
    React.createElement("input", {
      type: "checkbox",
      name,
      value,
      defaultChecked,
    }),
  );
}

export function AdminStatusPill({ children }) {
  return React.createElement("span", null, children);
}
`;

const presentationMockSource = String.raw`
import * as React from "react";

export const MODULE_EDITOR_CONTROL_CARD_CLASS_NAME = "";

export function ModuleEditorHeader() {
  return null;
}

export function ModuleEditorFeedback() {
  return null;
}

export function ModuleEditorField({ children }) {
  return React.createElement("div", null, children);
}

export function ModuleEditorFieldGrid({ children }) {
  return React.createElement("div", null, children);
}

export function ModuleEditorIdentitySection({ name, status }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("input", { name: "name", defaultValue: name }),
    React.createElement("input", { name: "status", defaultValue: status }),
  );
}

export function ModuleEditorPagesTab() {
  return null;
}

export function ModuleEditorSaveArea() {
  return React.createElement(
    "button",
    { type: "submit", "data-qa-featured-save": "" },
    "Save Featured",
  );
}

export function ModuleEditorSection({ children }) {
  return React.createElement("section", null, children);
}

export function ModuleEditorSectionHeading({ children }) {
  return React.createElement("h2", null, children);
}

export function ModuleEditorTabs({ activePanelContext, tabs }) {
  return React.createElement(
    React.Fragment,
    null,
    activePanelContext,
    tabs.map((tab) => React.createElement("div", { key: tab.id }, tab.content)),
  );
}

export function ModuleEditorVisibilityAlignRow({
  children,
  showName,
  boldName,
  alignmentName,
  showDefault = true,
  boldDefault = false,
  alignmentDefault = "right",
}) {
  const inputs = [];
  if (showName) {
    inputs.push(
      React.createElement("input", {
        key: showName,
        type: "hidden",
        name: showName,
        value: showDefault ? "true" : "false",
      }),
    );
  }
  if (boldName) {
    inputs.push(
      React.createElement("input", {
        key: boldName,
        type: "hidden",
        name: boldName,
        value: boldDefault ? "true" : "false",
      }),
    );
  }
  if (alignmentName) {
    inputs.push(
      React.createElement("input", {
        key: alignmentName,
        type: "hidden",
        name: alignmentName,
        value: alignmentDefault,
      }),
    );
  }
  return React.createElement(React.Fragment, null, ...inputs, children);
}
`;

const publicOwnerMockSource = String.raw`
export async function loadPublicContentCollection(input) {
  const qa = globalThis.__FEATURED_PRESERVATION_QA__;
  qa.publicRequests.push(input);
  const included = new Set(input.includeIds || []);
  const items = qa.publicSourceItems.filter((item) => included.has(item.id));
  return {
    featured: null,
    items,
    totalCount: items.length,
    page: 1,
    pageSize: input.pageSize || items.length,
    totalPages: 1,
    startIndex: items.length ? 1 : 0,
    endIndex: items.length,
  };
}
`;

const emptyModuleSource = "export default {};";

const imageMockSource = String.raw`
import * as React from "react";
export default function Image({ fill, priority, loader, unoptimized, ...props }) {
  return React.createElement("img", props);
}
`;

const linkMockSource = String.raw`
import * as React from "react";
export default function Link({ href, children, ...props }) {
  const idMatch = String(href).match(/(\d+)$/);
  return React.createElement(
    "a",
    { href: String(href), "data-qa-content-id": idMatch ? idMatch[1] : "", ...props },
    children,
  );
}
`;

async function compileHarness(rootDir: string, tempDir: string) {
  const uiMockPath = path.join(tempDir, "admin-ui.mock.js");
  const presentationMockPath = path.join(
    tempDir,
    "module-editor-presentation.mock.js",
  );
  const publicOwnerMockPath = path.join(tempDir, "public-content-owner.mock.js");
  const emptyModulePath = path.join(tempDir, "empty-module.mock.js");
  const imageMockPath = path.join(tempDir, "next-image.mock.js");
  const linkMockPath = path.join(tempDir, "next-link.mock.js");
  await Promise.all([
    writeFile(uiMockPath, uiMockSource, "utf8"),
    writeFile(presentationMockPath, presentationMockSource, "utf8"),
    writeFile(publicOwnerMockPath, publicOwnerMockSource, "utf8"),
    writeFile(emptyModulePath, emptyModuleSource, "utf8"),
    writeFile(imageMockPath, imageMockSource, "utf8"),
    writeFile(linkMockPath, linkMockSource, "utf8"),
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
    target: "web",
    context: rootDir,
    entry: `data:text/javascript;charset=utf-8,${encodeURIComponent(entrySource)}`,
    output: {
      path: tempDir,
      filename: "featured-editor-preservation.bundle.js",
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
        "@featured-editor": path.join(
          rootDir,
          "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
        ),
        "@featured-section": path.join(
          rootDir,
          "src/components/featured/FeaturedModuleSection.tsx",
        ),
        "@featured-config": path.join(
          rootDir,
          "src/lib/featured-modules/config.ts",
        ),
        "@featured-resolver": path.join(
          rootDir,
          "src/lib/featured-modules/resolve-featured-items.ts",
        ),
        "../ui$": uiMockPath,
        "./ModuleEditorPresentation$": presentationMockPath,
        "../content/public-content-read/owner$": publicOwnerMockPath,
        "server-only$": emptyModulePath,
        "next/image$": imageMockPath,
        "next/link$": linkMockPath,
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
                serverReferenceHashSalt: "featured-editor-preservation-qa",
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
        compiler.close(() =>
          reject(error ?? new Error("Webpack returned no stats.")),
        );
        return;
      }
      const info = stats.toJson({
        all: false,
        errors: true,
        warnings: true,
      });
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

    if (requestUrl.pathname === "/featured-editor-preservation.bundle.js") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
      });
      response.end(bundle);
      return;
    }

    if (requestUrl.pathname === "/harness") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(
        '<!doctype html><html dir="rtl"><body><main id="editor-root"></main><aside id="public-root"></aside><script src="/featured-editor-preservation.bundle.js"></script></body></html>',
      );
      return;
    }

    response.writeHead(204);
    response.end();
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
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function observeBrowserIssues(page: Page, issues: BrowserIssue[]) {
  page.on("console", (message) => {
    if (message.type() !== "warning" && message.type() !== "error") return;
    issues.push({
      kind: "console",
      detail: `${message.type()}: ${message.text()}`,
    });
  });
  page.on("pageerror", (error) => {
    issues.push({ kind: "pageerror", detail: error.message });
  });
  page.on("requestfailed", (request) => {
    issues.push({
      kind: "requestfailed",
      detail: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    });
  });
}

async function readManualIds(page: Page) {
  return await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#editor-root form");
    assertForm(form);
    return new FormData(form)
      .getAll("manual_topic_ids")
      .map((value) => Number(value));

    function assertForm(
      candidate: HTMLFormElement | null,
    ): asserts candidate is HTMLFormElement {
      if (!candidate) throw new Error("Featured editor form was not mounted.");
    }
  });
}

const rootDir = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
let browser: Browser | null = null;
let page: Page | null = null;
let server: Server | null = null;

try {
  const webpackWarnings = await compileHarness(rootDir, tempDir);
  const harness = await startHarnessServer(
    path.join(tempDir, "featured-editor-preservation.bundle.js"),
  );
  server = harness.server;
  const browserIssues: BrowserIssue[] = [];

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  observeBrowserIssues(page, browserIssues);
  await page.goto(`${harness.baseUrl}/harness`, { waitUntil: "load" });
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as FeaturedHarnessWindow)
        .__FEATURED_PRESERVATION_QA__,
    ),
  );
  await page.evaluate(() => {
    (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__.mountInitial();
  });
  await page.locator("[data-featured-manual-selection-order]").waitFor();

  check(
    "the real Featured editor loads all authored IDs in order and renders two explicit tombstones",
    JSON.stringify(await readManualIds(page)) ===
      JSON.stringify([701, 999001, 503, 999002]) &&
      (await page.locator('[data-featured-resolution="unresolved"]').count()) === 2 &&
      (await page.locator('[data-featured-resolution="resolved"]').count()) === 2,
  );

  await page.locator("[data-qa-featured-save]").click();
  await page.waitForFunction(() => {
    const qa = (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__;
    return qa.actionCalls === 1 && qa.persistedIds.length === 4;
  });
  const firstSave = await page.evaluate(() => {
    const qa = (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__;
    return { submissions: qa.submissions, persistedIds: qa.persistedIds };
  });
  check(
    "the fake updateAction receives and persists every available and unavailable ID in authored order",
    JSON.stringify(firstSave.submissions) ===
      JSON.stringify([[701, 999001, 503, 999002]]) &&
      JSON.stringify(firstSave.persistedIds) ===
        JSON.stringify([701, 999001, 503, 999002]),
  );

  await page.evaluate(() => {
    (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__.reloadPersisted();
  });
  await page.locator("[data-featured-manual-selection-order]").waitFor();
  check(
    "a full real-editor remount reloads the saved IDs and tombstones without loss or reordering",
    JSON.stringify(await readManualIds(page)) ===
      JSON.stringify([701, 999001, 503, 999002]) &&
      (await page.locator('[data-featured-resolution="unresolved"]').count()) === 2,
  );

  await page.locator('[data-featured-manual-remove="999002"]').click();
  check(
    "explicit removal deletes only the requested tombstone and preserves every other authored ID",
    JSON.stringify(await readManualIds(page)) ===
      JSON.stringify([701, 999001, 503]) &&
      (await page.locator('[data-featured-manual-remove="999002"]').count()) === 0 &&
      (await page.locator('[data-featured-manual-remove="999001"]').count()) === 1,
  );

  await page.locator("[data-qa-featured-save]").click();
  await page.waitForFunction(() => {
    const qa = (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__;
    return qa.actionCalls === 2 && qa.persistedIds.length === 3;
  });
  await page.evaluate(() => {
    (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__.reloadPersisted([999001]);
  });
  await page.locator('[data-featured-item-id="999001"]').waitFor();
  const returningEvidence = {
    ids: await readManualIds(page),
    resolution: await page
      .locator('[data-featured-item-id="999001"]')
      .getAttribute("data-featured-resolution"),
    text: await page.locator('[data-featured-item-id="999001"]').textContent(),
  };
  check(
    "a returning source row resolves the original persisted ID in place after reload",
    JSON.stringify(returningEvidence.ids) ===
      JSON.stringify([701, 999001, 503]) &&
      returningEvidence.resolution === "resolved" &&
      returningEvidence.text?.includes("Returned item 999001"),
  );

  const publicEvidence = await page.evaluate(async () =>
    await (window as unknown as FeaturedHarnessWindow)
      .__FEATURED_PRESERVATION_QA__.runPublicIntegration(),
  );
  check(
    "the actual public resolver restores authored order from a reversed mocked read and omits unresolved IDs",
    JSON.stringify(publicEvidence.resolvedIds) === JSON.stringify([701, 503]) &&
      publicEvidence.requests.length === 2 &&
      publicEvidence.requests.every(
        (request) =>
          JSON.stringify(request.includeIds) ===
          JSON.stringify([701, 999001, 503, 999002]),
      ),
  );
  check(
    "the actual public Featured presenter renders only real resolved rows and safely suppresses an empty result",
    JSON.stringify(publicEvidence.renderedIds) === JSON.stringify([701, 503]) &&
      publicEvidence.renderedText.indexOf("Available item 701") <
      publicEvidence.renderedText.indexOf("Available item 503") &&
      !publicEvidence.renderedText.includes("999001") &&
      !publicEvidence.renderedText.includes("999002") &&
      publicEvidence.emptyMarkup === "",
  );

  check(
    "the isolated Featured browser run has no console, page, request, or webpack errors",
    browserIssues.length === 0 && webpackWarnings.length === 0,
  );

  console.log(`Featured editor preservation QA passed (${passed}/${passed}).`);
} finally {
  if (page) await page.close({ runBeforeUnload: false }).catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  if (server) await stopServer(server).catch(() => undefined);
  await rm(validateTempPath(tempDir), { recursive: true, force: true });
}
