import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";

const require = createRequire(import.meta.url);
const TEMP_PREFIX = "venesia-admin-form-navigation-";
const TOPIC_NEWS_PATH = "/admin/content/topics/new?type=news";
const TOPIC_PRESS_PATH = "/admin/content/topics/new?type=press";
const CREATED_TOPIC_EDIT_PATH = "/admin/content/topics/42";

type HarnessOptions = {
  mode: "create" | "edit";
  actionOutcome: "success" | "error" | "create-edit";
  deferAction?: boolean;
};

type ContentActionOutcome =
  | "success"
  | "video-error"
  | "thumbnail-error"
  | "gallery-error";

type ContentHarnessOptions = {
  actionOutcomes?: ContentActionOutcome[];
  deferAction?: boolean;
  seedDraft?: {
    content: string;
    baselineRevision: string | null;
  };
};

type ContentEditorModelSnapshot = {
  value: Record<string, string>;
  requestPreset: (presetKey: string) => boolean;
};

type RouterEvent = {
  kind: "push" | "replace";
  href: string;
  options: unknown;
};

type HarnessState = {
  routerEvents: RouterEvent[];
  actionCalls: number;
  submissions: Array<Array<[string, string]>>;
  releaseAction: (() => void) | null;
  runtime: {
    requestInternalNavigation: (href: string) => void;
  } | null;
  contentModel: ContentEditorModelSnapshot | null;
  mount: (options: HarnessOptions) => void;
  mountContent: (options: ContentHarnessOptions) => void;
};

