/**
 * Builds a WhatsApp deep link from a phone number (Egyptian-friendly).
 * Returns null when the value cannot produce a safe wa.me URL.
 */
export function buildWhatsAppHref(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;

  // Strip spaces, dashes, parentheses, plus signs, and other separators.
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  // Egyptian local mobile: 01xxxxxxxxx → 201xxxxxxxxx
  if (digits.startsWith("0") && digits.length >= 10) {
    digits = `20${digits.slice(1)}`;
  }

  // Require a plausible international-ish length after normalization.
  if (digits.length < 8 || digits.length > 15) return null;

  return `https://wa.me/${digits}`;
}
