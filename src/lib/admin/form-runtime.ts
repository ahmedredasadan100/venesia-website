export type AdminFormActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  title?: string;
  code?: string;
  entityId?: number;
  fieldErrors?: Record<string, string[]>;
};

export const ADMIN_FORM_INITIAL_STATE: AdminFormActionState = {
  status: "idle",
};

export type AdminFormAction = (
  previousState: AdminFormActionState,
  formData: FormData,
) => AdminFormActionState | Promise<AdminFormActionState>;
