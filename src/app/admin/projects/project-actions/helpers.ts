import { redirect } from "next/navigation";
import type { ProjectCategory } from "../../../../config/projects-data";
import { normalizeSlugInput, slugifyFromTitle } from "../../../../lib/admin/slug";
import { parseJsonArray } from "../../../../lib/projects/types";
import type { ProjectStatus } from "../../../../lib/projects/types";
import type { PublicationStatus } from "./types";
import { VALID_PUBLICATION_STATUSES } from "./types";

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getAllStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export function getNumber(formData: FormData, key: string, fallback = 0) {
  const parsed = Number.parseInt(getString(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPublicationStatus(value: string): PublicationStatus {
  return VALID_PUBLICATION_STATUSES.includes(value as PublicationStatus)
    ? (value as PublicationStatus)
    : "published";
}

export function getProjectStatus(formData: FormData, current: ProjectStatus): ProjectStatus {
  const value = getString(formData, "status");
  const allowed: ProjectStatus[] = ["under-construction", "excavation", "near-delivery", "delivered"];
  return allowed.includes(value as ProjectStatus) ? (value as ProjectStatus) : current;
}

export function getProjectProgress(formData: FormData, current: number) {
  const parsed = Number.parseInt(getString(formData, "progress"), 10);
  if (!Number.isFinite(parsed)) return current;
  return Math.min(100, Math.max(0, parsed));
}

export function validateId(id: string) {
  return /^\d+$/.test(id);
}

export function listPath(type: ProjectCategory) {
  return type === "residential" ? "/admin/projects/residential" : "/admin/projects/commercial";
}

export function redirectWithError(type: ProjectCategory, message: string): never {
  redirect(`${listPath(type)}?error=${encodeURIComponent(message)}`);
}

export function redirectEditWithNotice(id: number, notice: string): never {
  redirect(`/admin/projects/${id}?notice=${notice}`);
}

export function redirectEditWithError(id: number, message: string): never {
  redirect(`/admin/projects/${id}?error=${encodeURIComponent(message)}`);
}

export function preserveImage(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

function isEmptyRichText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed === "<p></p>" || trimmed === '<p><br class="ProseMirror-trailingBreak"></p>' || trimmed === "<p><br></p>";
}

export function preserveRichText(nextValue: string, currentValue: string) {
  if (isEmptyRichText(nextValue) && currentValue.trim()) return currentValue;
  return nextValue.trim() ? nextValue : currentValue;
}

export function resolveSlug(formData: FormData, code: string, currentSlug: string) {
  const slug = getString(formData, "slug");
  if (slug) return slug;
  if (currentSlug) return currentSlug;
  return code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createProjectSlug(value: string) {
  const normalized = normalizeSlugInput(value);
  if (normalized) return normalized;
  return slugifyFromTitle(value);
}

export function parseQuickFacts(formData: FormData, current: unknown) {
  if (!formData.has("quick_fact_label")) {
    return parseJsonArray<{ label: string; value: string }>(current);
  }

  const labels = formData.getAll("quick_fact_label").map(String);
  const values = formData.getAll("quick_fact_value").map(String);

  return labels
    .map((label, index) => ({
      label: label.trim(),
      value: (values[index] ?? "").trim(),
    }))
    .filter((item) => item.label || item.value);
}

export function preserveBrochureUrl(formData: FormData, current: unknown) {
  if (!formData.has("brochure_url")) {
    return current ? String(current) : null;
  }

  return getString(formData, "brochure_url") || null;
}

export function preserveCategoryLabel(formData: FormData, current: unknown) {
  const nextValue = getString(formData, "category_label");
  if (nextValue) return nextValue;
  return String(current ?? "");
}
