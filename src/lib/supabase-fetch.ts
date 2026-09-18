const { AsyncLocalStorage } = process.getBuiltinModule(
  "node:async_hooks",
) as typeof import("node:async_hooks");

type SupabaseRpcCorrelationState = {
  traceId: string;
  rootSpanId: string;
  requestStart: string;
  startedAt: number;
  rpcOrdinal: number;
  activated: boolean;
};

type SupabaseRpcCorrelationSpan = {
  state: SupabaseRpcCorrelationState;
  rpcName: string;
  spanId: string;
  ordinal: number;
  requestStart: string;
  startedAt: number;
  headers: Headers;
};

type SupabaseRpcLogFields = {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  rpc_name?: string;
  rpc_ordinal?: number;
  request_start: string;
  response_headers_received?: string;
  request_end?: string;
  duration_ms?: number;
  http_status?: number | null;
  sanitized_error_class?: string | null;
};

const supabaseRpcCorrelation = new AsyncLocalStorage<SupabaseRpcCorrelationState>();
const RPC_PATH = /^\/rest\/v1\/rpc\/([A-Za-z_][A-Za-z0-9_]*)$/;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);

function randomW3cId(bytes: 8 | 16) {
  const zero = bytes === 16 ? ZERO_TRACE_ID : ZERO_SPAN_ID;
  let value = zero;
  while (value === zero) {
    value = Array.from(
      globalThis.crypto.getRandomValues(new Uint8Array(bytes)),
      (octet) => octet.toString(16).padStart(2, "0"),
    ).join("");
  }
  return value;
}

function elapsedMs(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(3));
}

function emitSupabaseRpcCorrelation(
  event: "root_start" | "root_end" | "rpc_start" | "rpc_end",
  fields: SupabaseRpcLogFields,
) {
  console.info(
    `[venesia:supabase-rpc-correlation:${event}] ${JSON.stringify(fields)}`,
  );
}

function sanitizedErrorClass(error: unknown) {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return "AbortError";
  }
  if (!(error instanceof Error)) return "UnknownError";
  if (error.name === "TimeoutError") return "TimeoutError";
  if (error.name === "AbortError") return "AbortError";
  if (error.name === "TypeError") return "TypeError";
  return "Error";
}

function activateCorrelation(state: SupabaseRpcCorrelationState) {
  if (state.activated) return;
  state.activated = true;
  emitSupabaseRpcCorrelation("root_start", {
    trace_id: state.traceId,
    span_id: state.rootSpanId,
    parent_span_id: null,
    request_start: state.requestStart,
  });
}

function rpcRequest(input: RequestInfo | URL) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const configuredOrigin = new URL(configuredUrl).origin;
    const requestUrl = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (requestUrl.origin !== configuredOrigin) return null;
    const match = RPC_PATH.exec(requestUrl.pathname);
    return match?.[1] ? { name: match[1] } : null;
  } catch {
    return null;
  }
}

function correlationHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request
      ? input.headers
      : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  }
  return headers;
}

function startRpcCorrelation(
  input: RequestInfo | URL,
  init?: RequestInit,
): SupabaseRpcCorrelationSpan | null {
  const state = supabaseRpcCorrelation.getStore();
  const rpc = state ? rpcRequest(input) : null;
  if (!state || !rpc) return null;

  const span: SupabaseRpcCorrelationSpan = {
    state,
    rpcName: rpc.name,
    spanId: randomW3cId(8),
    ordinal: ++state.rpcOrdinal,
    requestStart: new Date().toISOString(),
    startedAt: performance.now(),
    headers: correlationHeaders(input, init),
  };
  activateCorrelation(state);
  span.headers.set(
    "traceparent",
    `00-${state.traceId}-${span.spanId}-01`,
  );
  emitSupabaseRpcCorrelation("rpc_start", {
    trace_id: state.traceId,
    span_id: span.spanId,
    parent_span_id: state.rootSpanId,
    rpc_name: span.rpcName,
    rpc_ordinal: span.ordinal,
    request_start: span.requestStart,
  });
  return span;
}

