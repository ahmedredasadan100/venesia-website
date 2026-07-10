import { generatePageSlugFromPath, normalizePagePathInput } from "./normalize-page-path";
import { getReservedPublicPathReason } from "./reserved-public-paths";
import { validateSlugFormat } from "../admin/slug";

export const DUPLICATE_PAGE_PATH_MESSAGE = "يوجد بالفعل صفحة تستخدم هذا المسار.";
export const DUPLICATE_PAGE_SLUG_MESSAGE = "تعذر إنشاء الصفحة لأن المفتاح الداخلي مستخدم بالفعل.";

export type ValidateNewPagePathSuccess = {
  ok: true;
  path: string;
  slug: string;
};

export type ValidateNewPagePathFailure = {
  ok: false;
  error: string;
};

export type ValidateNewPagePathResult = ValidateNewPagePathSuccess | ValidateNewPagePathFailure;

/**
 * Full client/server validation for a new CMS page public path (no DB uniqueness).
 */
export function validateNewPagePath(rawPath: string): ValidateNewPagePathResult {
  const normalized = normalizePagePathInput(rawPath);
  if (!normalized.ok) {
    return normalized;
  }

  const reservedReason = getReservedPublicPathReason(normalized.path);
  if (reservedReason) {
    return { ok: false, error: reservedReason };
  }

  const slug = generatePageSlugFromPath(normalized.path);
  const slugError = validateSlugFormat(slug);
  if (slugError) {
    return { ok: false, error: "تعذر اشتقاق معرّف داخلي صالح من المسار. جرّب مسارًا أبسط." };
  }

  return { ok: true, path: normalized.path, slug };
}
