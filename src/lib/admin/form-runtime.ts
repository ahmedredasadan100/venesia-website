export type AdminFormMode = "create" | "edit";

export type AdminFormActionState<TResult = unknown> = {
  status: "idle" | "error" | "success";
  mode: AdminFormMode;
  revision: number;
  message?: string;
  title?: string;
  code?: string;
  entityId?: number;
  editHref?: string;
  savedRevision?: string;
  focusTarget?: string;
  tabTarget?: string;
  fieldErrors?: Record<string, string[]>;
  result?: TResult;
};

export type AdminFormFieldTarget = {
  tabId?: string;
  targetId: string;
};

export type AdminFormNavigationContract = {
  eventName?: string;
  fields: Record<string, AdminFormFieldTarget>;
};

export type AdminFormNavigationDecision =
  | "blocked_pending"
  | "navigate"
  | "confirm_discard";

export function resolveAdminFormNavigationDecision(options: {
  pending: boolean;
  dirty: boolean;
  navigationAllowed?: boolean;
}): AdminFormNavigationDecision {
  if (options.pending) return "blocked_pending";
  if (!options.dirty || options.navigationAllowed) return "navigate";
  return "confirm_discard";
}

export const ADMIN_FORM_INITIAL_STATE: AdminFormActionState = {
  status: "idle",
  mode: "create",
  revision: 0,
};

export function createAdminFormInitialState<TResult = unknown>(
  mode: AdminFormMode,
): AdminFormActionState<TResult> {
  return { status: "idle", mode, revision: 0 };
}

export function createAdminFormErrorState(
  mode: AdminFormMode,
  title: string,
  message: string,
): AdminFormActionState {
  return {
    status: "error",
    mode,
    revision: 0,
    title,
    message,
  };
}

export type AdminFormAction<TResult = unknown> = (
  previousState: AdminFormActionState<TResult>,
  formData: FormData,
) =>
  | AdminFormActionState<TResult>
  | Promise<AdminFormActionState<TResult>>;