type HarnessWindow = Window & {
  __ADMIN_FORM_GUARDED_NAV_QA__: HarnessState;
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

type BrowserIssue = {
  kind: "console" | "pageerror" | "requestfailed";
  detail: string;
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
import TopicContentTypeControl from "@topic-content-type-control";
import ContentEditorShell from "@content-editor-shell";
import TopicMarkdownEditor from "@topic-markdown-editor";
import SeoPanel from "@seo-panel";
import MediaVideoFields from "@media-video-fields";
import MediaGalleryFields from "@media-gallery-fields";
import { createTopicDraft } from "@topic-revision";

const qa = {
  routerEvents: [],
  actionCalls: 0,
  submissions: [],
  releaseAction: null,
  runtime: null,
  contentModel: null,
  router: null,
  mount: null,
  mountContent: null,
};

qa.router = {
  push(href, options) {
    qa.routerEvents.push({ kind: "push", href: String(href), options: options ?? null });
  },
  replace(href, options) {
    qa.routerEvents.push({ kind: "replace", href: String(href), options: options ?? null });
  },
  back() {},
  forward() {},
  refresh() {},
  prefetch() { return Promise.resolve(); },
};

window.__ADMIN_FORM_GUARDED_NAV_QA__ = qa;

function RuntimeProbe() {
  const runtime = useAdminFormRuntime();
  qa.runtime = runtime;
  return React.createElement(
    "output",
    {
      id: "qa-runtime-state",
      "data-dirty": runtime.isDirty ? "true" : "false",
      "data-pending": runtime.pending ? "true" : "false",
      "data-status": runtime.state.status,
      "data-revision": String(runtime.state.revision),
    },
    runtime.state.status,
  );
}

function Harness({ mode, actionOutcome, deferAction = false }) {
  const action = React.useCallback(
    async (previousState, formData) => {
      qa.actionCalls += 1;
      qa.submissions.push(Array.from(formData.entries()));
      if (deferAction) {
        await new Promise((resolve) => {
          qa.releaseAction = () => {
            qa.releaseAction = null;
            resolve();
          };
        });
      }

      const revision = previousState.revision + 1;
      if (actionOutcome === "error") {
        return {
          status: "error",
          mode,
          revision,
          title: "QA save failed",
          message: "The in-memory action intentionally failed.",
          fieldErrors: {},
        };
      }
      if (actionOutcome === "create-edit") {
        return {
          status: "success",
          mode: "create",
          revision,
          entityId: 42,
          editHref: "/admin/content/topics/42",
          savedRevision: "created-42",
        };
      }
      return {
        status: "success",
        mode,
        revision,
        savedRevision: "saved-" + revision,
      };
    },
    [actionOutcome, deferAction, mode],
  );

  return React.createElement(
    AdminFeedbackProvider,
    null,
    React.createElement(
      AdminFormRuntime,
      {
        action,
        mode,
        entityKey: "qa-topic",
        formId: "qa-admin-form",
      },
      React.createElement("input", {
        id: "qa-title",
        name: "title",
        defaultValue: "Initial title",
      }),
      React.createElement(TopicContentTypeControl, {
        value: "article",
        mode,
      }),
      React.createElement(
        "button",
        { id: "qa-submit", type: "submit" },
        "Save",
      ),
      React.createElement(RuntimeProbe),
    ),
  );
}

const CONTENT_DRAFT_IDENTITY = "qa-content-topic";
const INITIAL_CONTENT_MODEL = {
  title: "Initial content title",
  excerpt: "Initial content excerpt",
  content: "# Initial content",
  seoTitle: "Initial SEO title",
  seoDescription: "Initial SEO description",
  focusKeyword: "initial keyword",
};

function ModelTextInput({ id, name, field, model }) {
  return React.createElement("input", {
    id,
    name,
    value: model.value[field],
    onChange: (event) => model.setField(field, event.target.value),
  });
}

function ModelTextArea({ id, name, field, model }) {
  return React.createElement("textarea", {
    id,
    name,
    value: model.value[field],
    onChange: (event) => model.setField(field, event.target.value),
  });
}

function ContentHarness({ actionOutcomes = ["success"], deferAction = false }) {
  const action = React.useCallback(
    async (previousState, formData) => {
      qa.actionCalls += 1;
      qa.submissions.push(Array.from(formData.entries()));
      if (deferAction && qa.actionCalls === 1) {
        await new Promise((resolve) => {
          qa.releaseAction = () => {
            qa.releaseAction = null;
            resolve();
          };
        });
      }

      const revision = previousState.revision + 1;
      const outcome =
        actionOutcomes[Math.min(qa.actionCalls - 1, actionOutcomes.length - 1)] ??
        "success";
      if (outcome === "video-error") {
        return {
          status: "error",
          mode: "create",
          revision,
          title: "Video validation failed",
          message: "The in-memory action returned video field errors.",
          focusTarget: "video_url",
          fieldErrors: {
            video_url: ["Video URL is invalid."],
            video_duration: ["Video duration is invalid."],
            video_thumbnail: ["Video thumbnail is required."],
          },
        };
      }
      if (outcome === "thumbnail-error") {
        return {
          status: "error",
          mode: "create",
          revision,
          title: "Thumbnail validation failed",
          message: "The in-memory action returned a thumbnail field error.",
          focusTarget: "video_thumbnail",
          fieldErrors: {
            video_thumbnail: ["Video thumbnail is required."],
          },
        };
      }
      if (outcome === "gallery-error") {
        return {
          status: "error",
          mode: "create",
          revision,
          title: "Gallery validation failed",
          message: "The in-memory action returned gallery field errors.",
          focusTarget: "gallery_image_url",
          fieldErrors: {
            gallery_image_url: ["Gallery image URL is required."],
            gallery_image_alt: ["Gallery image alt text is required."],
          },
        };
      }
      return {
        status: "success",
        mode: "create",
        revision,
        savedRevision: "content-saved-" + revision,
      };
    },
    [actionOutcomes, deferAction],
  );

  const renderTabs = React.useCallback(
    (model) => {
      qa.contentModel = model;
      return [
        {
          id: "basic",
          navigationLabel: "Basic",
          content: React.createElement(
            "div",
            { id: "qa-content-basic" },
            React.createElement(ModelTextInput, {
              id: "content-title",
              name: "title",
              field: "title",
              model,
            }),
            React.createElement(ModelTextArea, {
              id: "content-excerpt",
              name: "excerpt",
              field: "excerpt",
              model,
            }),
            React.createElement(TopicMarkdownEditor, {
              defaultValue: INITIAL_CONTENT_MODEL.content,
              value: model.value.content,
              onValueChange: (value) => model.setField("content", value),
              variant: "compact",
              draftIdentity: CONTENT_DRAFT_IDENTITY,
              baselineRevision: null,
            }),
            React.createElement(MediaVideoFields, {
              defaultVideoUrl: "https://www.youtube.com/watch?v=qa",
              defaultDuration: "1:30",
              defaultThumbnail: "",
            }),
            React.createElement(MediaGalleryFields, {
              defaultImages: [
                {
                  url: "/images/qa-gallery.jpg",
                  alt: "QA gallery alt",
                  caption: "QA gallery caption",
                },
              ],
            }),
            React.createElement(RuntimeProbe),
          ),
        },
        {
          id: "seo",
          navigationLabel: "SEO",
          content: React.createElement(SeoPanel, {
            title: INITIAL_CONTENT_MODEL.title,
            excerpt: INITIAL_CONTENT_MODEL.excerpt,
            slug: "qa-content",
            content: INITIAL_CONTENT_MODEL.content,
            image: "",
            imageAlt: "",
            seoTitle: INITIAL_CONTENT_MODEL.seoTitle,
            seoDescription: INITIAL_CONTENT_MODEL.seoDescription,
            seoKeywords: [],
            focusKeyword: INITIAL_CONTENT_MODEL.focusKeyword,
            canonicalUrl: "",
            robotsIndex: null,
            robotsFollow: null,
            ogImage: "",
            ogImageAlt: "",
            faq: [],
            controlledValues: {
              title: model.value.title,
              excerpt: model.value.excerpt,
              content: model.value.content,
              seoTitle: model.value.seoTitle,
              seoDescription: model.value.seoDescription,
              focusKeyword: model.value.focusKeyword,
            },
            onControlledValueChange: (field, value) =>
              model.setField(field, value),
          }),
        },
      ];
    },
    [],
  );

  return React.createElement(
    AdminFeedbackProvider,
    null,
    React.createElement(ContentEditorShell, {
      action,
      contentType: "news",
      mode: "create",
      closeHref: "/admin/content/media",
      formId: "qa-content-form",
      initialModelValue: INITIAL_CONTENT_MODEL,
      templateContext: { target: "media", mediaContentType: "news" },
      tabs: renderTabs,
    }),
  );
}

const root = createRoot(document.getElementById("root"));
qa.mount = (options) => {
  qa.routerEvents.length = 0;
  qa.actionCalls = 0;
  qa.submissions.length = 0;
  qa.releaseAction = null;
  qa.runtime = null;
  qa.contentModel = null;
  root.render(React.createElement(Harness, options));
};
qa.mountContent = (options = {}) => {
  qa.routerEvents.length = 0;
  qa.actionCalls = 0;
  qa.submissions.length = 0;
  qa.releaseAction = null;
  qa.runtime = null;
  qa.contentModel = null;
  const draftKey = "venesia-topic-editor-draft:" + CONTENT_DRAFT_IDENTITY;
  window.localStorage.removeItem(draftKey);
  if (options.seedDraft) {
    window.localStorage.setItem(
      draftKey,
      JSON.stringify(
        createTopicDraft(
          options.seedDraft.content,
          options.seedDraft.baselineRevision,
        ),
      ),
    );
  }
  root.render(React.createElement(ContentHarness, options));
};
`;

const navigationMockSource = String.raw`
export function useRouter() {
  return window.__ADMIN_FORM_GUARDED_NAV_QA__.router;
}
export function usePathname() {
  return window.location.pathname;
}
export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
`;

const linkMockSource = String.raw`
import * as React from "react";
export default function Link({ href, children, ...props }) {
  const resolvedHref = typeof href === "string" ? href : String(href ?? "#");
  return React.createElement("a", { ...props, href: resolvedHref }, children);
}
`;

const imageMockSource = String.raw`
import * as React from "react";
export default function Image({ fill, priority, loader, unoptimized, ...props }) {
  return React.createElement("img", props);
}
`;

const mediaPickerMockSource = String.raw`
export function AdminMediaPickerModal() {
  return null;
}
export default AdminMediaPickerModal;
`;

async function compileHarness(rootDir: string, tempDir: string) {
  const navigationMockPath = path.join(tempDir, "next-navigation.mock.js");
  const linkMockPath = path.join(tempDir, "next-link.mock.js");
  const imageMockPath = path.join(tempDir, "next-image.mock.js");
  const mediaPickerMockPath = path.join(
    tempDir,
    "admin-media-picker-modal.mock.js",
  );
  await Promise.all([
    writeFile(navigationMockPath, navigationMockSource, "utf8"),
    writeFile(linkMockPath, linkMockSource, "utf8"),
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
      filename: "admin-form-navigation.bundle.js",
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
        "@topic-content-type-control": path.join(
          rootDir,
          "src/components/admin/content/editors/TopicContentTypeControl.tsx",
        ),
        "@content-editor-shell": path.join(
          rootDir,
          "src/components/admin/content/editors/ContentEditorShell.tsx",
        ),
        "@topic-markdown-editor": path.join(
          rootDir,
          "src/components/admin/content/editors/article/TopicMarkdownEditor.tsx",
        ),
        "@seo-panel": path.join(
          rootDir,
          "src/components/admin/SeoPanel.tsx",
        ),
        "@media-video-fields": path.join(
          rootDir,
          "src/components/admin/content/editors/media/MediaVideoFields.tsx",
        ),
        "@media-gallery-fields": path.join(
          rootDir,
          "src/components/admin/content/editors/media/MediaGalleryFields.tsx",
        ),
        "@topic-revision": path.join(
          rootDir,
          "src/lib/admin/content/topic-revision.ts",
        ),
        "../../ui$": path.join(
          rootDir,
          "src/components/admin/ui/AdminForm.tsx",
        ),
        "next/navigation": navigationMockPath,
        "next/link": linkMockPath,
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
                serverReferenceHashSalt: "admin-form-navigation-qa",
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
    const requestUrl = new URL(
      request.url ?? "/",
      "http://127.0.0.1",
    );
    response.setHeader("Cache-Control", "no-store");

    if (requestUrl.pathname === "/admin-form-navigation.bundle.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(bundle);
      return;
    }
    if (requestUrl.pathname === "/destination") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html><body><main id=\"qa-destination\">Destination</main></body></html>",
      );
      return;
    }
    if (requestUrl.pathname === "/harness") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html dir=\"rtl\"><body><main id=\"root\"></main><script src=\"/admin-form-navigation.bundle.js\"></script></body></html>",
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
  assert.ok(address && typeof address !== "string", "Harness server did not bind to TCP.");
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
  const allowedFailedRequestUrls = new Set<string>();
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
    if (allowedFailedRequestUrls.has(request.url())) return;
    issues.push({
      kind: "requestfailed",
      detail: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    });
  });
  return allowedFailedRequestUrls;
}

async function openHarness(
  browser: Browser,
  harnessUrl: string,
  options: HarnessOptions,
  issues: BrowserIssue[],
) {
  const page = await browser.newPage();
  const allowedFailedRequestUrls = observeBrowserIssues(page, issues);
  await page.goto(harnessUrl, { waitUntil: "load" });
  assert.ok(
    await page.evaluate(() =>
      Boolean(
        (window as unknown as HarnessWindow)
          .__ADMIN_FORM_GUARDED_NAV_QA__,
      ),
    ),
    `Harness bundle did not initialize: ${JSON.stringify(issues)}`,
  );
  await page.evaluate((mountOptions) => {
    (window as unknown as HarnessWindow).__ADMIN_FORM_GUARDED_NAV_QA__.mount(
      mountOptions,
    );
  }, options);
  await page.locator("[data-admin-form-runtime]").waitFor({
    state: "attached",
    timeout: 10_000,
  });
  await page.waitForFunction(() => {
    const qa = (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__;
    return (
      typeof qa.runtime?.requestInternalNavigation === "function" &&
      document
        .querySelector("[data-admin-form-runtime]")
        ?.getAttribute("data-admin-form-dirty") === "false"
    );
  });
  return { page, allowedFailedRequestUrls };
}

async function openContentHarness(
  browser: Browser,
  harnessUrl: string,
  options: ContentHarnessOptions,
  issues: BrowserIssue[],
) {
  const page = await browser.newPage();
  const allowedFailedRequestUrls = observeBrowserIssues(page, issues);
  await page.goto(harnessUrl, { waitUntil: "load" });
  assert.ok(
    await page.evaluate(() =>
      Boolean(
        (window as unknown as HarnessWindow)
          .__ADMIN_FORM_GUARDED_NAV_QA__,
      ),
    ),
    `Content harness bundle did not initialize: ${JSON.stringify(issues)}`,
  );
  await page.evaluate((mountOptions) => {
    (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.mountContent(mountOptions);
  }, options);
  await page.locator("#qa-content-form[data-admin-form-runtime]").waitFor({
    state: "attached",
    timeout: 10_000,
  });
  await page.locator('[data-admin-rich-text-scope] [contenteditable="true"]').waitFor({
    state: "attached",
    timeout: 10_000,
  });
  await page.waitForFunction((expectedDirty) => {
    const qa = (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__;
    return (
      Boolean(qa.contentModel) &&
      typeof qa.runtime?.requestInternalNavigation === "function" &&
      document
        .querySelector("#qa-content-form")
        ?.getAttribute("data-admin-form-dirty") === expectedDirty
    );
  }, options.seedDraft ? "true" : "false");
  return { page, allowedFailedRequestUrls };
}

async function selectContentPreset(page: Page, label: string) {
  await page
    .locator(
      '[role="combobox"][aria-labelledby="content-template-picker-label"]',
    )
    .click();
  const option = page.getByRole("option", { name: label, exact: true });
  await option.waitFor({ state: "visible" });
  await option.click();
  await page.locator("[data-content-template-apply]").click();
}

async function getContentModelValue(page: Page) {
  return await page.evaluate(() => {
    const value = (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.contentModel?.value;
    return value ? { ...value } : null;
  });
}

async function requestContentPreset(page: Page, presetKey: string) {
  return await page.evaluate((key) => {
    return (
      (window as unknown as HarnessWindow)
        .__ADMIN_FORM_GUARDED_NAV_QA__.contentModel?.requestPreset(key) ?? false
    );
  }, presetKey);
}

async function getLiveFormValues(page: Page) {
  return await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#qa-content-form");
    if (!form) return null;
    return Object.fromEntries(
      Array.from(new FormData(form).entries()).map(([name, value]) => [
        name,
        typeof value === "string" ? value : value.name,
      ]),
    );
  });
}

async function getLastSubmission(page: Page) {
  return await page.evaluate(() => {
    const submissions = (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.submissions;
    const entries = submissions.at(-1) ?? [];
    return Object.fromEntries(entries);
  });
}

async function waitForContentModelValue(
  page: Page,
  expected: Partial<Record<string, string>>,
) {
  await page.waitForFunction((next) => {
    const value = (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.contentModel?.value;
    return (
      Boolean(value) &&
      Object.entries(next).every(([field, fieldValue]) => value?.[field] === fieldValue)
    );
  }, expected);
}

async function selectTopicType(page: Page, contentType: "news" | "press") {
  await page
    .locator('[role="combobox"][aria-label="نوع المحتوى"]')
    .click();
  const option = page.locator(
    `#topic-content-type-popover-option-${contentType}`,
  );
  await option.waitFor({ state: "visible" });
  await option.click();
}

