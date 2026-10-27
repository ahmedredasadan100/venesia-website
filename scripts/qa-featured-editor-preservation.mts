import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { chromium, type Browser, type Page } from "playwright";

const require = createRequire(import.meta.url);
const TEMP_PREFIX = "venesia-featured-editor-preservation-";
const standalone = Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));

// Real-owner SSR/save acceptance exits before the historical mocked Browser run.
if (standalone && process.argv.includes("--premium-offline")) {
  await verifyFeaturedPremiumOffline();
}

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

export function AdminCard({ children }) { return React.createElement("section", null, children); }
export function AdminFormControlHeader({ title, description }) { return React.createElement("header", null, title, description); }

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
  const linkMockPath = path.join(tempDir, "next-link.mock.js");
  await Promise.all([
    writeFile(uiMockPath, uiMockSource, "utf8"),
    writeFile(presentationMockPath, presentationMockSource, "utf8"),
    writeFile(publicOwnerMockPath, publicOwnerMockSource, "utf8"),
    writeFile(emptyModulePath, emptyModuleSource, "utf8"),
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

type FeaturedNativeControl = {
  name: string; type: string; value: string; checked: boolean;
  mounted: true; visible: boolean; enabled: boolean; submitted: boolean;
  required: boolean; min: string | null; max: string | null; options: string[];
};

/** Observe the real rendered tree, including hidden/disabled ancestor semantics. */
function featuredNativeControls(html: string): FeaturedNativeControl[] {
  type Node = { tag: string; attrs: Record<string, string>; children: (Node | string)[]; parent: Node | null };
  const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/gi, match => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" }[match.toLowerCase()] ?? match));
  const tree: Node = { tag: "#document", attrs: {}, children: [], parent: null }, stack = [tree], nodes: Node[] = [];
  const voids = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+\b[^>]*>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith("<!--") || text.startsWith("<!")) continue;
    if (text.startsWith("</")) {
      const tag = text.slice(2).match(/^[\w-]+/)![0].toLowerCase(), index = stack.findLastIndex(node => node.tag === tag);
      assert.ok(index > 0); stack.length = index;
    } else if (text.startsWith("<")) {
      const tag = text.slice(1).match(/^[\w-]+/)![0].toLowerCase(), attrs = Object.fromEntries([...text.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(([, key, double, single, bare]) => [key.toLowerCase(), decode(double ?? single ?? bare ?? "")]));
      const node: Node = { tag, attrs, children: [], parent: stack.at(-1)! }; stack.at(-1)!.children.push(node); nodes.push(node);
      if (!voids.has(tag) && !text.endsWith("/>")) stack.push(node);
    } else stack.at(-1)!.children.push(decode(text));
  }
  const ancestors = (node: Node) => { const values: Node[] = []; for (let current: Node | null = node; current; current = current.parent) values.push(current); return values; };
  const textOf = (node: Node): string => node.children.map(child => typeof child === "string" ? child : textOf(child)).join("");
  return nodes.filter(node => ["input", "textarea", "select"].includes(node.tag) && node.attrs.name).map(node => {
    const parents = ancestors(node), type = node.attrs.type || node.tag, checked = "checked" in node.attrs;
    const enabled = !parents.some(parent => parent === node ? "disabled" in parent.attrs : parent.tag === "fieldset" && "disabled" in parent.attrs);
    const hidden = parents.some(parent => "hidden" in parent.attrs || (parent.attrs.class ?? "").split(/\s+/).includes("hidden") || /display\s*:\s*none/i.test(parent.attrs.style ?? ""));
    const options = nodes.filter(option => option.tag === "option" && ancestors(option).includes(node));
    const option = options.find(value => "selected" in value.attrs) ?? options[0];
    const value = node.tag === "textarea" ? textOf(node) : node.tag === "select" ? option?.attrs.value ?? (option ? textOf(option) : "") : node.attrs.value ?? "";
    return { name: node.attrs.name, type, value, checked, mounted: true, visible: type !== "hidden" && !hidden, enabled, submitted: enabled && (!["checkbox", "radio"].includes(type) || checked), required: "required" in node.attrs, min: node.attrs.min ?? null, max: node.attrs.max ?? null, options: options.map(value => value.attrs.value ?? textOf(value)) };
  });
}

export async function verifyFeaturedPremiumOffline() {
  const fixtureRoot = process.cwd(), editorFile = "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx";
  const baselineArg = process.argv.find(value => value.startsWith("--baseline-file="));
  let baseline: { path: string; hash: string; content: string }, baselineOrigin: string;
  if (baselineArg) {
    const captured = JSON.parse(await readFile(baselineArg.slice(16), "utf8")) as { entries: { path: string; hash: string; content: string }[] };
    const entry = captured.entries.find(value => value.path.replaceAll("\\", "/") === editorFile); assert.ok(entry, "Captured baseline must include actual Featured editor");
    baseline = entry; baselineOrigin = baselineArg.slice(16);
  } else {
    const { execFileSync } = await import("node:child_process");
    const bytes = execFileSync("git", ["show", "HEAD:" + editorFile], { cwd: fixtureRoot, windowsHide: true });
    baseline = { path: editorFile, hash: createHash("sha256").update(bytes).digest("hex"), content: bytes.toString("base64") }; baselineOrigin = "git HEAD:" + editorFile;
  }
  const beforeSource = Buffer.from(baseline.content, "base64").toString("utf8");
  assert.equal(createHash("sha256").update(beforeSource).digest("hex").toUpperCase(), baseline.hash.toUpperCase());
  const outputArg = process.argv.find(value => value.startsWith("--output-dir=")), outputDir = path.resolve(fixtureRoot, outputArg?.slice(13) ?? ".tmp-qa/featured-editor-preservation/current");
  assert.ok(outputDir.startsWith(path.join(fixtureRoot, ".tmp-qa") + path.sep)); await mkdir(outputDir, { recursive: true });
  type Config = import("../src/lib/featured-modules/contract").FeaturedModuleConfig;
  type Harness = { load: (file: string, roots?: string[]) => Record<string, unknown>; files: Set<string>; state: { writes: number } };
  type Ports = Map<string, unknown>;
  const { createRemainingContentOwnerHarness } = require("./fixtures/remaining-content-owner-harness.mjs") as { createRemainingContentOwnerHarness: (root: string, options?: { sourceOverrides?: Map<string, string>; additionalPorts?: Ports }) => Harness };
  const React = require("react") as typeof import("react"), { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  const noAction = async () => { throw Error("Undeclared Featured QA transport"); };
  const ports: Ports = new Map<string, unknown>([
    ["next/navigation", { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/admin/pages-blocks/blocks/featured/3", useSearchParams: () => new URLSearchParams("tab=content"), redirect: noAction }],
    ["next/link", { __esModule: true, default: ({ href, children, ...props }: { href: string; children: import("react").ReactNode; prefetch?: unknown }) => { delete props.prefetch; return React.createElement("a", { ...props, href }, children); } }],
    ["next/image", { __esModule: true, default: (input: Record<string, unknown>) => { const props = { ...input }; for (const key of ["fill", "priority", "unoptimized", "quality", "loader"]) delete props[key]; return React.createElement("img", props); } }],
  ]);
  const previousFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error("Offline Featured acceptance forbids network"); };
  try {
    const before = createRemainingContentOwnerHarness(fixtureRoot, { sourceOverrides: new Map([[editorFile, beforeSource]]), additionalPorts: ports }), after = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts: ports });
    const owner = after.load(path.join(fixtureRoot, "src/lib/featured-modules/config.ts")) as unknown as { parseFeaturedModuleConfig: (input: Record<string, unknown>) => Config; buildFeaturedModuleConfig: (data: FormData) => Config };
    const contract = after.load(path.join(fixtureRoot, "src/lib/featured-modules/contract.ts")) as unknown as { FEATURED_PRESENTATION_VARIANTS: Config["presentation"]["variant"][]; FEATURED_SELECTION_MODES: Config["selection"]["mode"][]; featuredPresentationProfile: (variant: Config["presentation"]["variant"]) => { supportsNavigation: boolean; itemsPerView: { mode: string } } };
    const contentTypes = after.load(path.join(fixtureRoot, "src/lib/admin/content/content-types.ts")).MEDIA_EDITABLE_CONTENT_TYPES as import("../src/lib/admin/content/content-types").MediaEditableContentType[];
    const formattingFields = after.load(path.join(fixtureRoot, "src/lib/page-blocks/configs.ts")).CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS as string[];
    const options = { categories: [{ id: 1, slug: "reference-category", name: "Reference", parentId: null, depth: 0, scopeSlugs: ["reference-category", "child-category"] }], items: [{ id: 701, contentType: "article", title: "Available article", categorySlug: "child-category", publishedAt: "2026-10-20T00:00:00Z" }, ...contentTypes.map((contentType, index) => ({ id: 801 + index, contentType, title: contentType, categorySlug: "", publishedAt: "2026-10-20T00:00:00Z" }))] };
    const assignments = { pages: [{ id: 1, title: "Home", slug: "home", path: "/" }, { id: 3, title: "Media", slug: "media-center", path: "/media-center" }], assignments: [{ id: 11, page_id: 1, template_id: 3, slot: "main", sort_order: 20, is_visible: true, page_title: "Home", page_slug: "home", page_path: "/" }] };
    const render = (harness: Harness, config: Config, slug: string) => {
      const Editor = harness.load(path.join(fixtureRoot, editorFile)).default as import("react").ElementType;
      const Feedback = harness.load(path.join(fixtureRoot, "src/components/admin/AdminFeedbackProvider.tsx")).default as import("react").ElementType;
      return renderToStaticMarkup(React.createElement(Feedback, null, React.createElement(Editor, { block: { id: 3, name: "Featured isolated", slug, description: "Retained internal note", status: "unpublished" }, config, editorOptions: options, assignmentContext: assignments, updateAction: noAction })));
    };
    const native = (fields: FeaturedNativeControl[]) => fields.map(({ visible, ...field }) => { void visible; return field; }).sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
    const dataFor = (fields: FeaturedNativeControl[]) => { const data = new FormData(); for (const field of fields) if (field.submitted) data.append(field.name, field.value); return data; };
    const cases: Record<string, unknown>[] = [], negatives: string[] = [];
    const sources: Config["source"][] = [{ kind: "categories", categorySlug: "reference-category" }, ...contentTypes.map(contentType => ({ kind: "media-center" as const, contentType }))];
    let representativeData: FormData | undefined, representativeConfig: Config | undefined;
    for (const source of sources) for (const variant of contract.FEATURED_PRESENTATION_VARIANTS) for (const mode of contract.FEATURED_SELECTION_MODES) {
      const config = owner.parseFeaturedModuleConfig({ source, selection: { mode, topicIds: [701, 999001, 503, 999002] }, itemLimit: 9, itemsPerView: 3, navigation: { showArrows: false, showDots: true, autoplay: false }, display: { title: false, image: true, category: false, series: true, excerpt: false, date: true }, displayFormatting: { titleBold: true, titleAlignment: "left", excerptBold: true, excerptAlignment: "center" }, presentation: { variant, eyebrow: "Retained eyebrow", title: "Retained title", description: "Retained description", ctaText: "Retained action", showTitle: false, titleBold: false, titleAlignment: "left", showDescription: false, descriptionBold: true, descriptionAlignment: "center", showCta: false, ctaBold: true, ctaAlignment: "left" } });
      const slug = source.kind === "media-center" && source.contentType === "news" ? "media-featured-content-news" : "featured-isolated-" + source.kind;
      const original = featuredNativeControls(render(before, config, slug)), current = featuredNativeControls(render(after, config, slug));
      const requiredFields = ["id", "name", "slug", "description", "status", "source_kind", "selection_mode", "item_limit", "presentation_variant", "items_per_view", "show_navigation_arrows", "show_navigation_dots", "navigation_autoplay", "eyebrow", "title", "presentation_description", "cta_text", ...["eyebrow", "title", "description", "cta"].flatMap(field => ["show_" + field, field + "_bold", field + "_alignment"]), ...Object.keys(config.display).map(field => "show_" + field + "_on_page"), ...["title", ...formattingFields].flatMap(field => ["display_" + field + "_bold", "display_" + field + "_alignment"])];
      assert.ok(requiredFields.every(name => current.some(field => field.name === name)), "Every canonical config capability has its real native control");
      assert.deepEqual(native(current), native(original), "Every native field/value/enabled/submitted/limit/option preserved: " + JSON.stringify({ source, variant, mode }));
      const profile = contract.featuredPresentationProfile(variant);
      assert.equal(current.some(field => field.name === "category_slug"), source.kind === "categories"); assert.equal(current.some(field => field.name === "content_type"), source.kind === "media-center");
      assert.equal(current.filter(field => field.name === "manual_topic_ids").length, mode === "manual" ? 4 : 0);
      if (mode === "manual") assert.deepEqual(current.filter(field => field.name === "manual_topic_ids").map(field => field.value), ["701", "999001", "503", "999002"], "Manual unresolved IDs/order preserved");
      assert.equal(current.find(field => field.name === "items_per_view")?.type, profile.itemsPerView.mode === "fixed" ? "hidden" : "number");
      assert.equal(current.filter(field => field.name === "show_navigation_arrows").some(field => field.type === "checkbox"), profile.supportsNavigation);
      const data = dataFor(current), expected = owner.buildFeaturedModuleConfig(dataFor(original)), saved = owner.buildFeaturedModuleConfig(data);
      assert.deepEqual(saved, expected, "Canonical saved shape unchanged"); assert.deepEqual(owner.buildFeaturedModuleConfig(dataFor(featuredNativeControls(render(after, saved, slug)))), saved, "Canonical save/reload/save stable");
      assert.ok(current.filter(field => ["title", "presentation_description", "cta_text", "display_title_alignment"].includes(field.name)).every(field => field.enabled && field.submitted), "Inactive display/text values still participate");
      cases.push({ source, variant, mode, before: original, after: current, nativeParity: true, canonicalParity: true, reloadParity: true, conditional: { manualMounted: mode === "manual", sourceField: source.kind === "categories" ? "category_slug" : "content_type", countMode: profile.itemsPerView.mode, navigationMounted: profile.supportsNavigation }, boundary: "Actual React SSR and serializer/remount; event transitions and computed visibility require Browser" });
      if (!representativeData && mode === "manual") { representativeData = data; representativeConfig = saved; }
    }
    assert.ok(representativeData && representativeConfig);
    for (const [field, value] of [["category_slug", ""], ["manual_topic_ids", ""], ["item_limit", "0"], ["item_limit", "1.5"], ["item_limit", "13"]]) {
      const invalid = new FormData(); for (const [key, item] of representativeData) invalid.append(key, item); invalid.delete(field); invalid.set(field, value);
      assert.throws(() => owner.buildFeaturedModuleConfig(invalid)); negatives.push(field + "=" + value);
    }
    // Execute the actual mutation action while replacing only external write/read
    // infrastructure. The real parser, assignment-ID parser, action and redirect run.
    let writeCount = 0, failWrite = false, persisted: unknown = null, assignedPages: number[] = [];
    const assignmentOwner = after.load(path.join(fixtureRoot, "src/lib/page-blocks/sync-module-page-assignments.ts"), ["parsePageIdsFromForm"]);
    const savePorts: Ports = new Map(ports);
    savePorts.set("next/navigation", { redirect: (href: string) => { throw Object.assign(Error("isolated redirect"), { href }); } });
    savePorts.set("src/lib/supabase-admin", { getSupabaseAdmin: () => ({ from: (table: string) => { assert.equal(table, "featured_module_templates"); const query = { select() { return query; }, eq() { return query; }, neq() { return query; }, limit() { return query; }, async maybeSingle() { return { data: null, error: null }; } }; return query; } }) });
    savePorts.set("src/lib/page-blocks/sync-module-page-assignments", { parsePageIdsFromForm: assignmentOwner.parsePageIdsFromForm, async saveModuleTemplateWithPageAssignments(kind: string, id: number, row: unknown, pageIds: number[]) { assert.equal(kind, "featured"); assert.equal(id, 3); if (failWrite) throw Error("isolated_featured_save_failure"); writeCount++; persisted = structuredClone(row); assignedPages = pageIds; return { id, affectedPageIds: pageIds }; } });
    savePorts.set("src/lib/page-blocks/admin-revalidate", { revalidateBlockModulePaths: async () => {}, revalidateCommittedPageBlockAction: async (value: unknown) => value });
    const actionHarness = createRemainingContentOwnerHarness(fixtureRoot, { additionalPorts: savePorts });
    const update = actionHarness.load(path.join(fixtureRoot, "src/app/admin/pages-blocks/blocks/featured/actions.ts"), ["updateFeaturedModule"]).updateFeaturedModule as (data: FormData) => Promise<void>;
    await assert.rejects(() => update(representativeData!), (error: unknown) => Boolean(error && typeof error === "object" && "href" in error && String(error.href).includes("/admin/pages-blocks/blocks/featured/3?saved=1")));
    assert.equal(writeCount, 1); assert.deepEqual((persisted as { config: Config }).config, representativeConfig);
    assert.deepEqual(assignedPages, (assignmentOwner.parsePageIdsFromForm as (data: FormData) => number[])(representativeData));
    const acceptedRow = structuredClone(persisted); failWrite = true; await assert.rejects(() => update(representativeData!), /isolated_featured_save_failure/); assert.deepEqual(persisted, acceptedRow); assert.equal(writeCount, 1);
    const routeFile = "src/app/admin/pages-blocks/blocks/featured/[id]/page.tsx", route = ts.createSourceFile(routeFile, await readFile(path.join(fixtureRoot, routeFile), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let bound = false; const visit = (node: ts.Node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(route) === "FeaturedModuleEditClient") bound = node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === "updateAction" && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression?.getText(route) === "updateFeaturedModule"); ts.forEachChild(node, visit); }; visit(route); assert.ok(bound, "Real route binds actual tested save action");
    const files = new Set([...after.files, ...actionHarness.files, editorFile, routeFile, "scripts/qa-featured-editor-preservation.mts", "package.json", "package-lock.json"]);
    const sourceHashes = Object.fromEntries(await Promise.all([...files].sort().map(async file => [file, createHash("sha256").update(await readFile(path.join(fixtureRoot, file))).digest("hex")])));
    const receipt = { status: "PASS", reference: { rule: "ADMIN_UI_RULES §11.a-d", sources: ["src/components/admin/page-blocks/FeedPresentationVariantFields.tsx", "src/components/admin/page-blocks/editors/SearchPlatformModuleEditor.tsx"], applicability: "Source/choice/count/conditional navigation and formatted display composition; Featured owns its own profiles and does not adopt Feed independent variant storage or Search fields" }, baseline: { file: baselineOrigin, editorHash: baseline.hash }, sourceHashes, cases, negatives, savePath: { routeFile, action: "updateFeaturedModule", executedActualAction: true, parser: "buildFeaturedModuleConfig", assignments: "real parsePageIdsFromForm; external transactional write replaced by bounded in-memory port", successfulWrites: writeCount, failureRetainsSavedRow: true }, acceptance: { functional: "PASS", architecture: "consumer-only presentation; domain owners unchanged", technicalVisual: "pending Browser", ownerApproval: "pending" }, boundary: { network: false, database: false, browser: false, realAuth: false, publicRendering: false } };
    await writeFile(path.join(outputDir, "featured-capability-preservation.json"), JSON.stringify(receipt, null, 2) + "\n");
    console.log("Featured Premium preservation PASS: " + cases.length + " real source/variant/selection states; native/parser/remount parity; actual action success/failure and assignments. Browser/Owner pending.");
  } finally { globalThis.fetch = previousFetch; }
}

async function runLegacyFeaturedBrowser() {
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
    "the actual public Featured presenter renders resolved rows and reserves its authored shell without phantom items",
    JSON.stringify(publicEvidence.renderedIds) === JSON.stringify([701, 503]) &&
      publicEvidence.renderedText.indexOf("Available item 701") <
      publicEvidence.renderedText.indexOf("Available item 503") &&
      !publicEvidence.renderedText.includes("999001") &&
      !publicEvidence.renderedText.includes("999002") &&
      publicEvidence.emptyMarkup.includes("data-featured-resolved-items=\"0\"") &&
      !publicEvidence.emptyMarkup.includes("<article"),
  );

  if (browserIssues.length || webpackWarnings.length) console.error(JSON.stringify({ browserIssues, webpackWarnings }, null, 2));
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
}

if (standalone && !process.argv.includes("--premium-offline")) await runLegacyFeaturedBrowser();
