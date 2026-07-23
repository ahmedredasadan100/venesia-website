"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import {
  ADMIN_FORM_INITIAL_STATE,
  type AdminFormAction,
  type AdminFormActionState,
} from "../../../lib/admin/form-runtime";
import { useOptionalAdminFeedback } from "../AdminFeedbackProvider";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { AdminStickyFormBar } from "./AdminForm";

const LEAVE_WARNING = "لديك تعديلات غير محفوظة. هل تريد الإغلاق دون حفظها؟";

function serializeForm(form: HTMLFormElement) {
  return JSON.stringify(
    Array.from(new FormData(form).entries()).map(([name, value]) => [
      name,
      typeof value === "string"
        ? value
        : `${value.name}:${value.size}:${value.type}:${value.lastModified}`,
    ]),
  );
}

function resolveForm(root: HTMLElement | null) {
  if (root instanceof HTMLFormElement) return root;
  return root?.closest("form") ?? null;
}

type PendingNavigation = {
  href: string;
};

export type AdminUnsavedChangesGuardOptions<T extends HTMLElement> = {
  rootRef: RefObject<T | null>;
  pending?: boolean;
  resetKey?: unknown;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

export type AdminUnsavedChangesGuard = {
  isDirty: boolean;
  markClean: () => void;
  requestNavigation: (href: string) => void;
  dialog: ReactNode;
};

export function useAdminUnsavedChangesGuard<T extends HTMLElement>({
  rootRef,
  pending = false,
  resetKey,
  title = "إغلاق دون حفظ؟",
  description = LEAVE_WARNING,
  confirmLabel = "إغلاق دون حفظ",
}: AdminUnsavedChangesGuardOptions<T>): AdminUnsavedChangesGuard {
  const router = useRouter();
  const baselineRef = useRef("");
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const pendingRef = useRef(pending);
  const wasPendingRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);

  const updateDirty = useCallback((nextDirty: boolean) => {
    dirtyRef.current = nextDirty;
    setIsDirty(nextDirty);
  }, []);

  const readForm = useCallback(
    () => resolveForm(rootRef.current),
    [rootRef],
  );

  const markClean = useCallback(() => {
    const form = readForm();
    if (form) baselineRef.current = serializeForm(form);
    updateDirty(false);
  }, [readForm, updateDirty]);

  const navigate = useCallback(
    (href: string) => {
      const destination = new URL(href, window.location.href);
      if (destination.origin === window.location.origin) {
        router.push(
          `${destination.pathname}${destination.search}${destination.hash}`,
        );
        return;
      }
      window.location.assign(destination.href);
    },
    [router],
  );

  const leave = useCallback(
    (href: string) => {
      allowNavigationRef.current = true;
      updateDirty(false);
      setPendingNavigation(null);
      navigate(href);
    },
    [navigate, updateDirty],
  );

  const requestNavigation = useCallback(
    (href: string) => {
      if (pendingRef.current) return;
      if (!dirtyRef.current || allowNavigationRef.current) {
        leave(href);
        return;
      }
      setPendingNavigation({ href });
    },
    [leave],
  );

  useLayoutEffect(() => {
    const form = readForm();
    if (form) baselineRef.current = serializeForm(form);
    dirtyRef.current = false;
    allowNavigationRef.current = false;
  }, [readForm, resetKey]);

  useEffect(() => {
    const currentForm = readForm();
    if (!currentForm) return;
    const form: HTMLFormElement = currentForm;

    function handleFormChange() {
      updateDirty(serializeForm(form) !== baselineRef.current);
    }

    function handleSubmit() {
      allowNavigationRef.current = true;
      updateDirty(false);
    }

    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    form.addEventListener("submit", handleSubmit);
    return () => {
      form.removeEventListener("input", handleFormChange);
      form.removeEventListener("change", handleFormChange);
      form.removeEventListener("submit", handleSubmit);
    };
  }, [readForm, updateDirty]);

  useEffect(() => {
    pendingRef.current = pending;
    if (pending) {
      wasPendingRef.current = true;
      return;
    }
    if (!wasPendingRef.current) return;

    wasPendingRef.current = false;
    allowNavigationRef.current = false;
    const form = readForm();
    if (form) updateDirty(serializeForm(form) !== baselineRef.current);
  }, [pending, readForm, updateDirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function handleLinkNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      if (pendingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!dirtyRef.current || allowNavigationRef.current) return;

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ href: destination.href });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkNavigation, true);
    };
  }, []);

  const dialog = pendingNavigation ? (
    <div data-admin-unsaved-dialog="" className="contents">
      <AdminConfirmDialog
        open
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onCancel={() => setPendingNavigation(null)}
        onConfirm={() => leave(pendingNavigation.href)}
      />
    </div>
  ) : null;

  return {
    isDirty,
    markClean,
    requestNavigation,
    dialog,
  };
}

export type AdminFormRuntimeContextValue = {
  state: AdminFormActionState;
  pending: boolean;
  fieldErrors: Record<string, string[]>;
  isDirty: boolean;
  requestClose: () => void;
};

const AdminFormRuntimeContext =
  createContext<AdminFormRuntimeContextValue | null>(null);

