import { classifyPublicDataError, isAbortOrTimeoutError } from "../supabase/classify-error";
import { sanitizeLogContext } from "./sanitize-context";
import { serializeOperationalError } from "./serialize-error";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

/** Once-per-process keys for expected timeout/network fallback warnings. */
const seenFallbackWarnings = new Set<string>();

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeLogContext(context),
  };
  const entry = `[venesia] ${JSON.stringify(payload)}`;

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  if (process.env.NODE_ENV === "development") {
    const writer = level === "debug" ? console.debug : console.info;
    writer(entry);
  }
}

function fallbackWarningKey(message: string, context?: LogContext) {
  const resource =
    context?.resource ??
    context?.pageSlug ??
    context?.path ??
    context?.slug ??
    context?.menuId ??
    context?.location ??
    context?.table ??
    message;
  return String(resource);
}

/**
 * Structured logging entry point. Wire to Sentry or similar here when ready.
 *
 * Expected public timeouts / aborts are logged once as warnings (not full errors)
 * so SSG builds do not flood with duplicate AbortError stacks when falling back.
 */
export function logError(message: string, error?: unknown, context?: LogContext) {
  if (error != null && (isAbortOrTimeoutError(error) || classifyPublicDataError(error).expectedFallback)) {
    const classified = classifyPublicDataError(error);
    const key = fallbackWarningKey(message, context);
    if (seenFallbackWarnings.has(key)) {
      return;
    }
    seenFallbackWarnings.add(key);
    writeLog("warn", `${message} (using fallback)`, {
      ...context,
      kind: classified.kind,
      reason: classified.summary,
      error: serializeOperationalError(error),
    });
    return;
  }

  writeLog("error", message, {
    ...context,
    error: serializeOperationalError(error),
  });
}

export function logWarn(message: string, context?: LogContext) {
  writeLog("warn", message, context);
}

/** Expected operational failures retain the same structured error contract without error severity. */
export function logWarnWithError(
  message: string,
  error?: unknown,
  context?: LogContext,
) {
  writeLog("warn", message, {
    ...context,
    error: serializeOperationalError(error),
  });
}

export function logInfo(message: string, context?: LogContext) {
  writeLog("info", message, context);
}

export function logDebug(message: string, context?: LogContext) {
  writeLog("debug", message, context);
}

/** Test / diagnostics helper — clears once-per-process fallback warning dedupe. */
export function resetFallbackWarningDedupe() {
  seenFallbackWarnings.clear();
}
