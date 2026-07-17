export type AdminActionResultCode =
  | "created"
  | "deleted"
  | "featured"
  | "publish_validation"
  | "published"
  | "saved"
  | "unfeatured"
  | "unpublished";

export type AdminActionResult = {
  ok: boolean;
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
    title,
    message,
    ...options,
  };
}