export function useAdminFormRuntime() {
  const context = useContext(AdminFormRuntimeContext);
  if (!context) {
    throw new Error("useAdminFormRuntime must be used inside AdminFormRuntime.");
  }
  return context;
}

export type AdminFormRuntimeProps = {
  action: AdminFormAction;
  initialState?: AdminFormActionState;
  entityKey: string;
  closeHref: string;
  noticeCode?: string;
  noticePath?: string;
  formId?: string;
  className?: string;
  children:
    | ReactNode
    | ((context: AdminFormRuntimeContextValue) => ReactNode);
};

function buildNoticeHref(path: string, noticeCode?: string) {
  if (!noticeCode) return path;
  const url = new URL(path, window.location.href);
  url.searchParams.set("notice", noticeCode);
  return url.origin === window.location.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
}

function formFeedback(
  state: AdminFormActionState,
): AdminActionFeedback | null {
  if (state.status === "idle") return null;
  const hasFieldErrors = Object.values(state.fieldErrors ?? {}).some(
    (messages) => messages.length > 0,
  );
  if (state.status === "error" && hasFieldErrors) return null;
  return {
    variant: state.status === "success" ? "success" : "danger",
    title:
      state.title ??
      (state.status === "success" ? "تم الحفظ" : "تعذر حفظ البيانات"),
    message:
      state.message ??
      (state.status === "success"
        ? "تم حفظ البيانات بنجاح."
        : "راجع البيانات وحاول مرة أخرى."),
    layout: "inline",
    dismissible: true,
    lifecycle: "manual",
  };
}

export default function AdminFormRuntime({
  action,
  initialState = ADMIN_FORM_INITIAL_STATE,
  entityKey,
  closeHref,
  noticeCode,
  noticePath,
  formId,
  className = "",
  children,
}: AdminFormRuntimeProps) {
  const router = useRouter();
  const publishFeedback = useOptionalAdminFeedback()?.publishFeedback;
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { isDirty, requestNavigation, dialog } =
    useAdminUnsavedChangesGuard({ rootRef: formRef, pending });
  const requestClose = useCallback(
    () => requestNavigation(closeHref),
    [closeHref, requestNavigation],
  );

  useEffect(() => {
    const nextFeedback = formFeedback(state);
    if (nextFeedback) {
      publishFeedback?.(nextFeedback, {
        channel: `form:${entityKey}`,
        critical: false,
      });
    }
    if (state.status !== "success") return;

    router.push(
      buildNoticeHref(noticePath ?? closeHref, state.code ?? noticeCode),
    );
  }, [
    closeHref,
    entityKey,
    noticeCode,
    noticePath,
    publishFeedback,
    router,
    state,
  ]);

  const context = useMemo<AdminFormRuntimeContextValue>(
    () => ({
      state,
      pending,
      fieldErrors: state.fieldErrors ?? {},
      isDirty,
      requestClose,
    }),
    [isDirty, pending, requestClose, state],
  );

  return (
    <AdminFormRuntimeContext.Provider value={context}>
      <form
        ref={formRef}
        id={formId}
        action={formAction}
        noValidate
        aria-busy={pending || undefined}
        data-admin-form-runtime=""
        data-admin-form-entity={entityKey}
        data-admin-form-dirty={isDirty ? "true" : "false"}
        className={className}
      >
        {typeof children === "function" ? children(context) : children}
      </form>
      {dialog}
    </AdminFormRuntimeContext.Provider>
  );
}

export function AdminFormGrid({
  children,
  columns = 2,
  className = "",
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const columnsClassName =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={`grid gap-5 ${columnsClassName} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AdminFormError({
  name,
  children,
  className = "",
}: {
  name?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { state, fieldErrors } = useAdminFormRuntime();
  const messages = name ? fieldErrors[name] ?? [] : [];
  const content = children ??
    (messages.length ? messages.join(" ") : name ? null : state.message);
  if (!content || state.status !== "error") return null;

  return (
    <p
      id={name ? `${name}-error` : undefined}
      role="alert"
      className={`text-sm font-semibold leading-6 text-red-300 ${className}`.trim()}
    >
      {content}
    </p>
  );
}

const actionButtonClassName =
  "inline-flex min-h-11 min-w-[8.5rem] items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45";

export function AdminFormActions({
  submitLabel = "حفظ وإغلاق",
  pendingLabel = "جارٍ الحفظ…",
  closeLabel = "إغلاق",
  title = "إجراءات النموذج",
  description = "احفظ التغييرات أو أغلق النموذج.",
  className = "",
}: {
  submitLabel?: string;
  pendingLabel?: string;
  closeLabel?: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const { pending, requestClose } = useAdminFormRuntime();
  return (
    <AdminStickyFormBar
      title={title}
      description={description}
      className={className}
    >
      <button
        type="submit"
        disabled={pending}
        className={`${actionButtonClassName} bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]`}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={requestClose}
        className={`${actionButtonClassName} border border-white/15 text-white/65 hover:border-white/30 hover:text-white`}
      >
        {closeLabel}
      </button>
    </AdminStickyFormBar>
  );
}
