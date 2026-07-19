import {
  getAdminFeedbackPolicy,
  type AdminActionFeedback,
  type AdminActionFeedbackKind,
} from "../admin-action-feedback";
import type { AdminEntityNoticeCodeMap } from "./types";

/**
 * Shared URL/redirect notice → AdminActionFeedback routing.
 * Entity pages supply only a code map; presentation rules stay here.
 */
export function resolveAdminNoticeFeedback(
  codeMap: AdminEntityNoticeCodeMap,
  notice?: string | null,
  message?: string | null,
): AdminActionFeedback | null {
  const entry = notice ? codeMap[notice] : undefined;
  const kind: AdminActionFeedbackKind =
    entry?.kind ??
    (notice === "error" ? "action_validation" : "transient_action");
  const policy = getAdminFeedbackPolicy(kind);
  const dismissSearchParams = policy.dismissible
    ? ["notice", "message", "error"]
    : undefined;

  if (message) {
    return {
      variant: entry?.variant ?? (notice === "error" ? "danger" : "success"),
      title: entry?.title ?? "",
      message,
      ...policy,
      dismissSearchParams,
    };
  }

  if (!notice) return null;
  if (!entry) return null;

  return {
    variant: entry.variant ?? (notice === "error" ? "danger" : "success"),
    title: entry.title ?? "",
    message: entry.message,
    ...policy,
    dismissSearchParams,
  };
}
