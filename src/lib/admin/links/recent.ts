"use client";

import type { AdminLinkValue } from "./types";
import { deserializeAdminLink } from "./serialize";

const RECENT_STORAGE_KEY = "venesia-admin-recent-links";
const MAX_RECENT = 8;

function readRecentRaw(): AdminLinkValue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => deserializeAdminLink(item)).filter((item) => item.link_kind !== "none");
  } catch {
    return [];
  }
}

function linkFingerprint(value: AdminLinkValue) {
  return [
    value.link_kind,
    value.linked_type ?? "",
    value.linked_id ?? "",
    value.href ?? "",
    value.meta?.route_key ?? "",
    value.anchor ?? "",
  ].join("|");
}

export function readRecentAdminLinks(): AdminLinkValue[] {
  return readRecentRaw();
}

export function pushRecentAdminLink(value: AdminLinkValue) {
  if (typeof window === "undefined" || value.link_kind === "none") return;
  const fingerprint = linkFingerprint(value);
  const next = [value, ...readRecentRaw().filter((item) => linkFingerprint(item) !== fingerprint)].slice(
    0,
    MAX_RECENT,
  );
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
}

export const FAVORITE_LINKS_STORAGE_KEY = "venesia-admin-favorite-links";

export function readFavoriteAdminLinks(): AdminLinkValue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_LINKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => deserializeAdminLink(item)).filter((item) => item.link_kind !== "none");
  } catch {
    return [];
  }
}
