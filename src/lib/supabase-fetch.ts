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
        throw timeoutError;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", onAbort);
    }
  };
}
