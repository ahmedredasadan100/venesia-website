import type { ProjectCategory } from "../../../../lib/projects/public-types";
import { normalizeSlugInput, slugifyFromTitle } from "../../../../lib/admin/slug";
import type { MediaReferenceSynchronizationResult } from "../../../../lib/admin/media-catalog/synchronization";

export function listPath(type: ProjectCategory) {
  return type === "residential" ? "/admin/projects/residential" : "/admin/projects/commercial";
}

export function withProjectMediaSynchronization<
  TResult extends { ok: true; message: string },
>(
  result: TResult,
  synchronization: MediaReferenceSynchronizationResult,
) {
  if (synchronization.status !== "saved_with_media_sync_warning") {
    return { ...result, feedbackStatus: "success" as const, mediaSynchronization: synchronization };
  }
  return {
    ...result,
    feedbackStatus: "warning" as const,
    code: "saved_with_media_sync_warning" as const,
    message:
      "تم حفظ بيانات المشروع، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.",
    mediaSynchronization: synchronization,
  };
}

export function createProjectSlug(value: string) {
  const normalized = normalizeSlugInput(value);
  if (normalized) return normalized;
  return slugifyFromTitle(value);
}
