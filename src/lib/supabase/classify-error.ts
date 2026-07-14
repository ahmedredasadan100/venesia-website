/**
 * Classification helpers for public Supabase reads.
 * Distinguishes expected timeouts (fallback-safe) from real failures.
 */

export type PublicDataFailureKind =
  | "timeout"
  | "network"
  | "config"
  | "schema"
  | "query"
  | "unexpected";

export type ClassifiedPublicDataFailure = {
  kind: PublicDataFailureKind;
  /** True when the public site should keep serving fallback/default data. */
  expectedFallback: boolean;
  summary: string;
};

function readErrorText(error: unknown): { name: string; message: string; hint: string; code: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "",
      message: error.message || "",
      hint: "",
      code: typeof (error as unknown as { code?: unknown }).code === "string" ? (error as unknown as { code: string }).code : "",
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name : "",
      message: typeof record.message === "string" ? record.message : String(error),
      hint: typeof record.hint === "string" ? record.hint : "",
      code: typeof record.code === "string" ? record.code : typeof record.code === "number" ? String(record.code) : "",
    };
  }

  return { name: "", message: String(error ?? ""), hint: "", code: "" };
}

export function isAbortOrTimeoutError(error: unknown): boolean {
  const { name, message, hint, code } = readErrorText(error);
  const blob = `${name} ${message} ${hint} ${code}`.toLowerCase();

  if (name === "AbortError" || name === "TimeoutError") return true;
  if (code === "SUPABASE_TIMEOUT" || code === "ABORT_ERR" || code === "20") return true;
  if (blob.includes("aborterror")) return true;
  if (blob.includes("timed out") || blob.includes("timeout")) return true;
  if (blob.includes("request was aborted")) return true;
  return false;
}

export function classifyPublicDataError(error: unknown): ClassifiedPublicDataFailure {
  const text = readErrorText(error);
  const blob = `${text.name} ${text.message} ${text.hint} ${text.code}`.toLowerCase();

  if (isAbortOrTimeoutError(error)) {
    return {
      kind: "timeout",
      expectedFallback: true,
      summary: text.message || "Request timed out or was aborted",
    };
  }

  if (
    blob.includes("missing required server environment") ||
    blob.includes("supabase_url") ||
    blob.includes("service_role") ||
    blob.includes("invalid api key") ||
    blob.includes("jwt")
  ) {
    return {
      kind: "config",
      expectedFallback: false,
      summary: text.message || "Supabase configuration error",
    };
  }

  if (
    blob.includes("does not exist") ||
    blob.includes("relation") ||
    blob.includes("could not find the table") ||
    blob.includes("schema cache") ||
    text.code === "42P01" ||
    text.code === "PGRST205"
  ) {
    return {
      kind: "schema",
      expectedFallback: false,
      summary: text.message || "Schema or migration mismatch",
    };
  }

  if (
    blob.includes("fetch failed") ||
    blob.includes("network") ||
    blob.includes("econnrefused") ||
    blob.includes("enotfound") ||
    blob.includes("econnreset")
  ) {
    return {
      kind: "network",
      expectedFallback: true,
      summary: text.message || "Network failure talking to Supabase",
    };
  }

  if (text.message || text.code) {
    return {
      kind: "query",
      expectedFallback: false,
      summary: text.message || `Query failed (${text.code || "unknown"})`,
    };
  }

  return {
    kind: "unexpected",
    expectedFallback: false,
    summary: text.message || "Unexpected public data failure",
  };
}
