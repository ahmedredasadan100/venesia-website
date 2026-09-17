import { resolveSafeInternalPath } from "../security/safe-internal-path.ts";

export type AdminFormMode = "create" | "edit";

/** A caller owns its exact list route; only that route's query may be restored. */
export function resolveAdminFormReturnPath(
  value: string | string[] | null | undefined,
  listPath: string,
): string {
  if (typeof value !== "string") return listPath;
  const safePath = resolveSafeInternalPath(value, "");
  if (!safePath || safePath.split("?", 1)[0] !== listPath) return listPath;
  return safePath;
}

/** Carry an existing list query through edit/open and the Form owner's Close. */
export function adminFormEditHref(
  editPath: string,
  returnTo: string | undefined,
  listPath: string,
): string {
  const safeEditPath = resolveSafeInternalPath(editPath, "");
  if (!safeEditPath) return "";
  const returnPath = resolveAdminFormReturnPath(returnTo, listPath);
  if (returnPath === listPath) return safeEditPath;
  const destination = new URL(safeEditPath, "http://internal.invalid");
  destination.searchParams.set("return_to", returnPath);
  return `${destination.pathname}${destination.search}`;
}

/** Incoming reads may replace a draft only outside a save and before local edits. */
export function shouldAcceptAdminFormSource(input: { pending: boolean; dirty: boolean }) {
  return !input.pending && !input.dirty;
}

export type AdminFormActionState<TResult = unknown> = {
  status: "idle" | "error" | "warning" | "success";
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

/** Only an action-confirmed save may be downgraded to a cache warning. */
export function withAdminFormCacheWarning<TResult>(
  state: AdminFormActionState<TResult>,
): AdminFormActionState<TResult> {
  if (state.status !== "success" && state.status !== "warning") return state;
  const warning = "تم الحفظ، لكن تعذر تحديث كاش القوائم. حدّث القائمة للتحقق من أحدث البيانات؛ لا يلزم تكرار الحفظ.";
  return {
    ...state,
    status: "warning",
    title: "تم الحفظ مع تنبيه",
    message: state.message ? `${state.message} ${warning}` : warning,
  };
}

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
