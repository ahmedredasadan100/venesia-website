import type { AdminActionFeedback } from "../admin-action-feedback";
import { mapAdminActionResultToFeedback } from "../admin-action-feedback";
import type { AdminActionResult } from "../admin-action-result";
import { adminContentTopicPath } from "../content-routes";

export function mapTopicsActionResultToFeedback(
  result: AdminActionResult,
  context: { currentListPath: string },
): AdminActionFeedback {
  const isPublishValidation = result.code === "publish_validation";
  const action =
    isPublishValidation && result.entityId
      ? {
          label: "استكمال البيانات",
          href: adminContentTopicPath(result.entityId, {
            returnTo: context.currentListPath,
            focusTarget: result.focusTarget,
          }),
        }
      : undefined;

  return mapAdminActionResultToFeedback(result, {
    kind: isPublishValidation ? "action_validation" : undefined,
    action,
  });
}
