import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "playwright/test";

const CREATE_PATH = "/admin/content/categories/new";
class CreateReplyLossVerificationError extends Error {
  constructor(code) { super(code); this.name = "CreateReplyLossVerificationError"; this.code = code; }
}
const requireProof = (condition, code) => { if (!condition) throw new CreateReplyLossVerificationError(code); };

/** Original credentials/body remain private and are sent only to this exact owned authority. */
export async function validateOwnedCreateSpecimen(request, origin) {
  let body;
  try {
    const base = new URL(origin), target = new URL(request.url());
    requireProof(base.origin === origin && base.protocol === "http:" && base.hostname === "127.0.0.1"
      && Boolean(base.port) && !base.username && !base.password, "create-loss-non-owned-origin");
    requireProof(target.href === origin + CREATE_PATH && request.method() === "POST", "create-loss-wrong-request-target");
    const headers = await request.allHeaders();
    requireProof(headers.origin === origin, "create-loss-origin-mismatch");
    requireProof(/^[a-f0-9]{40,64}$/iu.test(headers["next-action"] ?? ""), "create-loss-invalid-action");
    requireProof(/^(?:text\/plain(?:;|$)|multipart\/form-data;\s*boundary=|application\/x-www-form-urlencoded(?:;|$))/iu.test(headers["content-type"] ?? ""), "create-loss-invalid-content-type");
    requireProof(!headers.host || headers.host === base.host, "create-loss-host-mismatch");
    requireProof(Object.keys(headers).every(key => /^[a-z0-9!#$%&'*+.^_\x60|~-]+$/iu.test(key)), "create-loss-invalid-header-name");
    const original = request.postDataBuffer();
    requireProof(Buffer.isBuffer(original) && original.length > 0 && original.length <= 16 * 1024 * 1024, "create-loss-invalid-body");
    body = Buffer.from(original);
    requireProof(!headers["content-length"] || Number(headers["content-length"]) === body.length, "create-loss-body-length-mismatch");
    requireProof(!headers["transfer-encoding"] && !headers.upgrade && !headers.expect
      && !headers["proxy-authorization"] && !headers["proxy-connection"], "create-loss-unsupported-hop-header");
    // HTTP transport headers are regenerated; all original end-to-end headers,
    // including the authenticated Cookie and Next Action identity, stay in memory.
    const forwarded = { ...headers, host: base.host, "content-length": String(body.length), connection: "close" };
    for (const key of ["keep-alive", "te", "trailer"]) delete forwarded[key];
    return { hostname: "127.0.0.1", port: Number(base.port), path: CREATE_PATH, headers: forwarded, body };
  } catch (error) {
    body?.fill(0);
    if (error instanceof CreateReplyLossVerificationError) throw error;
    throw new CreateReplyLossVerificationError("create-loss-request-validation-failed");
  }
}

/**
 * One actual request is forwarded once; only real response headers are observed.
 * The unconsumed response is destroyed after native persistence proof, and the
 * original Browser request is aborted. No Product response is fabricated.
 */
export async function captureCommittedCreateReplyLoss({ page, origin, nativeProbe, trigger,
  observe = async (_name, task) => task(), timeoutMs = 60_000 }) {
  requireProof(typeof nativeProbe === "function" && typeof trigger === "function", "create-loss-missing-proof-port");
  requireProof(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000, "create-loss-invalid-deadline");
  const base = new URL(origin);
  requireProof(base.origin === origin && base.protocol === "http:" && base.hostname === "127.0.0.1"
    && Boolean(base.port), "create-loss-non-owned-origin");
  requireProof(page.url() === origin + CREATE_PATH, "create-loss-page-not-at-create-route");
  const abort = new AbortController();
  let stoppedReject, capturedResolve, capturedReject, failure = null;
  const stopped = new Promise((_, reject) => { stoppedReject = reject; }); stopped.catch(() => {});
  const captured = new Promise((resolve, reject) => { capturedResolve = resolve; capturedReject = reject; }); captured.catch(() => {});
  const statistics = { matchedRequests: 0, forwardedRequests: 0, responseStatus: null, headersObserved: false,
    nativeCommitConfirmed: false, browserResponseAborted: false, originalSocketClosed: false, requestBodyWiped: false };
  const tasks = new Set();
  let routeRegistered = false, activeRoute, abortingRoute, outgoing, incoming, socketClosed = Promise.resolve(), body, privateHeaders;
  function stop(code) {
    if (failure === null) failure = new CreateReplyLossVerificationError(code);
    abort.abort(); stoppedReject(failure); capturedReject(failure);
    incoming?.destroy(); outgoing?.destroy();
  }
  const bounded = promise => Promise.race([promise, stopped]);
  function abortRoute() {
    if (!activeRoute) return Promise.resolve();
    if (!abortingRoute) abortingRoute = activeRoute.abort("failed").then(() => { statistics.browserResponseAborted = true; });
    return abortingRoute;
  }
  const routeHandler = route => {
    const work = (async () => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) { await route.fallback(); return; }
      statistics.matchedRequests++;
      if (statistics.matchedRequests !== 1) {
        stop("create-loss-duplicate-original-request");
        try { await route.abort("failed"); } catch { /* Failure remains recorded; never forward a second request. */ }
        return;
      }
      activeRoute = route;
      try {
        const specimen = await bounded(validateOwnedCreateSpecimen(request, origin).then(value => {
          if (abort.signal.aborted) { value.body.fill(0); throw new CreateReplyLossVerificationError("create-loss-cancelled-request"); }
          return value;
        }));
        body = specimen.body; privateHeaders = specimen.headers;
        const response = await observe("create-loss-real-response-headers", () => bounded(new Promise((resolve, reject) => {
          statistics.forwardedRequests++;
          outgoing = httpRequest({ hostname: specimen.hostname, port: specimen.port, path: specimen.path,
            method: "POST", headers: privateHeaders, agent: false }, message => {
            incoming = message; incoming.pause();
            incoming.on("error", () => { if (!statistics.nativeCommitConfirmed) stop("create-loss-response-stream-failed"); });
            statistics.responseStatus = incoming.statusCode ?? null; statistics.headersObserved = true;
            resolve(incoming);
          });
          socketClosed = new Promise(resolve => {
            let assignedSocket = false;
            outgoing.once("socket", socket => {
              assignedSocket = true;
              socket.once("close", () => { statistics.originalSocketClosed = true; resolve(); });
            });
            outgoing.once("close", () => { if (!assignedSocket) resolve(); });
          });
          outgoing.on("error", () => reject(new CreateReplyLossVerificationError("create-loss-owned-forward-failed")));
          outgoing.end(body);
        })));
        requireProof(response.statusCode === 200 && !response.headers.location && !response.headers["x-action-redirect"], "create-loss-redirect-or-non-success-headers");
        requireProof(/^text\/x-component(?:;|$)/iu.test(String(response.headers["content-type"] ?? "")), "create-loss-not-current-flight");
        const native = await observe("create-loss-native-before-delivery-loss", () => bounded(nativeProbe(abort.signal)));
        requireProof(native?.status === "pass" && Array.isArray(native.rows) && native.rows.length === 1
          && Array.isArray(native.audit) && native.audit.length === 1, "create-loss-native-commit-not-proven");
        const rowId = Number(native.rows[0].id), audit = native.audit[0];
        requireProof(Number.isSafeInteger(rowId) && rowId > 0 && Number(audit.entity_id) === rowId
          && Number.isSafeInteger(Number(audit.actor_admin_user_id)) && Number(audit.actor_admin_user_id) > 0
          && audit.action === "topic_category.create", "create-loss-native-actor-audit-not-proven");
        requireProof(!abort.signal.aborted, "create-loss-cancelled-before-loss");
        statistics.nativeCommitConfirmed = true;
        incoming.destroy(); outgoing.destroy();
        await bounded(socketClosed);
        await abortRoute();
        capturedResolve(native);
      } catch (error) {
        stop(error instanceof CreateReplyLossVerificationError ? error.code : "create-loss-proof-not-established");
        try { await abortRoute(); } catch { stop("create-loss-browser-abort-failed"); }
      } finally {
        body?.fill(0); body = undefined; privateHeaders = undefined; statistics.requestBodyWiped = true;
      }
    })();
    tasks.add(work); void work.finally(() => tasks.delete(work)).catch(() => {});
    return work;
  };
  const deadline = setTimeout(() => stop("create-loss-bounded-wait-exceeded"), timeoutMs);
  try {
    // A newly registered Page route owns this one URL ahead of the existing
    // BrowserContext-wide network guard. Non-Action requests use fallback().
    await page.route(origin + CREATE_PATH, routeHandler); routeRegistered = true;
    const [native] = await Promise.all([bounded(captured), bounded(Promise.resolve().then(trigger))]);
    requireProof(statistics.matchedRequests === 1 && statistics.forwardedRequests === 1
      && statistics.nativeCommitConfirmed && statistics.browserResponseAborted && statistics.originalSocketClosed,
    "create-loss-incomplete-protocol-proof");
    return { native, statistics };
  } catch (error) {
    stop(error instanceof CreateReplyLossVerificationError ? error.code : "create-loss-trigger-failed");
    throw failure;
  } finally {
    clearTimeout(deadline);
    if (!abort.signal.aborted) { abort.abort(); stoppedReject(new CreateReplyLossVerificationError("create-loss-cleanup")); }
    incoming?.destroy(); outgoing?.destroy();
    try { await abortRoute(); } catch { /* An already failed turn cannot become passing during cleanup. */ }
    await Promise.allSettled([...tasks]);
    await socketClosed;
    if (routeRegistered) await page.unroute(origin + CREATE_PATH, routeHandler);
    body?.fill(0); body = undefined; privateHeaders = undefined; statistics.requestBodyWiped = true;
  }
}

/** Edit uses the physical ID and name; the current Category owner intentionally omits a mutable slug input. */
export async function verifyReopenedCreatedCategory({ page, origin, id, name, slug, nativeProbe, expectedNative }) {
  assert.ok(Number.isSafeInteger(id) && id > 0);
  assert.equal(expectedNative.rows.length, 1); assert.equal(Number(expectedNative.rows[0].id), id);
  assert.equal(expectedNative.rows[0].slug, slug);
  await expect(page).toHaveURL(origin + "/admin/content/categories/" + id);
  const form = page.locator('#category-taxonomy-form[data-admin-form-runtime][data-admin-form-mode="edit"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[type="hidden"][name="id"]')).toHaveValue(String(id));
  await expect(form.locator('[name="name"]')).toHaveValue(name);
  await expect(form.locator('[name="slug"]')).toHaveCount(0);
  const reopened = await nativeProbe();
  assert.deepEqual(reopened.rows, expectedNative.rows);
  assert.deepEqual(reopened.audit, expectedNative.audit);
  return reopened;
}