async function getRouterEvents(page: Page) {
  return (await page.evaluate(() => {
    return (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.routerEvents;
  })) as RouterEvent[];
}

async function getActionCalls(page: Page) {
  return await page.evaluate(() => {
    return (window as unknown as HarnessWindow)
      .__ADMIN_FORM_GUARDED_NAV_QA__.actionCalls;
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

async function closePage(page: Page) {
  await page.close({ runBeforeUnload: false });
}

const rootDir = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
let browser: Browser | null = null;
let server: Server | null = null;

try {
  const webpackWarnings = await compileHarness(rootDir, tempDir);
  const harnessServer = await startHarnessServer(
    path.join(tempDir, "admin-form-navigation.bundle.js"),
  );
  server = harnessServer.server;
  const harnessUrl = `${harnessServer.baseUrl}/harness`;
  const destinationUrl = `${harnessServer.baseUrl}/destination`;
  const browserIssues: BrowserIssue[] = [];
  browser = await chromium.launch({ headless: true });

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    await selectTopicType(page, "news");
    await page.waitForFunction(() => {
      return (
        (window as unknown as HarnessWindow).__ADMIN_FORM_GUARDED_NAV_QA__
          .routerEvents.length === 1
      );
    });
    const events = await getRouterEvents(page);
    check(
      "clean Topic type navigation is immediate, internal, and dialog-free",
      events.length === 1 &&
        events[0]?.kind === "push" &&
        events[0]?.href === TOPIC_NEWS_PATH &&
        (await page.locator("[data-admin-confirm-dialog]").count()) === 0,
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    const originalUrl = page.url();
    await page.locator("#qa-title").fill("Dirty title");
    await waitForRuntime(page, { dirty: "true" });
    await selectTopicType(page, "news");
    await page.locator("[data-admin-confirm-dialog]").waitFor({
      state: "visible",
    });
    const eventsBeforeCancel = await getRouterEvents(page);
    await page.locator("[data-admin-confirm-cancel]").click();
    await page.locator("[data-admin-confirm-dialog]").waitFor({
      state: "detached",
    });
    check(
      "dirty navigation opens one shared dialog and cancel preserves URL, value, and dirty state",
      eventsBeforeCancel.length === 0 &&
        page.url() === originalUrl &&
        (await page.locator("#qa-title").inputValue()) === "Dirty title" &&
        (await page
          .locator("[data-admin-form-runtime]")
          .getAttribute("data-admin-form-dirty")) === "true",
    );

    await selectTopicType(page, "news");
    await page.locator("[data-admin-confirm-dialog]").waitFor({
      state: "visible",
    });
    await page.locator("[data-admin-confirm-submit]").evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
    });
    await page.waitForFunction(() => {
      return (
        (window as unknown as HarnessWindow).__ADMIN_FORM_GUARDED_NAV_QA__
          .routerEvents.length === 1
      );
    });
    await page.waitForTimeout(100);
    const confirmedEvents = await getRouterEvents(page);
    check(
      "dirty confirm performs the correct navigation exactly once",
      confirmedEvents.length === 1 &&
        confirmedEvents[0]?.kind === "push" &&
        confirmedEvents[0]?.href === TOPIC_NEWS_PATH &&
        (await page.locator("[data-admin-confirm-dialog]").count()) === 0,
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success", deferAction: true },
      browserIssues,
    );
    await page
      .locator('[role="combobox"][aria-label="نوع المحتوى"]')
      .click();
    const portaledOption = page.locator(
      "#topic-content-type-popover-option-news",
    );
    await portaledOption.waitFor({ state: "visible" });
    await page.locator("#qa-admin-form").evaluate((element) => {
      (element as HTMLFormElement).requestSubmit();
    });
    await waitForRuntime(page, { pending: "true" });
    await portaledOption.click();
    await page.evaluate((href) => {
      const qa = (window as unknown as HarnessWindow)
        .__ADMIN_FORM_GUARDED_NAV_QA__;
      qa.runtime?.requestInternalNavigation(href);
    }, TOPIC_PRESS_PATH);
    const pendingEvents = await getRouterEvents(page);
    const pendingDialogs = await page
      .locator("[data-admin-confirm-dialog]")
      .count();
    const actionCalls = await getActionCalls(page);
    check(
      "pending blocks portaled-listbox and repeated programmatic navigation races",
      actionCalls === 1 && pendingEvents.length === 0 && pendingDialogs === 0,
    );
    await page.evaluate(() => {
      (window as unknown as HarnessWindow)
        .__ADMIN_FORM_GUARDED_NAV_QA__.releaseAction?.();
    });
    await waitForRuntime(page, { pending: "false", status: "success" });
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "error" },
      browserIssues,
    );
    await page.locator("#qa-title").fill("Failed save title");
    await waitForRuntime(page, { dirty: "true" });
    await page.locator("#qa-submit").click();
    await waitForRuntime(page, {
      dirty: "true",
      pending: "false",
      status: "error",
    });
    const restoredTitle = await page.locator("#qa-title").inputValue();
    await selectTopicType(page, "news");
    await page.locator("[data-admin-confirm-dialog]").waitFor({
      state: "visible",
    });
    check(
      "failed save restores the submitted value and remains dirty and guarded",
      restoredTitle === "Failed save title" &&
        (await getActionCalls(page)) === 1 &&
        (await getRouterEvents(page)).length === 0,
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    await page.locator("#qa-title").fill("Successful save title");
    await waitForRuntime(page, { dirty: "true" });
    await page.locator("#qa-submit").click();
    await waitForRuntime(page, {
      dirty: "false",
      pending: "false",
      status: "success",
    });
    await selectTopicType(page, "news");
    await page.waitForFunction(() => {
      return (
        (window as unknown as HarnessWindow).__ADMIN_FORM_GUARDED_NAV_QA__
          .routerEvents.length === 1
      );
    });
    const events = await getRouterEvents(page);
    check(
      "successful save marks the form clean before one warning-free navigation",
      (await getActionCalls(page)) === 1 &&
        events.length === 1 &&
        events[0]?.kind === "push" &&
        events[0]?.href === TOPIC_NEWS_PATH &&
        (await page.locator("[data-admin-confirm-dialog]").count()) === 0,
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "create-edit" },
      browserIssues,
    );
    await page.locator("#qa-title").fill("Created topic title");
    await page.locator("#qa-submit").click();
    await page.waitForFunction(() => {
      return (
        (window as unknown as HarnessWindow).__ADMIN_FORM_GUARDED_NAV_QA__
          .routerEvents.length === 1
      );
    });
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
    });
    const events = await getRouterEvents(page);
    check(
      "create-to-edit handoff replaces once with the safe edit path",
      (await getActionCalls(page)) === 1 &&
        events.length === 1 &&
        events[0]?.kind === "replace" &&
        events[0]?.href === CREATED_TOPIC_EDIT_PATH &&
        JSON.stringify(events[0]?.options) === JSON.stringify({ scroll: false }),
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "edit", actionOutcome: "success" },
      browserIssues,
    );
    const typeControl = page.locator(
      '[role="combobox"][aria-label="نوع المحتوى"]',
    );
    check(
      "Topic content type remains disabled in edit mode",
      await typeControl.isDisabled(),
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    await page.locator("#qa-title").fill("Unsafe path remains dirty");
    await waitForRuntime(page, { dirty: "true" });
    await page.evaluate((unsafeHrefs) => {
      const runtime = (window as unknown as HarnessWindow)
        .__ADMIN_FORM_GUARDED_NAV_QA__.runtime;
      for (const href of unsafeHrefs) {
        runtime?.requestInternalNavigation(href);
      }
    }, ["https://evil.example/admin", "//evil.example/admin", "javascript:alert(1)"]);
    await page.waitForTimeout(50);
    check(
      "runtime rejects unsafe internal navigation before dialog or navigation state changes",
      (await getRouterEvents(page)).length === 0 &&
        (await page.locator("[data-admin-confirm-dialog]").count()) === 0 &&
        (await page
          .locator("[data-admin-form-runtime]")
          .getAttribute("data-admin-form-dirty")) === "true",
    );
    await closePage(page);
  }

  {
    const { page } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    const unexpectedDialogs: string[] = [];
    const handleUnexpectedDialog = async (dialog: {
      type: () => string;
      dismiss: () => Promise<void>;
    }) => {
      unexpectedDialogs.push(dialog.type());
      await dialog.dismiss();
    };
    page.on("dialog", handleUnexpectedDialog);
    await page.goto(destinationUrl, { waitUntil: "load" });
    page.off("dialog", handleUnexpectedDialog);
    check(
      "clean real browser navigation does not trigger beforeunload",
      unexpectedDialogs.length === 0 &&
        (await page.locator("#qa-destination").textContent()) === "Destination",
    );
    await closePage(page);
  }

  {
    const { page, allowedFailedRequestUrls } = await openHarness(
      browser,
      harnessUrl,
      { mode: "create", actionOutcome: "success" },
      browserIssues,
    );
    await page.locator("#qa-title").click();
    await page.keyboard.type(" with unsaved edits");
    await waitForRuntime(page, { dirty: "true" });
    const titleBeforeNavigation = await page.locator("#qa-title").inputValue();
    allowedFailedRequestUrls.add(destinationUrl);

    const dialogPromise = page.waitForEvent("dialog", { timeout: 5_000 });
    const navigationPromise = page
      .goto(destinationUrl, { waitUntil: "commit", timeout: 5_000 })
      .then(() => "completed")
      .catch((error: Error) => error.message);
    const dialog = await dialogPromise;
    const dialogType = dialog.type();
    await dialog.dismiss();
    await navigationPromise;

    check(
      "dirty real browser navigation raises Chromium beforeunload and cancel preserves state",
      dialogType === "beforeunload" &&
        page.url() === harnessUrl &&
        (await page.locator("#qa-title").inputValue()) === titleBeforeNavigation &&
        (await page
          .locator("[data-admin-form-runtime]")
          .getAttribute("data-admin-form-dirty")) === "true",
    );
    await closePage(page);
  }

  {
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      { actionOutcomes: ["thumbnail-error"] },
      browserIssues,
    );
    await page.locator("#content-title").fill("Focus thumbnail correction");
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "true",
      pending: "false",
      status: "error",
    });
    await page.waitForFunction(
      () => document.activeElement?.id === "video_thumbnail_control",
    );
    const thumbnailControl = page.locator("#video_thumbnail_control");
    const thumbnailField = page.locator(
      '[data-admin-media-image-field="video_thumbnail"]',
    );
    check(
      "thumbnail errors focus the actionable shared Media picker control with valid ARIA",
      (await thumbnailControl.evaluate((element) => element.tagName)) ===
        "BUTTON" &&
        (await thumbnailControl.getAttribute("role")) === null &&
        (await thumbnailControl.getAttribute("aria-haspopup")) === "dialog" &&
        (await thumbnailControl.getAttribute("aria-describedby")) ===
          "video_thumbnail-error" &&
        (await thumbnailField.getAttribute("role")) === "group" &&
        (await thumbnailField.getAttribute("aria-invalid")) === "true" &&
        (await thumbnailField.getAttribute("aria-describedby")) ===
          "video_thumbnail-error",
    );
    await closePage(page);
  }

  {
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      { actionOutcomes: ["success"] },
      browserIssues,
    );
    check(
      "actual content runtime, picker, Markdown/RichText, SEO, video, and gallery components mount together",
      (await page.locator("#qa-content-form[data-admin-form-runtime]").count()) === 1 &&
        (await page.locator("[data-content-template-apply]").count()) === 1 &&
        (await page.locator("[data-topic-content-editor]").count()) === 1 &&
        (await page.locator("[data-admin-rich-text-scope]").count()) === 1 &&
        (await page.locator("[data-admin-entity-seo-panel]").count()) === 1 &&
        (await page.locator("#video_url").count()) === 1 &&
        (await page.locator("#gallery-editor").count()) === 1,
    );

    const initialModel = await getContentModelValue(page);
    const picker = page.locator(
      '[role="combobox"][aria-labelledby="content-template-picker-label"]',
    );
    await picker.click();
    const mediaNewsOption = page.getByRole("option", {
      name: "Media News",
      exact: true,
    });
    await mediaNewsOption.waitFor({ state: "visible" });
    const incompatibleVisible = await page
      .getByRole("option", { name: "تحديث تنفيذ", exact: true })
      .count();
    const directRejected = await requestContentPreset(
      page,
      "construction-update",
    );
    const modelAfterReject = await getContentModelValue(page);
    check(
      "preset applicability exposes only matching news presets and rejects incompatible direct requests",
      (await page.getByRole("option", { name: "Sold Out", exact: true }).count()) === 1 &&
        incompatibleVisible === 0 &&
        directRejected === false &&
        JSON.stringify(modelAfterReject) === JSON.stringify(initialModel) &&
        (await page
          .locator("#qa-content-form")
          .getAttribute("data-admin-form-dirty")) === "false",
    );

    await mediaNewsOption.click();
    await page.locator("[data-content-template-apply]").click();
    await waitForContentModelValue(page, {
      title: "خبر: [العنوان]",
      excerpt: "ملخص الخبر في جملتين واضحتين.",
    });
    await waitForRuntime(page, { dirty: "true" });
    await page.waitForFunction(() => {
      return document
        .querySelector("#content-editor")
        ?.textContent?.includes("ماذا يعني هذا");
    });
    const firstPresetModel = await getContentModelValue(page);
    const firstPresetForm = await getLiveFormValues(page);
    check(
      "applying a preset updates the visible title, excerpt, and rich editor plus the same FormData projection",
      firstPresetModel !== null &&
        firstPresetForm !== null &&
        (await page.locator("#content-title").inputValue()) === firstPresetModel.title &&
        (await page.locator("#content-excerpt").inputValue()) === firstPresetModel.excerpt &&
        (await page.locator('input[type="hidden"][name="content"]').inputValue()) ===
          firstPresetModel.content &&
        (await page.locator("#content-editor").textContent())?.includes("الخبر") === true &&
        firstPresetForm.title === firstPresetModel.title &&
        firstPresetForm.excerpt === firstPresetModel.excerpt &&
        firstPresetForm.content === firstPresetModel.content,
    );

    await page.getByRole("tab", { name: "SEO", exact: true }).click();
    const allOwnedForm = await getLiveFormValues(page);
    check(
      "all six model-owned fields remain one canonical visible/FormData projection and preset application marks dirty",
      firstPresetModel !== null &&
        allOwnedForm !== null &&
        (await page.locator("#content-seo-title").isVisible()) &&
        (await page.locator("#content-seo-title").inputValue()) === firstPresetModel.seoTitle &&
        (await page.locator("#content-seo-description").inputValue()) ===
          firstPresetModel.seoDescription &&
        (await page.locator("#content-focus-keyword").inputValue()) ===
          firstPresetModel.focusKeyword &&
        allOwnedForm.seo_title === firstPresetModel.seoTitle &&
        allOwnedForm.seo_description === firstPresetModel.seoDescription &&
        allOwnedForm.focus_keyword === firstPresetModel.focusKeyword &&
        (await page
          .locator("#qa-content-form")
          .getAttribute("data-admin-form-dirty")) === "true",
    );

    await page.getByRole("tab", { name: "Basic", exact: true }).click();
    await page.locator("#content-title").fill("User-owned title after preset");
    await page.locator("#content-editor").fill("User-owned rich content");
    await waitForContentModelValue(page, {
      title: "User-owned title after preset",
      content: "# User-owned rich content",
    });
    const editedModel = await getContentModelValue(page);
    const editedForm = await getLiveFormValues(page);
    check(
      "user edits after a preset update the canonical model, visible rich editor, and FormData",
      editedModel?.title === "User-owned title after preset" &&
        editedModel.content === "# User-owned rich content" &&
        (await page.locator("#content-title").inputValue()) === editedModel.title &&
        (await page.locator("#content-editor").textContent()) ===
          "User-owned rich content" &&
        editedForm?.title === editedModel.title &&
        editedForm.content === editedModel.content,
    );

    await selectContentPreset(page, "Sold Out");
    await waitForContentModelValue(page, {
      title: "اكتمال [المرحلة/الوحدات] في [اسم المشروع]",
      excerpt: "إعلان رسمي عن اكتمال مرحلة محددة مع شكر للعملاء.",
    });
    await page.waitForFunction(() => {
      return document
        .querySelector("#content-editor")
        ?.textContent?.includes("ما الذي يلي");
    });
    const secondPresetModel = await getContentModelValue(page);
    const secondPresetForm = await getLiveFormValues(page);
    check(
      "a second preset replaces the first preset and later user edits without stale projection",
      secondPresetModel?.title ===
        "اكتمال [المرحلة/الوحدات] في [اسم المشروع]" &&
        secondPresetModel.content.includes("ما الذي يلي") &&
        !secondPresetModel.content.includes("ماذا يعني هذا") &&
        secondPresetForm?.title === secondPresetModel.title &&
        secondPresetForm.content === secondPresetModel.content &&
        (await page.locator("#content-title").inputValue()) ===
          secondPresetModel.title,
    );

    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "false",
      pending: "false",
      status: "success",
    });
    const successfulSubmission = await getLastSubmission(page);
    check(
      "a clean successful content save submits once with the final canonical preset projection",
      (await getActionCalls(page)) === 1 &&
        successfulSubmission.title === secondPresetModel?.title &&
        successfulSubmission.excerpt === secondPresetModel?.excerpt &&
        successfulSubmission.content === secondPresetModel?.content,
    );
    await closePage(page);
  }

  {
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      { actionOutcomes: ["success"], deferAction: true },
      browserIssues,
    );
    await selectContentPreset(page, "Media News");
    await waitForContentModelValue(page, { title: "خبر: [العنوان]" });
    await page
      .locator(
        '[role="combobox"][aria-labelledby="content-template-picker-label"]',
      )
      .click();
    await page.getByRole("option", { name: "Sold Out", exact: true }).click();
    const modelBeforePending = await getContentModelValue(page);
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, { pending: "true" });
    const applyButton = page.locator("[data-content-template-apply]");
    const pendingApplyDisabled = await applyButton.isDisabled();
    await applyButton.evaluate((element) => (element as HTMLButtonElement).click());
    await page.waitForTimeout(50);
    const modelDuringPending = await getContentModelValue(page);
    const pendingSubmission = await getLastSubmission(page);
    check(
      "pending disables preset application and prevents a second projection/submission race",
      pendingApplyDisabled &&
        JSON.stringify(modelDuringPending) === JSON.stringify(modelBeforePending) &&
        pendingSubmission.title === modelBeforePending?.title &&
        (await getActionCalls(page)) === 1,
    );
    await page.evaluate(() => {
      (window as unknown as HarnessWindow)
        .__ADMIN_FORM_GUARDED_NAV_QA__.releaseAction?.();
    });
    await waitForRuntime(page, { pending: "false", status: "success" });
    await closePage(page);
  }

  {
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      { actionOutcomes: ["video-error", "success"] },
      browserIssues,
    );
    await page.locator("#content-title").fill("Preserved after video error");
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "true",
      pending: "false",
      status: "error",
    });
    await page.waitForFunction(() => document.activeElement?.id === "video_url");
    const videoErrorSubmission = await getLastSubmission(page);
    check(
      "video field errors render inline with ARIA, focus the first visible field, and preserve canonical values",
      (await page.locator("#video_url-error").textContent()) ===
          "Video URL is invalid." &&
        (await page.locator("#video_duration-error").textContent()) ===
          "Video duration is invalid." &&
        (await page.locator("#video_thumbnail-error").textContent()) ===
          "Video thumbnail is required." &&
        (await page.locator("#video_url").getAttribute("aria-invalid")) === "true" &&
        (await page.locator("#video_url").getAttribute("aria-describedby")) ===
          "video_url-error" &&
        (await page.locator("#video_duration").getAttribute("aria-invalid")) ===
          "true" &&
        (await page.locator("#video_duration").getAttribute("aria-describedby")) ===
          "video_duration-error" &&
        (await page.locator('[data-admin-media-image-field="video_thumbnail"]').getAttribute("aria-invalid")) ===
          "true" &&
        (await page.locator("#video_thumbnail_control").getAttribute("aria-describedby")) ===
          "video_thumbnail-error" &&
        (await page.locator("#video_url").inputValue()) ===
          "https://www.youtube.com/watch?v=qa" &&
        (await page.locator("#video_duration").inputValue()) === "1:30" &&
        videoErrorSubmission.title === "Preserved after video error" &&
        (await page.locator("#content-title").inputValue()) ===
          "Preserved after video error",
    );
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "false",
      pending: "false",
      status: "success",
    });
    check(
      "retry succeeds once and clears prior video errors and ARIA state",
      (await getActionCalls(page)) === 2 &&
        (await page.locator("#video_url-error").count()) === 0 &&
        (await page.locator("#video_duration-error").count()) === 0 &&
        (await page.locator("#video_thumbnail-error").count()) === 0 &&
        (await page.locator("#video_url").getAttribute("aria-invalid")) === null &&
        (await page.locator('[data-admin-media-image-field="video_thumbnail"]').getAttribute("aria-invalid")) ===
          null,
    );
    await closePage(page);
  }

  {
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      { actionOutcomes: ["gallery-error", "success"] },
      browserIssues,
    );
    await page
      .locator("#gallery_image_url")
      .fill("/images/qa-gallery-error.jpg");
    await waitForRuntime(page, { dirty: "true" });
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "true",
      pending: "false",
      status: "error",
    });
    await page.waitForFunction(
      () => document.activeElement?.id === "gallery_image_url",
    );
    const galleryErrorSubmission = await getLastSubmission(page);
    const galleryErrorEvidence = {
      urlError:
        (await page.locator("#gallery_image_url-error").textContent()) ===
        "Gallery image URL is required.",
      altError:
        (await page.locator("#gallery_image_alt-error").textContent()) ===
        "Gallery image alt text is required.",
      urlInvalid:
        (await page.locator("#gallery_image_url").getAttribute("aria-invalid")) ===
        "true",
      urlDescribedBy:
        (await page
          .locator("#gallery_image_url")
          .getAttribute("aria-describedby")) === "gallery_image_url-error",
      altInvalid:
        (await page.locator("#gallery_image_alt").getAttribute("aria-invalid")) ===
        "true",
      altDescribedBy:
        (await page
          .locator("#gallery_image_alt")
          .getAttribute("aria-describedby")) === "gallery_image_alt-error",
      liveUrl:
        (await page.locator("#gallery_image_url").inputValue()) ===
        "/images/qa-gallery-error.jpg",
      liveAlt:
        (await page.locator("#gallery_image_alt").inputValue()) ===
        "QA gallery alt",
      submittedUrl:
        galleryErrorSubmission.gallery_image_url ===
        "/images/qa-gallery-error.jpg",
      submittedAlt:
        galleryErrorSubmission.gallery_image_alt === "QA gallery alt",
    };
    if (!Object.values(galleryErrorEvidence).every(Boolean)) {
      console.error(
        "Gallery error evidence:",
        JSON.stringify({ galleryErrorEvidence, galleryErrorSubmission }, null, 2),
      );
    }
    check(
      "gallery field errors render inline with ARIA, preserve values, and focus the first visible gallery field",
      Object.values(galleryErrorEvidence).every(Boolean),
    );
    await page.locator('[data-admin-form-action="save"]').click();
    await waitForRuntime(page, {
      dirty: "false",
      pending: "false",
      status: "success",
    });
    check(
      "gallery retry clears old inline and ARIA errors without an extra submit",
      (await getActionCalls(page)) === 2 &&
        (await page.locator("#gallery_image_url-error").count()) === 0 &&
        (await page.locator("#gallery_image_alt-error").count()) === 0 &&
        (await page.locator("#gallery_image_url").getAttribute("aria-invalid")) ===
          null &&
        (await page.locator("#gallery_image_alt").getAttribute("aria-invalid")) ===
          null,
    );
    await closePage(page);
  }

  {
    const recoveredDraft =
      "# Recovered draft\n\nRecovered canonical content from local storage.";
    const { page } = await openContentHarness(
      browser,
      harnessUrl,
      {
        actionOutcomes: ["success"],
        seedDraft: { content: recoveredDraft, baselineRevision: null },
      },
      browserIssues,
    );
    await waitForContentModelValue(page, { content: recoveredDraft });
    await waitForRuntime(page, { dirty: "true" });
    await page.waitForFunction(() => {
      return document
        .querySelector("#content-editor")
        ?.textContent?.includes("Recovered canonical content");
    });
    const draftModel = await getContentModelValue(page);
    const draftForm = await getLiveFormValues(page);
    check(
      "matching draft recovery flows through the canonical model into the visible rich editor and FormData",
      draftModel?.content === recoveredDraft &&
        draftForm?.content === recoveredDraft &&
        (await page.locator('input[type="hidden"][name="content"]').inputValue()) ===
          recoveredDraft &&
        (await page.locator("#content-editor").textContent())?.includes(
          "Recovered canonical content",
        ) === true &&
        (await page.getByText("تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال.").count()) ===
          1 &&
        (await getActionCalls(page)) === 0,
    );
    await closePage(page);
  }

  check(
    "actual-component bundle emits no Webpack warnings",
    webpackWarnings.length === 0,
  );
  check(
    `all Chromium scenarios complete without unexpected console, page, or request errors${
      browserIssues.length ? `: ${JSON.stringify(browserIssues)}` : ""
    }`,
    browserIssues.length === 0,
  );
} finally {
  if (browser) await browser.close();
  if (server) await stopServer(server);
  await rm(validateTempPath(tempDir), { recursive: true, force: true });
}

console.log(
  `qa:admin-form-guarded-navigation passed (${passed} assertions)`,
);
