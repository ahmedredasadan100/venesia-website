import { createHash, randomUUID } from "node:crypto";
import { request as playwrightRequest } from "playwright";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const exactKeys = (value, keys) => Object.keys(value).sort().join("|") === [...keys].sort().join("|");
class FormPermissionVerificationError extends Error {
  constructor(code) { super("Form permission verification: " + code); this.code = code; }
}
const fail = code => { throw new FormPermissionVerificationError(code); };
const requireThat = (value, code) => { if (!value) fail(code); };
const forbiddenAdmin = new Set(["/admin/login", "/admin/forgot-password"]);

function ownedFormUrl(value, origin) {
  let url;
  try { url = new URL(value); } catch { fail("invalid-request-url"); }
  requireThat(url.origin === origin && url.pathname.startsWith("/admin/") && !forbiddenAdmin.has(url.pathname)
    && !url.username && !url.password && !url.hash, "request-outside-owned-form");
  return url;
}

/** HTTP classification only; neither Action execution nor UI preservation is inferred. */
export function classifyFormPermissionHttpResponse({ status, headers, unauthorizedJson }, origin) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  if (status === 401 && unauthorizedJson?.error === "Unauthorized") {
    return { kind: "http-unauthorized", httpStatus: 401, enforcementLayer: "not-determined-by-http", actionBodyExecutionProven: false };
  }
  let target = null;
  if ([301, 302, 303, 307, 308].includes(status)) target = normalized.location;
  else if (status === 200 && typeof normalized["x-action-redirect"] === "string") target = normalized["x-action-redirect"].split(";")[0];
  if (typeof target !== "string") return null;
  try {
    const url = new URL(target, origin);
    if (url.origin !== origin || url.pathname !== "/admin/login" || url.username || url.password || url.hash) return null;
    return { kind: "owned-admin-login-denial", httpStatus: status, destination: "/admin/login",
      enforcementLayer: "admin-http-boundary-proxy-or-action-redirect", actionBodyExecutionProven: false };
  } catch { return null; }
}

async function specimenFromRequest(request, origin) {
  requireThat(request.method() === "POST", "not-post");
  const url = ownedFormUrl(request.url(), origin);
  const all = await request.allHeaders();
  const action = all["next-action"];
  requireThat(typeof action === "string" && /^[a-f0-9]{40,64}$/u.test(action), "missing-or-invalid-action-id");
  requireThat(all.origin === origin, "wrong-origin");
  requireThat(typeof all["content-type"] === "string" &&
    /^(?:text\/plain(?:;|$)|multipart\/form-data;\s*boundary=|application\/x-www-form-urlencoded(?:;|$))/iu.test(all["content-type"]), "unsupported-action-content-type");
  const data = request.postDataBuffer();
  requireThat(Buffer.isBuffer(data) && data.length > 0 && data.length <= MAX_BODY_BYTES, "missing-or-unbounded-action-body");
  const headers = {};
  for (const key of ["next-action", "origin", "content-type", "accept", "next-router-state-tree", "next-url", "x-deployment-id"]) {
    if (typeof all[key] === "string") headers[key] = all[key];
  }
  // Cookies/Authorization, request bytes and body digests must never leave memory.
  return { url: url.href, pathname: url.pathname, headers, body: Buffer.from(data), actionSha256: sha256(action) };
}

function validateFingerprint(value, correlationId, phase) {
  requireThat(value && value.status === "pass" && value.kind === "form-permission-fingerprint"
    && value.correlationId === correlationId && value.phase === phase, "missing-native-fingerprint");
  requireThat(typeof value.id === "string" && typeof value.ownedRunId === "string" && value.ownedRunId.length > 0, "unbound-native-fingerprint");
  requireThat(Number.isSafeInteger(value.publicTableCount) && value.publicTableCount > 0
    && value.adminAuditIncluded === true && value.adminUsersIncluded === true, "incomplete-native-scope");
  for (const key of ["publicTableInventorySha256", "publicDataSha256"]) requireThat(/^[a-f0-9]{64}$/u.test(value[key]), "invalid-native-fingerprint");
  return value;
}