export async function runCoreCreateRecoveryJourney(ctx) {
  const { page, origin, output, run, observe, saveForm, saveButton, feedback, databaseReadback } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  await run("category-create-committed-reply-loss-identical-input-retry", [], async () => {
    const startedAt = new Date().toISOString();
    const slug = "qa-core-create-" + Date.now().toString(36);
    const name = "إغلاق إنشاء التصنيف " + slug;
    const nativeProbe = async (signal) => {
      const id = randomUUID();
      const temporary = join(output, `core-native-request-${id}.tmp`);
      writeFileSync(temporary, JSON.stringify({ id, kind: "category-create-durable", slug, startedAt }));
      renameSync(temporary, join(output, `core-native-request-${id}.json`));
      const responsePath = join(output, `core-native-response-${id}.json`);
      const deadline = Date.now() + 30_000;
      while (!existsSync(responsePath)) {
        requireProof(!signal?.aborted, "create-loss-native-checkpoint-cancelled");
        if (Date.now() >= deadline) throw new Error("The owning native readback did not confirm create persistence.");
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const response = JSON.parse(readFileSync(responsePath, "utf8"));
      assert.equal(response.id, id); assert.equal(response.status, "pass");
      assert.equal(response.slug, slug); assert.equal(response.rows.length, 1); assert.equal(response.audit.length, 1);
      assert.equal(response.rows[0].name, name);
      assert.ok(response.audit[0].actor_admin_user_id !== null);
      return response;
    };
    await observe("create-loss-open", () => page.goto(origin + "/admin/content/categories/new", { waitUntil: "domcontentloaded" }));
    await page.locator('[name="name"]').fill(name); await page.locator('[name="slug"]').fill(slug);
    const { native: before, statistics } = await captureCommittedCreateReplyLoss({
      page, origin, nativeProbe, trigger: () => saveButton().click(), observe,
    });
    await expect(feedback("danger").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[name="name"]')).toHaveValue(name);
    await expect(page.locator('[name="slug"]')).toHaveValue(slug);
    assert.ok(before);
    await saveForm({ rejectedField: "slug" });
    await expect(page.locator('[name="name"]')).toHaveValue(name);
    await expect(page.locator('[name="slug"]')).toHaveValue(slug);
    const after = await nativeProbe();
    assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.audit, before.audit);
    const id = Number(after.rows[0].id);
    await observe("create-loss-open-saved-record", () => page.goto(origin + "/admin/content/categories/" + id, { waitUntil: "domcontentloaded" }));
    const reopened = await verifyReopenedCreatedCategory({ page, origin, id, name, slug, nativeProbe, expectedNative: after });
    databaseReadback.push({ table: "topic_categories", id, expected: { name, slug } });
    return { firstCommitNativeConfirmedBeforeReplyLoss: true, sameAuthoredIdentityRetry: true, protocol: statistics,
      firstNativeProbe: before.id, secondNativeProbe: after.id, reopenedNativeProbe: reopened.id,
      reopenedUiIdentity: "exact edit route, physical hidden ID, authored name; immutable slug verified natively", durableRows: 1, durableAuditEvents: 1,
      explicitCommandIdentity: false, retryOutcome: "existing slug rejected; saved entity was independently reopened",
      classification: "BOUNDED CREATE UNIQUENESS VERIFIED; durable same-command result recovery is not supplied by this create contract" };
  });
}