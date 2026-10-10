"use server";

import { adminActionSuccess } from "../../../../../lib/admin/admin-action-result";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath, revalidateCommittedPageBlockAction } from "../../../../../lib/page-blocks/admin-revalidate";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { mutatePageComposition } from "./helpers";

export type PageDuplicateResult =
  | { ok: true; message: string; pageId: number; feedbackStatus?: "success" | "warning" }
  | { ok: false; code: string; message: string };

export async function duplicatePageAjax(pageId: number): Promise<PageDuplicateResult> {
  const actor = await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return { ok: false, code: "invalid_page", message: "الصفحة غير موجودة." };
  }
  const { data: source, error: sourceError } = await getSupabaseAdmin().from("pages")
    .select("og_image, updated_at").eq("id", pageId).single();
  if (sourceError || !source) return { ok: false, code: "page_duplicate_failed", message: "تعذر قراءة الصفحة قبل نسخها." };
  let copiedPageId: number;
  let mediaWarning = false;
  try {
    const provisionalIdentity = "duplicate:" + pageId + ":" + crypto.randomUUID();
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "pages", leaseEntityIdentity: provisionalIdentity, intendedRow: source,
      actorId: actor.id, requestIdentity: "page:" + provisionalIdentity,
      mutate: () => mutatePageComposition(pageId, "duplicate_page", { expected_media: source }, actor),
      resolveEntityIdentity: (value) => String(value.page_id),
    });
    copiedPageId = Number(coordinated.value.page_id);
    mediaWarning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";
  } catch (error) {
    return { ok: false, code: "page_duplicate_failed", message: error instanceof Error ? error.message : "تعذر نسخ الصفحة." };
  }
  const settled = await revalidateCommittedPageBlockAction(
    adminActionSuccess("تم نسخ الصفحة", "تم نسخ الصفحة وموديولاتها ذريًا.", { entityId: copiedPageId, completion: "committed", code: "created" }),
    () => revalidatePageBlocksPath(copiedPageId),
  );
  return { ok: true, pageId: copiedPageId, message: settled.message + (mediaWarning ? " تعذر تأكيد مزامنة مراجع الوسائط؛ راجع مكتبة الوسائط." : ""), feedbackStatus: mediaWarning || settled.feedbackStatus === "warning" ? "warning" : "success" };
}
