import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import type { AdminActionResult } from "../src/lib/admin/admin-action-result.ts";

const require = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, "..");
type Snapshot = { domain: unknown; receipts: number; rpcCalls: number };
export type ActualNextCache = Pick<typeof import("next/cache"), "revalidatePath" | "revalidateTag" | "updateTag">;

/** Compose with actual actions/native receipt transport; this exercises installed Next settlement, not Vercel or HTTP forwarding. */
export async function verifyDeferredNextCommandRecovery(input: {
  mutate(): Promise<AdminActionResult>;
  recover(): Promise<AdminActionResult>;
  snapshot(): Promise<Snapshot>;
  useNextCache(port: ActualNextCache | null): void;
}) {
  const runtime = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage };
  runtime.AsyncLocalStorage ??= AsyncLocalStorage;
  const { IncrementalCache } = require("next/dist/server/lib/incremental-cache") as {
    IncrementalCache: new (options: unknown) => { revalidateTag(...args: unknown[]): Promise<void> };
  };
  const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external") as { workAsyncStorage: { run<T>(store: Record<string, unknown>, run: () => T): T } };
  const { executeRevalidates } = require("next/dist/server/revalidation-utils");
  const nextCache = require("next/cache") as ActualNextCache;
  const cache = new IncrementalCache({
    fs: { readFile: async () => { throw new Error("isolated cache has no disk"); } }, dev: false, flushToDisk: false,
    minimalMode: false, serverDistDir: resolve(ROOT, ".tmp-qa/unused-next-command-cache"), requestHeaders: {}, maxMemoryCacheSize: 5_000_000,
    fetchCacheKeyPrefix: `command-recovery-${Date.now()}`,
    getPrerenderManifest: () => ({ version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [], preview: { previewModeId: "isolated" } }),
  });
  let rejectBackend = true, backendCalls = 0;
  const realBackend = cache.revalidateTag.bind(cache);
  cache.revalidateTag = async (...args) => {
    backendCalls += 1;
    if (rejectBackend) throw new Error("injected deferred command cache backend failure");
    return realBackend(...args);
  };
  const sourcePath = resolve(ROOT, "node_modules/next/dist/server/app-render/action-handler.js");
  const ast = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true);
  const helper = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "executeActionAndPrepareForRender");
  assert.ok(helper, "The installed Next action settlement helper must be identified exactly.");
  const settle = new Function("_workunitasyncstorageexternal", "_actionrevalidationkind", "_requeststore", "_revalidationutils", "SERVER_ACTION_ARGS_LIMIT", `${helper.getText(ast)}; return executeActionAndPrepareForRender;`)(
    require("next/dist/server/app-render/work-unit-async-storage.external"), require("next/dist/shared/lib/action-revalidation-kind"),
    require("next/dist/server/async-storage/request-store"), { executeRevalidates }, 1000,
  ) as (action: () => Promise<AdminActionResult>, args: unknown[], store: Record<string, unknown>, request: Record<string, unknown>, forwarded: boolean) => Promise<{ actionResult: AdminActionResult }>;
  const { ResponseCookies } = require("next/dist/compiled/@edge-runtime/cookies") as { ResponseCookies: new (headers: Headers) => unknown };
  const request = (action: () => Promise<AdminActionResult>) => {
    const store = { page: "/admin/content/topics/page", route: "/admin/content/topics", incrementalCache: cache, isStaticGeneration: false, isDraftMode: false, cacheLifeProfiles: { max: { expire: 31536000 } } };
    const requestStore = { type: "request", phase: "action", draftMode: { isEnabled: false }, mutableCookies: new ResponseCookies(new Headers()), url: { pathname: "/admin/content/topics", search: "" } };
    return workAsyncStorage.run(store, () => settle(action, [], store, requestStore, false));
  };
  input.useNextCache(nextCache);
  try {
    const before = await input.snapshot();
    await assert.rejects(request(input.mutate), /injected deferred command cache backend failure/u);
    const committed = await input.snapshot();
    assert.equal(committed.rpcCalls, before.rpcCalls + 1);
    assert.equal(committed.receipts, 1);
    const failedBackendCalls = backendCalls;
    assert.ok(failedBackendCalls > 0);
    rejectBackend = false;
    const recovered = await request(input.recover);
    assert.equal(recovered.actionResult.completion, "committed");
    assert.equal(recovered.actionResult.ok, true);
    assert.deepEqual(await input.snapshot(), committed, "Receipt recovery must not issue a domain RPC or change the committed state/audit receipt");
    assert.ok(backendCalls > failedBackendCalls, "A new real Next request must retry backend invalidation");
    return { status: "passed", actualInstalledNextSettlement: true, deferredFailureAfterCommit: true, receiptReadRecovery: true, domainRpcCalls: 1, receiptCount: 1, recoveryRetriedBackend: true, localBackendSettledOnRecovery: true, limits: ["Real Next default local cache only", "Not Vercel adapter or authenticated HTTP forwarding evidence"] };
  } finally { input.useNextCache(null); }
}
