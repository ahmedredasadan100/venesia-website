import type { ReactNode } from "react";

/**
 * Approved contact icon set for About CTA / Home Contact content blocks.
 * Keys are stored in CMS config; renderer maps key -> inline SVG.
 * SVG markup mirrors the original HomeContactSection icons (15x15, stroke 1.8)
 * so enabling CMS-driven icons does not change the public visual.
 */

export const DEFAULT_CONTACT_ICON = "diamond";

/** Legacy positional icons — preserves current public order for un-migrated data. */
export const LEGACY_CONTACT_ICON_KEYS = ["whatsapp", "phone", "mail", "clock"] as const;

export type ContactIconOption = {
  key: string;
  label: string;
};

export const CONTACT_ICON_OPTIONS: ContactIconOption[] = [
  { key: "diamond", label: "ماسة (افتراضي)" },
  { key: "whatsapp", label: "واتساب" },
  { key: "phone", label: "هاتف / الخط الساخن" },
  { key: "mail", label: "بريد إلكتروني" },
  { key: "clock", label: "ساعات العمل" },
  { key: "location", label: "الموقع" },
];

const ICON_SVGS: Record<string, ReactNode> = {
  whatsapp: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  phone: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 16.92-.04 3.03a2 2 0 0 1-2.19 1.98 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12 19.79 19.79 0 0 1 1.1 3.38a2 2 0 0 1 1.97-2.18l3.04-.04a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.14 8.74a16 16 0 0 0 6.12 6.12l1.13-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
    </svg>
  ),
  mail: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  clock: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  location: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  diamond: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 22 12 12 22 2 12z" />
    </svg>
  ),
};

export function isContactIconKey(value: unknown): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ICON_SVGS, value);
}

/**
 * Resolves a contact icon key.
 * Priority: explicit key -> legacy positional default (preserves current order) -> diamond.
 */
export function resolveContactIconKey(explicit?: string | null, index?: number): string {
  const trimmed = explicit?.trim();
  if (trimmed && isContactIconKey(trimmed)) return trimmed;
  if (typeof index === "number" && LEGACY_CONTACT_ICON_KEYS[index]) {
    return LEGACY_CONTACT_ICON_KEYS[index];
  }
  return DEFAULT_CONTACT_ICON;
}

export function renderContactIcon(key?: string | null, index?: number): ReactNode {
  const resolved = resolveContactIconKey(key, index);
  return ICON_SVGS[resolved] ?? ICON_SVGS[DEFAULT_CONTACT_ICON];
}
