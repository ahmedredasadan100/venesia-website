import type { PageBlockStatus, PageBlockType } from "./types";
import { getContentStatusMetadata } from "../admin/content/content-status-metadata";

export const BLOCK_STATUSES: PageBlockStatus[] = ["draft", "published", "unpublished", "archived"];

export function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads checkbox / boolean fields from FormData (hidden "true"/"false" or checkbox "on"). */
export function parseFormBoolean(formData: FormData, key: string, defaultWhenAbsent = false) {
  if (!formData.has(key)) return defaultWhenAbsent;
  const value = String(formData.get(key)).trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off" || value === "no" || value === "f") {
    return false;
  }
  return value === "on" || value === "true" || value === "1" || value === "yes" || value === "t";
}

/** Normalizes DB / API boolean values for UI and filters. */
export function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "f" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

export function getStatus(value: string): PageBlockStatus {
  return BLOCK_STATUSES.includes(value as PageBlockStatus) ? (value as PageBlockStatus) : "draft";
}

export function statusMeta(status?: string | null) {
  return getContentStatusMetadata(status);
}

export function fieldClassName(extra = "") {
  return [
    "w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45",
    extra,
  ].join(" ");
}

export function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function blockModuleHref(blockType: PageBlockType, templateId: number) {
  return `/admin/pages-blocks/blocks/${blockType}/${templateId}`;
}

export function blockModuleListHref(blockType: PageBlockType) {
  return `/admin/pages-blocks/blocks/${blockType}`;
}

export function heroModuleHref(templateId: number) {
  return `/admin/pages-blocks/blocks/hero/${templateId}`;
}

export function heroModuleListHref() {
  return "/admin/pages-blocks/blocks/hero";
}

export function moduleKindLabel(kind: string) {
  if (kind === "hero") return "Hero";
  if (kind === "breadcrumb") return "Breadcrumb";
  if (kind === "content") return "Content";
  if (kind === "cta") return "CTA";
  if (kind === "cards") return "Cards";
  if (kind === "feed") return "Feed";
  if (kind === "media-sidebar") return "Media Sidebar";
  if (kind === "media-hub") return "Media Hub";
  return kind;
}

export function mediaHubModuleHref(templateId: number) {
  return `/admin/pages-blocks/blocks/media-hub/${templateId}`;
}

export function mediaHubModuleListHref() {
  return "/admin/pages-blocks/blocks/media-hub";
}

export function mediaSidebarModuleHref(templateId: number) {
  return `/admin/pages-blocks/blocks/media-sidebar/${templateId}`;
}

export function mediaSidebarModuleListHref() {
  return "/admin/pages-blocks/blocks/media-sidebar";
}

export function moduleEditHref(kind: string, templateId: number) {
  if (kind === "hero") return heroModuleHref(templateId);
  if (kind === "media-sidebar") return mediaSidebarModuleHref(templateId);
  if (kind === "media-hub") return mediaHubModuleHref(templateId);
  return blockModuleHref(kind as PageBlockType, templateId);
}

export function moduleListHref(kind: string) {
  if (kind === "hero") return heroModuleListHref();
  if (kind === "media-sidebar") return mediaSidebarModuleListHref();
  if (kind === "media-hub") return mediaHubModuleListHref();
  return blockModuleListHref(kind as PageBlockType);
}
