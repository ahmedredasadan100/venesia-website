import type { AdminActionFeedback } from "../admin-action-feedback";
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
  if (message) {
    const fromCode = notice ? codeMap[notice] : undefined;
    return {
      variant: fromCode?.variant ?? (notice === "error" ? "danger" : "success"),
      title: fromCode?.title ?? "",
      message,
      layout: "stacked",
      dismissible: false,
    };
  }

  if (!notice) return null;
  const entry = codeMap[notice];
  if (!entry) return null;

  return {
    variant: entry.variant ?? (notice === "error" ? "danger" : "success"),
    title: entry.title ?? "",
    message: entry.message,
    layout: "stacked",
    dismissible: false,
  };
}
