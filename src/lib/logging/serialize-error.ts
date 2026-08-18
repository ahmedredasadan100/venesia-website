export type SerializedOperationalError = {
  name: string;
  message: string;
  code: string | null;
  details: unknown;
  hint: string | null;
  stack?: string;
};

/** Normalizes native and Supabase/PostgREST errors before context sanitization. */
export function serializeOperationalError(
  error: unknown,
): SerializedOperationalError {
  if (error instanceof Error) {
    const record = error as unknown as Record<string, unknown>;
    return {
      name: error.name || "Error",
      message: error.message,
      code:
        typeof record.code === "string" || typeof record.code === "number"
          ? String(record.code)
          : null,
      details: record.details ?? null,
      hint: typeof record.hint === "string" ? record.hint : null,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const looksLikePostgrestError =
      typeof record.code === "string" && typeof record.message === "string";
    return {
      name:
        typeof record.name === "string"
          ? record.name
          : looksLikePostgrestError
            ? "PostgrestError"
            : "Error",
      message:
        typeof record.message === "string" ? record.message : "Unknown error object",
      code:
        typeof record.code === "string" || typeof record.code === "number"
          ? String(record.code)
          : null,
      details: record.details ?? null,
      hint: typeof record.hint === "string" ? record.hint : null,
    };
  }

  return {
    name: "UnknownError",
    message: String(error ?? "Unknown error"),
    code: null,
    details: null,
    hint: null,
  };
}
