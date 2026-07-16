/**
 * Sanitizes a user-supplied redirect target so navigation can never leave
 * the site origin. Accepts only same-origin absolute paths ("/x?y=z").
 */
export function resolveSafeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  // "//host", "/\host" and control characters can escape the origin.
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(trimmed)) return fallback;

  try {
    const parsed = new URL(trimmed, "http://internal.invalid");
    if (parsed.origin !== "http://internal.invalid") return fallback;
    if (parsed.protocol !== "http:") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
