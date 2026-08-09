const REDACTED_VALUE = "[REDACTED]";
const CIRCULAR_VALUE = "[CIRCULAR]";
const SENSITIVE_CONTEXT_KEY =
  /(?:authorization|cookie|password|passcode|secret|service[_-]?role|session|token|database[_-]?url|email|phone|username)/iu;
const SENSITIVE_TEXT_PATTERNS = [
  /\bpostgres(?:ql)?:\/\/[^\s"']+/giu,
  /\bbearer\s+[^\s,"']+/giu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /\b(?:authorization|cookie|password|passcode|secret|service[_-]?role|session|token|database[_-]?url)\s*[=:]\s*[^\s,;]+/giu,
] as const;

function sanitizeText(value: string) {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, REDACTED_VALUE),
    value,
  );
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return CIRCULAR_VALUE;

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_CONTEXT_KEY.test(key)
        ? REDACTED_VALUE
        : sanitizeValue(item, seen),
    ]),
  );
}

/** Removes credentials and common PII fields before operational context is emitted. */
export function sanitizeLogContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  return sanitizeValue(context, new WeakSet()) as Record<string, unknown>;
}