/**
 * Start one capture per real Form intent, then verify only after its actual UI
 * success/reload/native-save checks have passed. No automatic coverage promotion.
 * A fresh APIRequestContext never inherits the BrowserContext cookie jar.
 */
export function createCoreFormPermissionReplayCollector({
  page, origin, sourceSha256, requiredCases, nativeCheckpoint,
  createRequestContext = options => playwrightRequest.newContext(options),
}) {
  const url = new URL(origin);
  requireThat(url.origin === origin && url.protocol === "http:" && url.hostname === "127.0.0.1" && Boolean(url.port), "non-owned-origin");
  requireThat(/^[a-f0-9]{64}$/u.test(sourceSha256), "missing-current-source-identity");
  requireThat(Array.isArray(requiredCases) && typeof nativeCheckpoint === "function", "missing-canonical-cases-or-native-owner");
  let active = null, closed = false;

  function begin({ caseId, formConsumer, surface }) {
    requireThat(!closed && active === null, "overlapping-or-closed-capture");
    requireThat(typeof caseId === "string" && /^[a-z0-9][a-z0-9:_-]{0,179}$/u.test(caseId), "invalid-case-id");
    const matches = requiredCases.filter(row => row.boundary === "form" && row.consumer === formConsumer
      && row.surface === surface && row.scenario === "permission_denied");
    requireThat(matches.length === 1 && typeof matches[0].key === "string", "missing-unique-canonical-form-surface");
    const captured = new Map();
    let captureFailure = null, finished = false;
    const onRequest = request => {
      if (request.method() !== "POST" || !request.headers()["next-action"]) return;
      try {
        requireThat(captured.size === 0, "multiple-action-intents-in-form-capture");
        const row = { specimen: null, status: null, responseContentType: null, pending: null };
        captured.set(request, row);
        row.pending = specimenFromRequest(request, origin).then(specimen => {
          if (finished) specimen.body.fill(0);
          else row.specimen = specimen;
        }).catch(error => {
          captureFailure = error instanceof FormPermissionVerificationError ? error.code : "actual-action-capture-rejected";
        });
      } catch (error) { captureFailure = error instanceof FormPermissionVerificationError ? error.code : "actual-action-capture-rejected"; }
    };
    const onResponse = response => {
      const row = captured.get(response.request());
      if (!row) return;
      row.status = response.status();
      row.responseContentType = response.headers()["content-type"] ?? "";
    };
    page.on("request", onRequest); page.on("response", onResponse);
    const release = () => {
      if (finished) return;
      finished = true; page.off("request", onRequest); page.off("response", onResponse);
      for (const row of captured.values()) row.specimen?.body.fill(0);
      captured.clear(); active = null;
    };
    active = { release };

    return {
      discard: release,
      async verifyAfterSuccessfulUI({ canonicalUiSuccessVerified, nativeSaveVerified }) {
        requireThat(!finished, "capture-already-finished");
        let client;
        try {
          requireThat(canonicalUiSuccessVerified === true && nativeSaveVerified === true, "successful-real-form-proof-required");
          await Promise.all([...captured.values()].map(row => row.pending));
          requireThat(captureFailure === null, captureFailure ?? "actual-action-capture-rejected");
          requireThat(captured.size === 1, "missing-unique-actual-action");
          const [[request, row]] = captured;
          requireThat(row.status >= 200 && row.status < 400 && /^text\/x-component(?:;|$)/iu.test(row.responseContentType), "original-action-not-acknowledged-current-flight");
          const actual = await specimenFromRequest(request, origin), expected = row.specimen;
          requireThat(expected !== null, "missing-request-specimen");
          try {
            requireThat(actual.url === expected.url && JSON.stringify(actual.headers) === JSON.stringify(expected.headers)
              && actual.body.equals(expected.body), "captured-request-drift");
          } finally { actual.body.fill(0); }
          const correlationId = randomUUID();
          const checkpoint = async phase => {
            let value;
            const checkpointRequest = { id: randomUUID(), kind: "form-permission-fingerprint", correlationId, phase };
            try { value = await nativeCheckpoint(checkpointRequest); }
            catch { fail("native-checkpoint-failed"); }
            requireThat(value?.id === checkpointRequest.id, "native-checkpoint-id-mismatch");
            return validateFingerprint(value, correlationId, phase);
          };
          const before = await checkpoint("before");
          // New context per specimen prevents cookie carry-over even between denials.
          client = await createRequestContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: false });
          const state = await client.storageState();
          requireThat(Array.isArray(state.cookies) && state.cookies.length === 0, "request-client-has-cookies");
          let response, httpError = false, denial = null;
          try {
            response = await client.post(expected.url, { headers: { ...expected.headers }, data: Buffer.from(expected.body),
              maxRedirects: 0, maxRetries: 0, failOnStatusCode: false, timeout: 25_000 });
            const status = response.status(), headers = response.headers();
            let unauthorizedJson;
            if (status === 401 && /^application\/json(?:;|$)/iu.test(headers["content-type"] ?? "")) {
              try { unauthorizedJson = await response.json(); } catch { unauthorizedJson = null; }
            }
            denial = classifyFormPermissionHttpResponse({ status, headers, unauthorizedJson }, origin);
          } catch { httpError = true; }
          // Always perform the after-checkpoint following an attempted replay,
          // even if transport failed or the response was not a recognized denial.
          const after = await checkpoint("after");
          requireThat(before.id !== after.id && before.ownedRunId === after.ownedRunId
            && before.publicTableCount === after.publicTableCount
            && before.publicTableInventorySha256 === after.publicTableInventorySha256
            && before.publicDataSha256 === after.publicDataSha256, "native-public-state-changed-or-unbound");
          requireThat(!httpError && denial !== null, "http-response-is-not-auth-denial");
          return { status: "pass", caseId, formConsumer, surface, candidateRequiredCase: matches[0].key,
            sourceSha256, routePathname: expected.pathname, actionSha256: expected.actionSha256,
            originalActionHttpStatus: row.status, originalUiSuccessVerified: true, originalNativeSaveVerified: true,
            replayCount: 1, replayCookieFree: true, replayRedirectsFollowed: 0, denial,
            nativeBefore: before.id, nativeAfter: after.id, ownedRunId: before.ownedRunId,
            publicTableCount: before.publicTableCount, publicDomainAuditDependentsUnchanged: true,
            automaticCoverage: [], bodyOrCookieArtifactsWritten: false,
            proofBoundary: "Actual current-build Form request rejected at the unauthenticated HTTP boundary; native all-public state unchanged. No Action-body execution, UI preservation, session revocation or role-policy proof." };
        } catch (error) {
          // Only our fixed error codes are safe; Playwright may include payload logs.
          if (error instanceof FormPermissionVerificationError) throw error;
          fail("replay-proof-not-established");
        } finally {
          let disposed = true;
          if (client) { try { await client.dispose(); } catch { disposed = false; } }
          release();
          requireThat(disposed, "request-client-cleanup-failed");
        }
      },
    };
  }
  return { begin, close() { active?.release(); closed = true; } };
}

export function validateFormPermissionFingerprintRequest(input) {
  requireThat(input && typeof input === "object" && !Array.isArray(input)
    && exactKeys(input, ["id", "kind", "correlationId", "phase"]), "invalid-fingerprint-request-shape");
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
  requireThat(uuid.test(input.id) && uuid.test(input.correlationId) && input.kind === "form-permission-fingerprint"
    && ["before", "after"].includes(input.phase), "invalid-fingerprint-request");
  return { ...input };
}
