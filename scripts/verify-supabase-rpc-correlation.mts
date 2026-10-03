import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createSupabaseFetch,
  runWithSupabaseRpcCorrelation,
  runWithSupabaseRpcCorrelationPhase,
  runWithSupabaseRpcCorrelationSyncPhase,
  startSupabaseRpcCorrelationPhase,
  SUPABASE_RPC_CORRELATION_PHASE_NAMES,
  type SupabaseRpcCorrelationPhaseName,
} from "../src/lib/supabase-fetch.ts";

const SUPABASE_ORIGIN = "https://trace-test.supabase.co";
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/;
const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);
const REQUEST_SECRET = "REQUEST_SECRET_MUST_NOT_APPEAR";
const RESPONSE_SECRET = "RESPONSE_SECRET_MUST_NOT_APPEAR";
const ERROR_SECRET = "ERROR_SECRET_MUST_NOT_APPEAR";
const RPC_ALLOWED_FIELDS = new Set([
  "trace_id",
  "span_id",
  "parent_span_id",
  "rpc_name",
  "rpc_ordinal",
  "request_start",
  "response_headers_received",
  "request_end",
  "duration_ms",
  "http_status",
  "sanitized_error_class",
]);
const PHASE_ALLOWED_FIELDS = new Set([
  "phase_name",
  "trace_id",
  "start",
  "end",
  "duration_ms",
  "status",
  "sanitized_error_class",
]);

type CapturedRequest = {
  url: string;
  headers: Headers;
  response?: Response;
  cache?: RequestCache;
};

type ParsedLog = {
  event: "root_start" | "root_end" | "rpc_start" | "rpc_end" | "phase";
  fields: Record<string, unknown>;
};

const originalFetch = globalThis.fetch;
const originalConsoleInfo = console.info;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalTimeout = process.env.SUPABASE_FETCH_TIMEOUT_MS;
const logLines: string[] = [];
const requests: CapturedRequest[] = [];

let fetchImplementation: typeof fetch = async (input, init) => {
  const response = new Response("{}", { status: 200 });
  requests.push({
    url: String(input),
    headers: new Headers(init?.headers),
    cache: init?.cache,
    response,
  });
  return response;
};

function parseLogs(): ParsedLog[] {
  return logLines.map((line) => {
    const match = line.match(
      /^\[venesia:supabase-rpc-correlation:(root_start|root_end|rpc_start|rpc_end|phase)\] (\{.*\})$/,
    );
    assert.ok(match, `unexpected correlation log format: ${line}`);
    return {
      event: match[1] as ParsedLog["event"],
      fields: JSON.parse(match[2]) as Record<string, unknown>,
    };
  });
}

function clearCaptured() {
  logLines.length = 0;
  requests.length = 0;
}

function abortError() {
  return new DOMException("transport aborted", "AbortError");
}

function abortablePendingFetch(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(abortError());
      return;
    }
    init?.signal?.addEventListener("abort", () => reject(abortError()), {
      once: true,
    });
  });
}

