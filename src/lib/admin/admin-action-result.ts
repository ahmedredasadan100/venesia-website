export type AdminActionResultCode =
  | "created"
  | "deleted"
  | "featured"
  | "publish_validation"
  | "published"
  | "permanently_deleted"
  | "restored"
  | "saved"
  | "saved_with_media_sync_warning"
  | "unfeatured"
  | "unpublished"
  | "slug_conflict";

export type AdminActionResult = {
  ok: boolean;
  feedbackStatus?: "success" | "warning" | "error";
  title: string;
  message: string;
  code?: AdminActionResultCode;
  entityId?: number;
  focusTarget?: string;
};

export function adminActionFailure(
  title: string,
  message: string,
  options: Pick<AdminActionResult, "code" | "entityId" | "focusTarget"> = {},
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
  options: Pick<AdminActionResult, "code" | "entityId"> = {},
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
  options: Pick<AdminActionResult, "code" | "entityId"> = {},
): AdminActionResult {
  return {
    ok: true,
    feedbackStatus: "warning",
    title,
    message,
    ...options,
  };
}
