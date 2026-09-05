export type AdminActionResultCode =
  | "batch_limit"
  | "committed_cache_revalidation_pending"
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
  | "restored"
  | "saved"
  | "saved_with_media_sync_warning"
  | "unfeatured"
  | "unauthorized_actor"
  | "unpublished"
  | "slug_conflict";

export type AdminActionResult = {
  ok: boolean;
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
    "code" | "correlationId" | "entityId" | "focusTarget"
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
    "code" | "correlationId" | "entityId"
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
    "code" | "correlationId" | "entityId"
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
