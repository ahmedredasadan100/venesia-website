type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return error;
}

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "error") {
    console.error("[venesia]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[venesia]", payload);
    return;
  }

  if (process.env.NODE_ENV === "development") {
    const writer = level === "debug" ? console.debug : console.info;
    writer("[venesia]", payload);
  }
}

/** Structured logging entry point. Wire to Sentry or similar here when ready. */
export function logError(message: string, error?: unknown, context?: LogContext) {
  writeLog("error", message, {
    ...context,
    error: serializeError(error),
  });
}

export function logWarn(message: string, context?: LogContext) {
  writeLog("warn", message, context);
}

export function logInfo(message: string, context?: LogContext) {
  writeLog("info", message, context);
}

export function logDebug(message: string, context?: LogContext) {
  writeLog("debug", message, context);
}
