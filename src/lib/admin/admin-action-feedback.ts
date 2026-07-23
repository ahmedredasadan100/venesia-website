import type { AdminActionResult } from "./admin-action-result";

export type AdminFeedbackVariant = "success" | "warning" | "danger" | "info";
export type AdminFeedbackLayout = "stacked" | "inline";
export type AdminActionFeedbackKind =
  | "transient_action"
  | "action_validation"
  | "critical_system";
export type AdminFeedbackLifecycle = "manual" | "persistent";

export type AdminActionFeedbackAction = {
  href: string;
  label: string;
};

export type AdminActionFeedback = {
  variant: AdminFeedbackVariant;
  title: string;
  message: string;
  layout: AdminFeedbackLayout;
  dismissible: boolean;
  lifecycle: AdminFeedbackLifecycle;
  /** URL params to remove client-side when a redirect notice is dismissed. */
  dismissSearchParams?: readonly string[];
  action?: AdminActionFeedbackAction;
};

const feedbackKindDefaults: Record<
  AdminActionFeedbackKind,
  Pick<
    AdminActionFeedback,
    "layout" | "dismissible" | "lifecycle"
  >
> = {
  transient_action: {
    layout: "inline",
    dismissible: true,
    lifecycle: "manual",
  },
  action_validation: {
    layout: "inline",
    dismissible: true,
    lifecycle: "manual",
  },
  critical_system: {
    layout: "stacked",
    dismissible: true,
    lifecycle: "persistent",
  },
};

export function getAdminFeedbackPolicy(kind: AdminActionFeedbackKind) {
  return feedbackKindDefaults[kind];
}

export function mapAdminActionResultToFeedback(
  result: Pick<AdminActionResult, "ok" | "title" | "message">,
  options: {
    kind?: AdminActionFeedbackKind;
    variant?: AdminFeedbackVariant;
    action?: AdminActionFeedbackAction;
  } = {},
): AdminActionFeedback {
  const kind = options.kind ?? (result.ok ? "transient_action" : "action_validation");
  return {
    variant: options.variant ?? (result.ok ? "success" : "danger"),
    title: result.title,
    message: result.message,
    ...feedbackKindDefaults[kind],
    ...(options.action ? { action: options.action } : {}),
  };
}
