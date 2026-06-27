const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|cookie|session|hash|authorization|api[_-]?key|credential)/i;

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value === "object") return sanitizeAuditMetadata(value as Record<string, unknown>);
  return undefined;
}

export function sanitizeAuditMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const next = sanitizeValue(value);
    if (next !== undefined) sanitized[key] = next;
  }

  return sanitized;
}
