/**
 * Fetch wrapper for Supabase clients with a hard timeout so builds/runtime
 * cannot hang indefinitely when the database is unreachable.
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
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", onAbort);
    }
  };
}