function endRpcCorrelation(
  span: SupabaseRpcCorrelationSpan | null,
  result: {
    httpStatus: number | null;
    errorClass: string | null;
    responseHeadersReceived?: string;
  },
) {
  if (!span) return;
  const requestEnd = result.responseHeadersReceived ?? new Date().toISOString();
  emitSupabaseRpcCorrelation("rpc_end", {
    trace_id: span.state.traceId,
    span_id: span.spanId,
    parent_span_id: span.state.rootSpanId,
    rpc_name: span.rpcName,
    rpc_ordinal: span.ordinal,
    request_start: span.requestStart,
    ...(result.responseHeadersReceived
      ? { response_headers_received: result.responseHeadersReceived }
      : {}),
    request_end: requestEnd,
    duration_ms: elapsedMs(span.startedAt),
    http_status: result.httpStatus,
    sanitized_error_class: result.errorClass,
  });
}

/** Runs one Heavy Project Save with request-local RPC correlation state. */
export async function runWithSupabaseRpcCorrelation<TResult>(
  operation: () => Promise<TResult>,
): Promise<TResult> {
  if (supabaseRpcCorrelation.getStore()) {
    return operation();
  }

  const state: SupabaseRpcCorrelationState = {
    traceId: randomW3cId(16),
    rootSpanId: randomW3cId(8),
    requestStart: new Date().toISOString(),
    startedAt: performance.now(),
    rpcOrdinal: 0,
    activated: false,
  };
  let operationError: unknown;

  try {
    return await supabaseRpcCorrelation.run(state, operation);
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (state.activated) {
      emitSupabaseRpcCorrelation("root_end", {
        trace_id: state.traceId,
        span_id: state.rootSpanId,
        parent_span_id: null,
        request_start: state.requestStart,
        request_end: new Date().toISOString(),
        duration_ms: elapsedMs(state.startedAt),
        sanitized_error_class:
          operationError == null ? null : sanitizedErrorClass(operationError),
      });
    }
  }
}

/**
 * Fetch wrapper for Supabase clients with a hard timeout so builds/runtime
 * cannot hang indefinitely when the database is unreachable.
 *
 * Timeouts throw a typed TimeoutError (code SUPABASE_TIMEOUT) so callers/loggers
 * can treat them as expected public fallbacks instead of raw AbortError noise.
 */
export function createSupabaseFetch(defaultTimeoutMs = 8000): typeof fetch {
  const configured = Number.parseInt(
    process.env.SUPABASE_FETCH_TIMEOUT_MS ?? "",
    10,
  );
  const timeoutMs =
    Number.isFinite(configured) && configured > 0 ? configured : defaultTimeoutMs;

  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const correlationSpan = startRpcCorrelation(input, init);

    const upstreamSignal = init?.signal;
    const onAbort = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener("abort", onAbort, { once: true });
      }
    }

    try {
      const response = await fetch(input, {
        ...init,
        ...(correlationSpan ? { headers: correlationSpan.headers } : {}),
        signal: controller.signal,
      });
      const headersReceived = new Date().toISOString();
      endRpcCorrelation(correlationSpan, {
        httpStatus: response.status,
        errorClass: null,
        responseHeadersReceived: headersReceived,
      });
      return response;
    } catch (error) {
      const aborted =
        (error instanceof Error && error.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
          error instanceof DOMException &&
          error.name === "AbortError");

      if (aborted) {
        const timedOut = !upstreamSignal?.aborted;
        const timeoutError = new Error(
          timedOut
            ? `Supabase request timed out after ${timeoutMs}ms`
            : "Supabase request was aborted",
        );
        timeoutError.name = "TimeoutError";
        Object.assign(timeoutError, {
          code: "SUPABASE_TIMEOUT",
          cause: error,
        });
        endRpcCorrelation(correlationSpan, {
          httpStatus: null,
          errorClass: timedOut ? "TimeoutError" : "AbortError",
        });
        throw timeoutError;
      }

      endRpcCorrelation(correlationSpan, {
        httpStatus: null,
        errorClass: sanitizedErrorClass(error),
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", onAbort);
    }
  };
}
