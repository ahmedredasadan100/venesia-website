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

type RouterEvent = {
  kind: "push" | "replace";
  href: string;
  options: unknown;
};

type HarnessState = {
  routerEvents: RouterEvent[];
  actionCalls: number;
  releaseAction: (() => void) | null;
  runtime: {
    requestInternalNavigation: (href: string) => void;
  } | null;
  mount: (options: HarnessOptions) => void;
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

const qa = {
  routerEvents: [],
  actionCalls: 0,
  submissions: [],
  releaseAction: null,
  runtime: null,
  router: null,
  mount: null,
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

const root = createRoot(document.getElementById("root"));
qa.mount = (options) => {
  qa.routerEvents.length = 0;
  qa.actionCalls = 0;
  qa.submissions.length = 0;
  qa.releaseAction = null;
  qa.runtime = null;
  root.render(React.createElement(Harness, options));
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

async function compileHarness(rootDir: string, tempDir: string) {
  const navigationMockPath = path.join(tempDir, "next-navigation.mock.js");
  const linkMockPath = path.join(tempDir, "next-link.mock.js");
  await Promise.all([
    writeFile(navigationMockPath, navigationMockSource, "utf8"),
    writeFile(linkMockPath, linkMockSource, "utf8"),
  ]);

  const { loadBindings } = require("next/dist/build/swc") as {
    loadBindings: () => Promise<unknown>;
  };
  await loadBindings();

  const webpack = (
    require("next/dist/compiled/webpack/webpack") as {
      webpack: (config: unknown) => WebpackCompiler;
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
        "next/navigation": navigationMockPath,
        "next/link": linkMockPath,
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
