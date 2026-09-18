import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createSupabaseFetch,
  runWithSupabaseRpcCorrelation,
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
const ALLOWED_FIELDS = new Set([
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

type CapturedRequest = {
  url: string;
  headers: Headers;
  response?: Response;
};

type ParsedLog = {
  event: "root_start" | "root_end" | "rpc_start" | "rpc_end";
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
    response,
  });
  return response;
};

function parseLogs(): ParsedLog[] {
  return logLines.map((line) => {
    const match = line.match(
      /^\[venesia:supabase-rpc-correlation:(root_start|root_end|rpc_start|rpc_end)\] (\{.*\})$/,
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
  });
  assert.equal(logLines.length, 0);
  assert.equal(requests[0]?.headers.has("traceparent"), false);

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
      Object.keys(entry.fields).every((field) => ALLOWED_FIELDS.has(field)),
      `unexpected logged field: ${Object.keys(entry.fields).join(",")}`,
    );
  }
  const successText = logLines.join("\n");
  assert.doesNotMatch(successText, new RegExp(REQUEST_SECRET));
  assert.doesNotMatch(successText, new RegExp(RESPONSE_SECRET));
  assert.doesNotMatch(successText, /authorization|apikey|cookie|body|email|user_id|project_id|entity_id|https?:\/\//i);

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
  fetchImplementation = abortablePendingFetch as typeof fetch;
  const timeoutTransport = createSupabaseFetch(5);
  await expectReject(
    () =>
      runWithSupabaseRpcCorrelation(() =>
        timeoutTransport(`${SUPABASE_ORIGIN}/rest/v1/rpc/timeout_case`),
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

  const saveSource = await readFile(
    new URL("../src/app/admin/projects/project-actions/save-entry.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    saveSource,
    /return runWithSupabaseRpcCorrelation\(async \(\) => \{\s+try \{/,
    "Heavy Project Save must own the explicit request-local trace scope",
  );
  assert.equal(
    (saveSource.match(/runWithSupabaseRpcCorrelation/g) ?? []).length,
    2,
    "correlation helper should appear only in the import and save boundary",
  );

  originalConsoleInfo("Supabase RPC correlation verification passed (16 RPCs, W3C, isolation, headers, errors, and sensitive-data contract).");
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
