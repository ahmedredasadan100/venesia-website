import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { chromium, type Browser, type Page } from "playwright";

import {
  parseGalleryPayloadFromForm,
  parseMediaTopicPayload,
} from "../src/lib/admin/media-topic-payload.ts";
import type { Json } from "../src/lib/database.types.ts";

const require = createRequire(import.meta.url);
const TEMP_PREFIX = "venesia-shared-gallery-authoring-";

type GalleryItem = {
  url: string;
  alt: string;
  caption: string;
};

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

type GalleryHarnessState = {
  actionCalls: number;
  submissions: GalleryItem[][];
  persistedItems: GalleryItem[];
  mountInitial: (items: GalleryItem[]) => void;
  reloadPersisted: () => void;
  mountPaths: (sourceMode: "defaultValue" | "defaultPaths") => void;
};

type GalleryHarnessWindow = Window & {
  __ADMIN_SHARED_GALLERY_QA__: GalleryHarnessState;
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
import { createRoot } from "react-dom/client";
import AdminFeedbackProvider from "@admin-feedback-provider";
import AdminFormRuntime, { useAdminFormRuntime } from "@admin-form-runtime";
import AdminMediaGalleryField from "@admin-media-gallery-field";

const qa = {
  actionCalls: 0,
  submissions: [],
  persistedItems: [],
  generation: 0,
  mountInitial: null,
  reloadPersisted: null,
  mountPaths: null,
};

window.__ADMIN_SHARED_GALLERY_QA__ = qa;

function readGalleryItems(formData) {
  const urls = formData.getAll("gallery_image_url").map(String);
  const alts = formData.getAll("gallery_image_alt").map(String);
  const captions = formData.getAll("gallery_image_caption").map(String);
  return urls.map((url, index) => ({
    url,
    alt: alts[index] ?? "",
    caption: captions[index] ?? "",
  }));
}

function RuntimeProbe() {
  const runtime = useAdminFormRuntime();
  return React.createElement(
    "output",
    {
      id: "qa-runtime-state",
      "data-dirty": runtime.isDirty ? "true" : "false",
      "data-pending": runtime.pending ? "true" : "false",
      "data-status": runtime.state.status,
    },
    runtime.state.status,
  );
}

function GalleryHarness({ initialItems, generation }) {
  const action = React.useCallback(async (previousState, formData) => {
    qa.actionCalls += 1;
    const submitted = readGalleryItems(formData);
    qa.submissions.push(submitted);
    const revision = previousState.revision + 1;

    if (qa.actionCalls === 1) {
      return {
        status: "error",
        mode: "edit",
        revision,
        title: "Gallery validation failed",
        message: "The isolated action intentionally failed once.",
        focusTarget: "gallery_image_alt",
        fieldErrors: {
          gallery_image_url: ["Gallery image selection must be reviewed."],
          gallery_image_alt: ["Gallery image alt text must be reviewed."],
        },
      };
    }

    qa.persistedItems = submitted.map((item) => ({ ...item }));
    return {
      status: "success",
      mode: "edit",
      revision,
      title: "Gallery saved",
      message: "The isolated Gallery payload was saved.",
      savedRevision: "gallery-saved-" + revision,
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
        entityKey: "qa-shared-gallery",
        formId: "qa-gallery-form",
        navigation: {
          fields: {
            gallery_image_url: {
              tabId: "basic",
              targetId: "gallery_image_url",
            },
            gallery_image_alt: {
              tabId: "basic",
              targetId: "gallery_image_alt",
            },
          },
        },
      },
      React.createElement("input", {
        type: "hidden",
        name: "qa_generation",
        value: String(generation),
      }),
      React.createElement(AdminMediaGalleryField, {
        valueMode: "items",
        name: "gallery_image_url",
        altName: "gallery_image_alt",
        captionName: "gallery_image_caption",
        label: "صور المعرض",
        defaultItems: initialItems,
        dimensionHint: "content",
        focusTargetId: "gallery_image_url",
        altFocusTargetId: "gallery_image_alt",
      }),
      React.createElement(
        "button",
        { type: "submit", "data-qa-gallery-save": "" },
        "Save Gallery",
      ),
      React.createElement(RuntimeProbe),
    ),
  );
}

const legacyPaths = [
  "/images/legacy-gallery-first.jpg",
  "/images/legacy-gallery-second.jpg",
];

function PathsHarness({ sourceMode }) {
  const action = React.useCallback(
    async (previousState) => ({
      ...previousState,
      revision: previousState.revision + 1,
    }),
    [],
  );
  const defaults =
    sourceMode === "defaultPaths"
      ? { defaultPaths: legacyPaths }
      : { defaultValue: legacyPaths.join("\n") };

  return React.createElement(
    AdminFeedbackProvider,
    null,
    React.createElement(
      AdminFormRuntime,
      {
        action,
        mode: "edit",
        entityKey: "qa-shared-gallery-paths",
        formId: "qa-gallery-paths-form",
      },
      React.createElement("span", {
        hidden: true,
        "data-qa-path-source": sourceMode,
      }),
      React.createElement(AdminMediaGalleryField, {
        ...defaults,
        name: "legacy_gallery_paths",
        label: "Legacy shared Gallery paths",
        dimensionHint: "content",
      }),
      React.createElement(RuntimeProbe),
    ),
  );
}

const root = createRoot(document.getElementById("root"));

function render(items) {
  qa.generation += 1;
  root.render(
    React.createElement(GalleryHarness, {
      key: "gallery-generation-" + qa.generation,
      initialItems: items.map((item) => ({ ...item })),
      generation: qa.generation,
    }),
  );
}

qa.mountInitial = (items) => {
  qa.actionCalls = 0;
  qa.submissions.length = 0;
  qa.persistedItems = [];
  render(items);
};
qa.reloadPersisted = () => render(qa.persistedItems);
qa.mountPaths = (sourceMode) => {
  qa.generation += 1;
  root.render(
    React.createElement(PathsHarness, {
      key: "gallery-paths-generation-" + qa.generation,
      sourceMode,
    }),
  );
};
`;

const navigationMockSource = String.raw`
export { unstable_rethrow } from "next/dist/client/components/unstable-rethrow.browser";
export function useRouter() {
  return {
    push() {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    prefetch() { return Promise.resolve(); },
  };
}
`;

const imageMockSource = String.raw`
import * as React from "react";
export default function Image({ fill, priority, loader, unoptimized, ...props }) {
  return React.createElement("img", props);
}
`;

const mediaPickerMockSource = String.raw`
import * as React from "react";

export function AdminMediaPickerModal({ open, onClose, onSelect }) {
  if (!open) return null;
  const choose = (path) => {
    onSelect(path);
    onClose();
  };
  return React.createElement(
    "div",
    { role: "dialog", "aria-label": "Isolated Gallery media picker" },
    React.createElement(
      "button",
      {
        type: "button",
        "data-picker-choice": "replacement",
        onClick: () => choose("/images/gallery-replaced.jpg"),
      },
      "Choose replacement",
    ),
    React.createElement(
      "button",
      {
        type: "button",
        "data-picker-choice": "added",
        onClick: () => choose("/images/gallery-added.jpg"),
      },
      "Choose added image",
    ),
  );
}

export default AdminMediaPickerModal;
`;

async function compileHarness(rootDir: string, tempDir: string) {
  const navigationMockPath = path.join(tempDir, "next-navigation.mock.js");
  const imageMockPath = path.join(tempDir, "next-image.mock.js");
  const mediaPickerMockPath = path.join(
    tempDir,
    "admin-media-picker-modal.mock.js",
  );
  await Promise.all([
    writeFile(navigationMockPath, navigationMockSource, "utf8"),
    writeFile(imageMockPath, imageMockSource, "utf8"),
    writeFile(mediaPickerMockPath, mediaPickerMockSource, "utf8"),
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
      filename: "shared-gallery-authoring.bundle.js",
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
        "@admin-media-gallery-field": path.join(
          rootDir,
          "src/components/admin/media/AdminMediaGalleryField.tsx",
        ),
        "next/navigation": navigationMockPath,
        "next/image": imageMockPath,
        "./AdminMediaPickerModal$": mediaPickerMockPath,
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
                serverReferenceHashSalt: "shared-gallery-authoring-qa",
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

    if (requestUrl.pathname === "/shared-gallery-authoring.bundle.js") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
      });
      response.end(bundle);
      return;
    }

    if (requestUrl.pathname === "/harness") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html dir=\"rtl\"><body><main id=\"root\"></main><script src=\"/shared-gallery-authoring.bundle.js\"></script></body></html>",
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

async function readGalleryItems(page: Page) {
  return await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#qa-gallery-form");
    if (!form) return null;
    const formData = new FormData(form);
    const urls = formData.getAll("gallery_image_url").map(String);
    const alts = formData.getAll("gallery_image_alt").map(String);
    const captions = formData.getAll("gallery_image_caption").map(String);
    return urls.map((url, index) => ({
      url,
      alt: alts[index] ?? "",
      caption: captions[index] ?? "",
    }));
  });
}

async function waitForRuntime(
  page: Page,
  expected: Partial<{
    dirty: "true" | "false";
    pending: "true" | "false";
    status: "idle" | "error" | "warning" | "success";
  }>,
) {
  await page.waitForFunction((next) => {
    const probe = document.querySelector<HTMLOutputElement>(
      "#qa-runtime-state",
    );
    if (!probe) return false;
    return (
      (next.dirty === undefined || probe.dataset.dirty === next.dirty) &&
      (next.pending === undefined || probe.dataset.pending === next.pending) &&
      (next.status === undefined || probe.dataset.status === next.status)
    );
  }, expected);
}

async function waitForItems(page: Page, expected: GalleryItem[]) {
  await page.waitForFunction((next) => {
    const form = document.querySelector<HTMLFormElement>("#qa-gallery-form");
    if (!form) return false;
    const formData = new FormData(form);
    const urls = formData.getAll("gallery_image_url").map(String);
    const alts = formData.getAll("gallery_image_alt").map(String);
    const captions = formData.getAll("gallery_image_caption").map(String);
    const current = urls.map((url, index) => ({
      url,
      alt: alts[index] ?? "",
      caption: captions[index] ?? "",
    }));
    return JSON.stringify(current) === JSON.stringify(next);
  }, expected);
}

async function waitForPathValue(page: Page, expected: string) {
  await page.waitForFunction((next) => {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="legacy_gallery_paths"]',
    );
    return input?.value === next;
  }, expected);
}

async function runPGliteRoundTrip() {
  const formData = new FormData();
  formData.append("gallery_image_url", "/images/jsonb-first.jpg");
  formData.append("gallery_image_alt", "JSONB first alt");
  formData.append("gallery_image_caption", "JSONB first caption");
  formData.append("gallery_image_url", "/images/jsonb-second.jpg");
  formData.append("gallery_image_alt", "JSONB second alt");
  formData.append("gallery_image_caption", "");

  const payload = parseGalleryPayloadFromForm(formData);
  check(
    "the actual Gallery FormData parser preserves ordered URL, alt, and nullable caption values",
    payload.images.length === 2 &&
      payload.images[0]?.url === "/images/jsonb-first.jpg" &&
      payload.images[0]?.alt === "JSONB first alt" &&
      payload.images[0]?.caption === "JSONB first caption" &&
      payload.images[1]?.url === "/images/jsonb-second.jpg" &&
      payload.images[1]?.alt === "JSONB second alt" &&
      payload.images[1]?.caption === null,
  );

  const db = await PGlite.create();
  try {
    await db.exec(
      "create table qa_gallery_payloads (id bigint primary key, media_payload jsonb not null);",
    );
    await db.query(
      "insert into qa_gallery_payloads(id, media_payload) values ($1, $2::jsonb)",
      [1, JSON.stringify(payload)],
    );
    const result = await db.query<{ media_payload: unknown }>(
      "select media_payload from qa_gallery_payloads where id = $1",
      [1],
    );
    const reloaded = parseMediaTopicPayload(
      result.rows[0]?.media_payload as Json,
    );
    check(
      "isolated in-memory PostgreSQL JSONB save and actual payload reload are exact",
      JSON.stringify(reloaded) === JSON.stringify(payload),
    );
  } finally {
    await db.close();
  }
}

const initialItems: GalleryItem[] = [
  {
    url: "/images/gallery-first.jpg",
    alt: "First alt",
    caption: "First caption",
  },
  {
    url: "/images/gallery-second.jpg",
    alt: "Second alt",
    caption: "Second caption",
  },
];
const finalItems: GalleryItem[] = [
  {
    url: "/images/gallery-replaced.jpg",
    alt: "First alt",
    caption: "First caption",
  },
  {
    url: "/images/gallery-added.jpg",
    alt: "Added alt",
    caption: "Added caption",
  },
];

const rootDir = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
let browser: Browser | null = null;
let page: Page | null = null;
let server: Server | null = null;

try {
  await runPGliteRoundTrip();

  const webpackWarnings = await compileHarness(rootDir, tempDir);
  const harness = await startHarnessServer(
    path.join(tempDir, "shared-gallery-authoring.bundle.js"),
  );
  server = harness.server;
  const browserIssues: BrowserIssue[] = [];

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  observeBrowserIssues(page, browserIssues);
  await page.goto(`${harness.baseUrl}/harness`, { waitUntil: "load" });
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as GalleryHarnessWindow)
        .__ADMIN_SHARED_GALLERY_QA__,
    ),
  );
  await page.evaluate((items) => {
    (window as unknown as GalleryHarnessWindow)
      .__ADMIN_SHARED_GALLERY_QA__.mountInitial(items);
  }, initialItems);
  await page.locator("#qa-gallery-form[data-admin-form-runtime]").waitFor();
  await waitForRuntime(page, { dirty: "false", status: "idle" });

  check(
    "the actual shared Gallery owner loads the existing ordered URL, alt, and caption values",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(initialItems),
  );

  await page
    .locator(
      '[data-admin-media-gallery-index="0"] [data-admin-media-gallery-action="replace"]',
    )
    .click();
  await page.locator('[data-picker-choice="replacement"]').click();
  const afterReplace = [
    { ...initialItems[0]!, url: "/images/gallery-replaced.jpg" },
    initialItems[1]!,
  ];
  await waitForItems(page, afterReplace);
  await waitForRuntime(page, { dirty: "true" });
  check(
    "confirmed shared-picker replacement preserves the row metadata and marks the form dirty",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(afterReplace),
  );

  await page.locator('[data-admin-media-gallery-action="add"]').click();
  await page.locator('[data-picker-choice="added"]').click();
  await page
    .locator('input[name="gallery_image_alt"]')
    .nth(2)
    .fill("Added alt");
  await page
    .locator('input[name="gallery_image_caption"]')
    .nth(2)
    .fill("Added caption");
  const afterAdd = [
    ...afterReplace,
    {
      url: "/images/gallery-added.jpg",
      alt: "Added alt",
      caption: "Added caption",
    },
  ];
  await waitForItems(page, afterAdd);
  check(
    "confirmed shared-picker add projects aligned URL, alt, and caption controls",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(afterAdd),
  );

  await page
    .locator(
      '[data-admin-media-gallery-index="2"] [data-admin-media-gallery-action="move-up"]',
    )
    .click();
  const afterReorder = [afterAdd[0]!, afterAdd[2]!, afterAdd[1]!];
  await waitForItems(page, afterReorder);
  await page
    .locator(
      '[data-admin-media-gallery-index="2"] [data-admin-media-gallery-action="remove"]',
    )
    .click();
  await waitForItems(page, finalItems);
  check(
    "reorder and remove keep each Gallery row atomic and preserve the intended final order",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(finalItems),
  );

  await page.locator("[data-qa-gallery-save]").click();
  await waitForRuntime(page, { dirty: "true", status: "error" });
  await page.waitForFunction(
    () => document.activeElement?.id === "gallery_image_alt",
  );
  check(
    "server field errors focus the visible shared control and preserve the complete dirty Gallery state",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(finalItems) &&
      (await page.locator("#gallery_image_url-error").count()) === 1 &&
      (await page.locator("#gallery_image_alt-error").count()) === 1 &&
      (await page.locator("#gallery_image_alt").getAttribute("aria-invalid")) ===
        "true",
  );

  await page.locator("[data-qa-gallery-save]").click();
  await waitForRuntime(page, { dirty: "false", status: "success" });
  const actionEvidence = await page.evaluate(() => {
    const qa = (window as unknown as GalleryHarnessWindow)
      .__ADMIN_SHARED_GALLERY_QA__;
    return {
      actionCalls: qa.actionCalls,
      submissions: qa.submissions,
      persistedItems: qa.persistedItems,
    };
  });
  check(
    "a successful retry submits the exact preserved Gallery payload once per attempt and marks it clean",
    actionEvidence.actionCalls === 2 &&
      actionEvidence.submissions.length === 2 &&
      actionEvidence.submissions.every(
        (items) => JSON.stringify(items) === JSON.stringify(finalItems),
      ) &&
      JSON.stringify(actionEvidence.persistedItems) === JSON.stringify(finalItems),
  );

  await page.evaluate(() => {
    (window as unknown as GalleryHarnessWindow)
      .__ADMIN_SHARED_GALLERY_QA__.reloadPersisted();
  });
  await waitForItems(page, finalItems);
  await waitForRuntime(page, { dirty: "false", status: "idle" });
  check(
    "a full component remount reloads the saved ordered URL, alt, and caption values exactly",
    JSON.stringify(await readGalleryItems(page)) === JSON.stringify(finalItems),
  );

  const legacyInitialValue = [
    "/images/legacy-gallery-first.jpg",
    "/images/legacy-gallery-second.jpg",
  ].join("\n");
  await page.evaluate(() => {
    (window as unknown as GalleryHarnessWindow)
      .__ADMIN_SHARED_GALLERY_QA__.mountPaths("defaultValue");
  });
  await page.locator("#qa-gallery-paths-form[data-admin-form-runtime]").waitFor();
  await page
    .locator('[data-qa-path-source="defaultValue"]')
    .waitFor({ state: "attached" });
  await waitForPathValue(page, legacyInitialValue);
  await waitForRuntime(page, { dirty: "false", status: "idle" });
  check(
    "legacy shared Gallery path mode preserves newline defaultValue serialization",
    (await page.locator('input[name="legacy_gallery_paths"]').inputValue()) ===
      legacyInitialValue,
  );

  await page.evaluate(() => {
    (window as unknown as GalleryHarnessWindow)
      .__ADMIN_SHARED_GALLERY_QA__.mountPaths("defaultPaths");
  });
  await page
    .locator('[data-qa-path-source="defaultPaths"]')
    .waitFor({ state: "attached" });
  await waitForPathValue(page, legacyInitialValue);
  await waitForRuntime(page, { dirty: "false", status: "idle" });
  await page
    .locator(
      '[data-admin-media-gallery-index="0"] [data-admin-media-gallery-action="replace"]',
    )
    .click();
  await page.locator('[data-picker-choice="replacement"]').click();
  await page.locator('[data-admin-media-gallery-action="add"]').click();
  await page.locator('[data-picker-choice="added"]').click();
  await page
    .locator(
      '[data-admin-media-gallery-index="2"] [data-admin-media-gallery-action="move-up"]',
    )
    .click();
  await page
    .locator(
      '[data-admin-media-gallery-index="0"] [data-admin-media-gallery-action="remove"]',
    )
    .click();
  const legacyFinalValue = [
    "/images/gallery-added.jpg",
    "/images/legacy-gallery-second.jpg",
  ].join("\n");
  await waitForPathValue(page, legacyFinalValue);
  await waitForRuntime(page, { dirty: "true" });
  check(
    "legacy defaultPaths consumers retain picker add, replace, reorder, remove, and dirty behavior",
    (await page.locator('input[name="legacy_gallery_paths"]').inputValue()) ===
      legacyFinalValue,
  );

  check(
    "the isolated browser run has no console, page, request, or webpack errors",
    browserIssues.length === 0 && webpackWarnings.length === 0,
  );

  console.log(`Shared Gallery authoring QA passed (${passed}/${passed}).`);
} finally {
  if (page) await page.close({ runBeforeUnload: false }).catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  if (server) await stopServer(server).catch(() => undefined);
  await rm(validateTempPath(tempDir), { recursive: true, force: true });
}
