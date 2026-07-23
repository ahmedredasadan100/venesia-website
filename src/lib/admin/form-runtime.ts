export type AdminFormMode = "create" | "edit";

export type AdminFormActionState = {
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
};

export type AdminFormFieldTarget = {
  tabId?: string;
  targetId: string;
};

export type AdminFormNavigationContract = {
  eventName?: string;
  fields: Record<string, AdminFormFieldTarget>;
};

export const ADMIN_FORM_INITIAL_STATE: AdminFormActionState = {
  status: "idle",
  mode: "create",
  revision: 0,
};

export function createAdminFormInitialState(
  mode: AdminFormMode,
): AdminFormActionState {
  return { status: "idle", mode, revision: 0 };
}

export type AdminFormAction = (
  previousState: AdminFormActionState,
  formData: FormData,
) => AdminFormActionState | Promise<AdminFormActionState>;
