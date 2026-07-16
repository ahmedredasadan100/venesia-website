import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve a local /public image path for Next/Image.
 * Missing local files fall back to a known asset so the optimizer does not 400.
 */
export function resolveLocalPublicImage(
  src: string | null | undefined,
  fallback: string,
): string {
  const trimmed = src?.trim() ?? "";
  if (!trimmed) return fallback;

  // Remote or data URLs are left untouched.
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (!trimmed.startsWith("/")) {
    return trimmed;
  }

  const absolutePath = join(process.cwd(), "public", trimmed.replace(/^\//, ""));
  if (existsSync(absolutePath)) {
    return trimmed;
  }

  return fallback;
}
