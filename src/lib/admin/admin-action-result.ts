export type AdminActionResultCode =
  | "batch_limit"
  | "command_conflict"
  | "completion_unknown"
  | "committed_cache_revalidation_pending"
  | "committed_reconciliation_pending"
  | "created"
  | "database_failure"
  | "deleted_topics"
  | "deleted"
  | "duplicate_ids"
  | "featured"
  | "invalid_input"
  | "missing_topics"
  | "publish_validation"
  | "published"
  | "permanently_deleted"
  | "revision_conflict"
  | "resource_in_use"
  | "restored"
  | "saved"
  | "saved_with_media_sync_warning"
  | "unfeatured"
  | "unauthorized_actor"
  | "unpublished"
  | "slug_conflict";

export type AdminActionResult = {
  ok: boolean;
  commandId?: string;
  completion?: "not_committed" | "committed" | "unknown";
  feedbackStatus?: "success" | "warning" | "error";
  title: string;
  message: string;
  code?: AdminActionResultCode;
  correlationId?: string;
  entityId?: number;
  focusTarget?: string;
};

export function adminActionFailure(
  title: string,
  message: string,
  options: Pick<
    AdminActionResult,
    "code" | "correlationId" | "entityId" | "focusTarget" | "commandId" | "completion"
  > = {},
): AdminActionResult {
  return {
    ok: false,
    feedbackStatus: "error",
    title,
    message,
    ...options,
  };
}

export function adminActionSuccess(
  title: string,
  message: string,
  options: Pick<
    AdminActionResult,
    "code" | "correlationId" | "entityId" | "commandId" | "completion"
  > = {},
): AdminActionResult {
  return {
    ok: true,
    feedbackStatus: "success",
    title,
    message,
    ...options,
  };
}

export function adminActionWarning(
  title: string,
  message: string,
  options: Pick<
    AdminActionResult,
    "code" | "correlationId" | "entityId" | "commandId" | "completion"
  > = {},
): AdminActionResult {
  return {
    ok: true,
    feedbackStatus: "warning",
    title,
    message,
    ...options,
  };
}

/** Cache delivery can warn about a confirmed command, never establish success. */
export function withAdminActionCacheWarning<T extends AdminActionResult>(
  result: T,
  cacheRevalidated: boolean,
): T {
  if (!result.ok || cacheRevalidated) return result;
  return {
    ...result,
    feedbackStatus: "warning",
    title: result.feedbackStatus === "warning" ? result.title : "تم الحفظ مع تنبيه لتحديث العرض",
    message: `${result.message} تم حفظ العملية، لكن تعذر تحديث بعض القراءات المخبأة بعد المحاولة الآمنة المحدودة. حدّث القائمة للتحقق؛ لا تكرر العملية بسبب هذا التنبيه.`,
    code: result.feedbackStatus === "warning"
      ? result.code
      : "committed_cache_revalidation_pending",
  };
}

/** Preserve a confirmed domain result while carrying the Data owner's final read state. */
export function withAdminActionSettledResult(
  result: AdminActionResult,
  settled: { message: string; feedbackStatus?: "success" | "warning"; commandId?: string; completion?: "committed" },
): AdminActionResult {
  if (!result.ok) return result;
  const confirmed = { ...result,
    ...(settled.commandId ? { commandId: settled.commandId } : {}),
    ...(settled.completion ? { completion: settled.completion } : {}),
  };
  if (settled.feedbackStatus !== "warning") return confirmed;
  return {
    ...confirmed,
    feedbackStatus: "warning",
    title: result.feedbackStatus === "warning"
      ? result.title
      : "تم الحفظ مع تنبيه للعرض",
    message: settled.message,
    code: result.feedbackStatus === "warning"
      ? result.code
      : "committed_reconciliation_pending",
  };
}