async function expectReject(
  operation: () => Promise<unknown>,
  assertion: (error: unknown) => void,
) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert.notEqual(caught, undefined, "expected operation to reject");
  assertion(caught);
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  delete process.env.SUPABASE_FETCH_TIMEOUT_MS;
  console.info = (...values: unknown[]) => {
    logLines.push(values.map(String).join(" "));
  };
  globalThis.fetch = ((input, init) => fetchImplementation(input, init)) as typeof fetch;

  const transport = createSupabaseFetch(100);

  // A valid RPC outside the Heavy Save scope retains the previous transport behavior.
  await transport(`${SUPABASE_ORIGIN}/rest/v1/rpc/outside_scope`, {
    headers: { "x-existing": REQUEST_SECRET },
    cache: "force-cache",
  });
  assert.equal(logLines.length, 0);
  assert.equal(requests[0]?.headers.has("traceparent"), false);
  assert.equal(requests[0]?.cache, "no-store", "Caller cache options cannot reintroduce hidden Supabase caching.");

  // Non-RPC paths and non-Supabase origins never receive instrumentation.
  clearCaptured();
  await runWithSupabaseRpcCorrelation(async () => {
    await transport(`${SUPABASE_ORIGIN}/rest/v1/projects?select=id`);
    await transport(`${SUPABASE_ORIGIN}/storage/v1/object/media/example.jpg`);
    await transport("https://example.com/rest/v1/rpc/foreign_rpc");
  });
  assert.equal(logLines.length, 0);
  assert.ok(requests.every((request) => !request.headers.has("traceparent")));

  // One request-local trace correlates 16 parallel RPC calls without changing responses.
  clearCaptured();
  fetchImplementation = async (input, init) => {
    const ordinal = requests.length + 1;
    const response = new Response("{}", {
      status: 200,
      headers: { "x-response-secret": RESPONSE_SECRET },
    });
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      response,
    });
    await new Promise((resolve) => setTimeout(resolve, (17 - ordinal) % 4));
    return response;
  };

  const responses = await runWithSupabaseRpcCorrelation(() =>
    Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        transport(
          `${SUPABASE_ORIGIN}/rest/v1/rpc/rpc_${String(index + 1).padStart(2, "0")}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${REQUEST_SECRET}`,
              apikey: REQUEST_SECRET,
              "x-existing": "preserved",
            },
            body: JSON.stringify({ secret: REQUEST_SECRET }),
          },
        ),
      ),
    ),
  );

  assert.equal(responses.length, 16);
  assert.ok(
    responses.every((response, index) => response === requests[index]?.response),
    "fetch responses must be returned unchanged",
  );
  assert.ok(responses.every((response) => response.bodyUsed === false));
  assert.ok(
    requests.every(
      (request) =>
        request.headers.get("Authorization") === `Bearer ${REQUEST_SECRET}` &&
        request.headers.get("apikey") === REQUEST_SECRET &&
        request.headers.get("x-existing") === "preserved",
    ),
    "existing headers must be preserved",
  );

  const successLogs = parseLogs();
  assert.equal(successLogs.filter((entry) => entry.event === "root_start").length, 1);
  assert.equal(successLogs.filter((entry) => entry.event === "root_end").length, 1);
  const rpcStarts = successLogs.filter((entry) => entry.event === "rpc_start");
  const rpcEnds = successLogs.filter((entry) => entry.event === "rpc_end");
  assert.equal(rpcStarts.length, 16);
  assert.equal(rpcEnds.length, 16);

  const root = successLogs.find((entry) => entry.event === "root_start")!;
  const traceId = String(root.fields.trace_id);
  const rootSpanId = String(root.fields.span_id);
  assert.match(traceId, TRACE_ID);
  assert.match(rootSpanId, SPAN_ID);
  assert.notEqual(traceId, ZERO_TRACE_ID);
  assert.notEqual(rootSpanId, ZERO_SPAN_ID);
  assert.equal(root.fields.parent_span_id, null);

  const childSpanIds = new Set<string>();
  for (const [index, entry] of rpcStarts.entries()) {
    const expectedOrdinal = index + 1;
    const spanId = String(entry.fields.span_id);
    assert.equal(entry.fields.trace_id, traceId);
    assert.equal(entry.fields.parent_span_id, rootSpanId);
    assert.equal(entry.fields.rpc_ordinal, expectedOrdinal);
    assert.equal(entry.fields.rpc_name, `rpc_${String(expectedOrdinal).padStart(2, "0")}`);
    assert.match(spanId, SPAN_ID);
    assert.notEqual(spanId, ZERO_SPAN_ID);
    childSpanIds.add(spanId);

    const traceparent = requests[index]?.headers.get("traceparent") ?? "";
    const traceparentMatch = traceparent.match(TRACEPARENT);
    assert.ok(traceparentMatch, `invalid W3C traceparent: ${traceparent}`);
    assert.equal(traceparentMatch[1], traceId);
    assert.equal(traceparentMatch[2], spanId);
  }
  assert.equal(childSpanIds.size, 16, "each RPC must have a unique child span");
  assert.deepEqual(
    rpcEnds.map((entry) => entry.fields.rpc_ordinal).sort((left, right) => Number(left) - Number(right)),
    Array.from({ length: 16 }, (_, index) => index + 1),
  );
  assert.ok(
    rpcEnds.every(
      (entry) =>
        entry.fields.trace_id === traceId &&
        entry.fields.parent_span_id === rootSpanId &&
        entry.fields.http_status === 200 &&
        typeof entry.fields.response_headers_received === "string" &&
        entry.fields.request_end === entry.fields.response_headers_received &&
        typeof entry.fields.duration_ms === "number" &&
        entry.fields.sanitized_error_class === null,
    ),
  );

  for (const entry of successLogs) {
    assert.ok(
      Object.keys(entry.fields).every((field) => RPC_ALLOWED_FIELDS.has(field)),
      `unexpected logged field: ${Object.keys(entry.fields).join(",")}`,
    );
  }
  const successText = logLines.join("\n");
  assert.doesNotMatch(successText, new RegExp(REQUEST_SECRET));
  assert.doesNotMatch(successText, new RegExp(RESPONSE_SECRET));
  assert.doesNotMatch(successText, /authorization|apikey|cookie|body|email|user_id|project_id|entity_id|https?:\/\//i);

  // Phase timing stays inside the same Heavy Save trace and logs only the fixed allowlist.
  clearCaptured();
  fetchImplementation = async (input, init) => {
    const response = new Response("{}", { status: 200 });
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      response,
    });
    return response;
  };
  const phaseResult = { secret: REQUEST_SECRET };
  const observedSyncOrder: string[] = [];
  const returnedPhaseResult = await runWithSupabaseRpcCorrelation(async () => {
    await runWithSupabaseRpcCorrelationPhase(
      "pre_lease_project_read_and_prepare",
      async () => phaseResult,
    );
    await runWithSupabaseRpcCorrelationPhase(
      "post_atomic_persisted_child_reads",
      async () => phaseResult,
    );
    const endMediaPreparation = startSupabaseRpcCorrelationPhase(
      "media_reference_preparation",
    );
    endMediaPreparation("success");
    endMediaPreparation("error", new Error(ERROR_SECRET));
    await runWithSupabaseRpcCorrelationPhase(
      "post_save_project_root_read",
      async () => phaseResult,
    );
    await runWithSupabaseRpcCorrelationPhase(
      "post_save_child_reconciliation_reads",
      async () => phaseResult,
    );
    const mapped = runWithSupabaseRpcCorrelationSyncPhase(
      "reconciliation_mapping",
      () => {
        observedSyncOrder.push("mapping");
        return phaseResult;
      },
    );
    observedSyncOrder.push("after_mapping");
    assert.equal(mapped, phaseResult);
    await runWithSupabaseRpcCorrelationPhase(
      "cache_revalidation",
      async () => phaseResult,
    );
    await runWithSupabaseRpcCorrelationPhase(
      "audit_write",
      async () => phaseResult,
    );
    const finalResult = runWithSupabaseRpcCorrelationSyncPhase(
      "final_result_feedback_preparation",
      () => {
        observedSyncOrder.push("feedback");
        return phaseResult;
      },
    );
    observedSyncOrder.push("after_feedback");
    await transport(`${SUPABASE_ORIGIN}/rest/v1/rpc/phase_anchor`);
    return finalResult;
  });
  assert.equal(returnedPhaseResult, phaseResult, "phase wrappers must preserve return identity");
  assert.deepEqual(observedSyncOrder, [
    "mapping",
    "after_mapping",
    "feedback",
    "after_feedback",
  ]);

  const phaseLogs = parseLogs();
  const phaseEntries = phaseLogs.filter((entry) => entry.event === "phase");
  assert.equal(phaseEntries.length, SUPABASE_RPC_CORRELATION_PHASE_NAMES.length);
  assert.deepEqual(
    phaseEntries.map((entry) => entry.fields.phase_name).sort(),
    [...SUPABASE_RPC_CORRELATION_PHASE_NAMES].sort(),
  );
  const phaseRoot = phaseLogs.find((entry) => entry.event === "root_start")!;
  assert.equal(phaseLogs[0]?.event, "root_start", "root must activate before the first phase event");
  assert.equal(phaseLogs.filter((entry) => entry.event === "root_start").length, 1);
  assert.equal(phaseLogs.filter((entry) => entry.event === "root_end").length, 1);
  assert.equal(phaseLogs.filter((entry) => entry.event === "rpc_start").length, 1);
  assert.equal(phaseLogs.filter((entry) => entry.event === "rpc_end").length, 1);
  for (const entry of phaseEntries) {
    assert.deepEqual(
      Object.keys(entry.fields).sort(),
      [...PHASE_ALLOWED_FIELDS].sort(),
    );
    assert.equal(entry.fields.trace_id, phaseRoot.fields.trace_id);
    assert.ok(SUPABASE_RPC_CORRELATION_PHASE_NAMES.includes(
      entry.fields.phase_name as SupabaseRpcCorrelationPhaseName,
    ));
    assert.ok(Number.isFinite(Date.parse(String(entry.fields.start))));
    assert.ok(Number.isFinite(Date.parse(String(entry.fields.end))));
    assert.equal(entry.fields.status, "success");
    assert.equal(entry.fields.sanitized_error_class, null);
    assert.equal(typeof entry.fields.duration_ms, "number");
    assert.ok(Number(entry.fields.duration_ms) >= 0);
  }
  assert.ok(
    phaseEntries.every(
      (entry) =>
        entry.fields.phase_name !== "lease_acquire" &&
        entry.fields.phase_name !== "atomic_save" &&
        entry.fields.phase_name !== "replacement_barrier" &&
        entry.fields.phase_name !== "lease_completion",
    ),
    "RPC-derived phases must not be duplicated",
  );
  const phaseText = phaseEntries.map((entry) => JSON.stringify(entry.fields)).join("\n");
  assert.doesNotMatch(phaseText, new RegExp(REQUEST_SECRET));
  assert.doesNotMatch(phaseText, new RegExp(ERROR_SECRET));
  assert.doesNotMatch(
    phaseText,
    /authorization|apikey|cookie|body|payload|query|response|email|user_id|project_id|entity_id|https?:\/\//i,
  );

  // Phase helpers are silent outside the Heavy Save scope and reject no values.
  clearCaptured();
  assert.equal(
    await runWithSupabaseRpcCorrelationPhase(
      "cache_revalidation",
      async () => phaseResult,
    ),
    phaseResult,
  );
  assert.equal(
    runWithSupabaseRpcCorrelationSyncPhase(
      "reconciliation_mapping",
      () => phaseResult,
    ),
    phaseResult,
  );
  assert.equal(logLines.length, 0);

  // Runtime allowlisting suppresses invalid names even if a caller bypasses TypeScript.
  clearCaptured();
  const invalidPhaseResult = await runWithSupabaseRpcCorrelation(() =>
    runWithSupabaseRpcCorrelationPhase(
      "not_allowlisted" as SupabaseRpcCorrelationPhaseName,
      async () => phaseResult,
    ),
  );
  assert.equal(invalidPhaseResult, phaseResult);
  assert.equal(logLines.length, 0);

  // Errors retain identity while logs expose only a sanitized class.
  clearCaptured();
  const phaseError = new TypeError(ERROR_SECRET);
  await expectReject(
    () =>
      runWithSupabaseRpcCorrelation(() =>
        runWithSupabaseRpcCorrelationPhase(
          "cache_revalidation",
          async () => {
            throw phaseError;
          },
        ),
      ),
    (error) => assert.equal(error, phaseError),
  );
  const failedPhase = parseLogs().find((entry) => entry.event === "phase")!;
  assert.equal(failedPhase.fields.status, "error");
  assert.equal(failedPhase.fields.sanitized_error_class, "TypeError");
  assert.doesNotMatch(logLines.join("\n"), new RegExp(ERROR_SECRET));

  clearCaptured();
  const requestInput = new Request(
    `${SUPABASE_ORIGIN}/rest/v1/rpc/request_input_headers`,
    { headers: { "x-request-input": "preserved" } },
  );
  await runWithSupabaseRpcCorrelation(() => transport(requestInput));
  assert.equal(requests[0]?.headers.get("x-request-input"), "preserved");

  // HTTP errors retain the original Response and log only status plus allowed timing fields.
  clearCaptured();
  const httpErrorResponse = new Response(RESPONSE_SECRET, {
    status: 503,
    headers: { "x-response-secret": RESPONSE_SECRET },
  });
  fetchImplementation = async (input, init) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      response: httpErrorResponse,
    });
    return httpErrorResponse;
  };
  const returnedHttpError = await runWithSupabaseRpcCorrelation(() =>
    transport(`${SUPABASE_ORIGIN}/rest/v1/rpc/http_error`),
  );
  assert.equal(returnedHttpError, httpErrorResponse);
  assert.equal(returnedHttpError.bodyUsed, false);
  const httpEnd = parseLogs().find((entry) => entry.event === "rpc_end")!;
  assert.equal(httpEnd.fields.http_status, 503);
  assert.equal(httpEnd.fields.sanitized_error_class, null);
  assert.doesNotMatch(logLines.join("\n"), new RegExp(RESPONSE_SECRET));

  // Network errors expose only an allow-listed class, never the raw message.
  clearCaptured();
  fetchImplementation = async () => {
    throw new TypeError(ERROR_SECRET);
  };
  await expectReject(
    () =>
      runWithSupabaseRpcCorrelation(() =>
        transport(`${SUPABASE_ORIGIN}/rest/v1/rpc/network_error`),
      ),
    (error) => assert.ok(error instanceof TypeError),
  );
  const networkEnd = parseLogs().find((entry) => entry.event === "rpc_end")!;
  assert.equal(networkEnd.fields.http_status, null);
  assert.equal(networkEnd.fields.sanitized_error_class, "TypeError");
  assert.doesNotMatch(logLines.join("\n"), new RegExp(ERROR_SECRET));

  // Timeout and upstream abort keep the existing thrown error contract.
  clearCaptured();
  fetchImplementation = async (input, init) => {
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    return abortablePendingFetch(input, init);
  };
  const timeoutTransport = createSupabaseFetch(5);
  await expectReject(
    () =>
      runWithSupabaseRpcCorrelation(() =>
        timeoutTransport(`${SUPABASE_ORIGIN}/rest/v1/rpc/timeout_case`, { cache: "force-cache" }),
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "TimeoutError");
      assert.equal((error as Error & { code?: string }).code, "SUPABASE_TIMEOUT");
    },
  );
  const timeoutEnd = parseLogs().find((entry) => entry.event === "rpc_end")!;
  assert.equal(timeoutEnd.fields.sanitized_error_class, "TimeoutError");
  assert.equal(timeoutEnd.fields.http_status, null);

  clearCaptured();
  const upstreamController = new AbortController();
  upstreamController.abort();
  await expectReject(
    () =>
      runWithSupabaseRpcCorrelation(() =>
        transport(`${SUPABASE_ORIGIN}/rest/v1/rpc/abort_case`, {
          signal: upstreamController.signal,
          cache: "force-cache",
        }),
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "TimeoutError");
      assert.equal((error as Error & { code?: string }).code, "SUPABASE_TIMEOUT");
    },
  );
  const abortEnd = parseLogs().find((entry) => entry.event === "rpc_end")!;
  assert.equal(abortEnd.fields.sanitized_error_class, "AbortError");
  assert.equal(abortEnd.fields.http_status, null);

  // A signal aborted after dispatch still cancels the wrapped no-store request.
  clearCaptured();
  const liveController = new AbortController();
  fetchImplementation = async (input, init) => {
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.notEqual(init.signal, liveController.signal, "The existing timeout controller remains active.");
    assert.equal(init.signal.aborted, false);
    const pending = abortablePendingFetch(input, init);
    queueMicrotask(() => liveController.abort());
    return pending;
  };
  await expectReject(
    () => runWithSupabaseRpcCorrelation(() => transport(SUPABASE_ORIGIN + "/rest/v1/rpc/live_abort_case", {
      signal: liveController.signal, cache: "force-cache",
    })),
    error => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "TimeoutError");
      assert.equal((error as Error & { code?: string }).code, "SUPABASE_TIMEOUT");
      assert.equal(liveController.signal.aborted, true);
    },
  );
  assert.equal(parseLogs().find(entry => entry.event === "rpc_end")!.fields.sanitized_error_class, "AbortError");

  const [
    saveSource,
    projectMediaCoordinationSource,
    synchronizationSource,
    projectEntryDataSource,
    auditSource,
  ] = await Promise.all([
    readFile(
      new URL("../src/app/admin/projects/project-actions/save-entry.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin/projects/project-entry-media-coordination.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin/media-catalog/synchronization.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin/projects/project-entry-data.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin/audit/record-admin-audit-event.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    saveSource,
    /return runWithSupabaseRpcCorrelation\(async \(\) => \{\s+try \{/,
    "Heavy Project Save must own the explicit request-local trace scope",
  );
  assert.equal(
    (saveSource.match(/\brunWithSupabaseRpcCorrelation\b/g) ?? []).length,
    2,
    "correlation helper should appear only in the import and save boundary",
  );
  assert.match(saveSource, /"pre_lease_project_read_and_prepare"/);
  assert.match(saveSource, /"cache_revalidation"/);
  assert.match(saveSource, /"final_result_feedback_preparation"/);
  assert.match(projectMediaCoordinationSource, /"post_atomic_persisted_child_reads"/);
  assert.match(synchronizationSource, /"media_reference_preparation"/);
  assert.match(
    synchronizationSource,
    /onPrepared\?\.\(\);\s+const \{ error \} = await getSupabaseAdmin\(\)\.rpc\("replace_media_references_for_entity"/,
    "preparation tracking must settle immediately before each existing replacement RPC",
  );
  assert.match(
    synchronizationSource,
    /const \[writeResults, cleanupResults\] = await Promise\.all\(\[/,
    "the existing replacement Promise.all boundary must remain intact",
  );
  assert.match(projectEntryDataSource, /"post_save_project_root_read"/);
  assert.match(projectEntryDataSource, /"post_save_child_reconciliation_reads"/);
  assert.match(projectEntryDataSource, /"reconciliation_mapping"/);
  assert.match(
    projectEntryDataSource,
    /"post_save_child_reconciliation_reads",\s+\(\) =>\s+Promise\.all\(\[/,
    "post-save child reconciliation reads must remain parallel",
  );
  assert.match(auditSource, /"audit_write"/);

  originalConsoleInfo("Supabase RPC correlation verification passed (16 RPCs, phase timings, W3C, isolation, headers, forced no-store, timeout/live abort, errors, and sensitive-data contract).");
}

try {
  await main();
} finally {
  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
  if (originalSupabaseUrl == null) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  }
  if (originalTimeout == null) {
    delete process.env.SUPABASE_FETCH_TIMEOUT_MS;
  } else {
    process.env.SUPABASE_FETCH_TIMEOUT_MS = originalTimeout;
  }
}
