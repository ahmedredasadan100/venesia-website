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
  createAdminFormInitialState,
  type AdminFormAction,
  type AdminFormActionState,
  type AdminFormMode,
  type AdminFormNavigationContract,
} from "../../../lib/admin/form-runtime";
import { resolveSafeInternalPath } from "../../../lib/security/safe-internal-path";
import { useAdminFeedback } from "../AdminFeedbackProvider";
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
  onNavigate?: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

export type AdminUnsavedChangesGuard = {
  isDirty: boolean;
  markClean: (submittedBaseline?: string) => void;
  requestNavigation: (href: string) => void;
  dialog: ReactNode;
};

export function useAdminUnsavedChangesGuard<T extends HTMLElement>({
  rootRef,
  pending = false,
  resetKey,
  onNavigate,
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

  const markClean = useCallback((submittedBaseline?: string) => {
    const form = readForm();
    if (submittedBaseline !== undefined) {
      baselineRef.current = submittedBaseline;
    } else if (form) {
      baselineRef.current = serializeForm(form);
    }
    allowNavigationRef.current = false;
    updateDirty(form ? serializeForm(form) !== baselineRef.current : false);
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
      onNavigate?.();
      navigate(href);
    },
    [navigate, onNavigate, updateDirty],
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
    const frame = window.requestAnimationFrame(() => setIsDirty(false));
    return () => window.cancelAnimationFrame(frame);
  }, [readForm, resetKey, updateDirty]);

  useEffect(() => {
    const currentForm = readForm();
    if (!currentForm) return;
    const form: HTMLFormElement = currentForm;

    function handleFormChange() {
      updateDirty(serializeForm(form) !== baselineRef.current);
    }

    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    return () => {
      form.removeEventListener("input", handleFormChange);
      form.removeEventListener("change", handleFormChange);
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
      if (
        (!dirtyRef.current && !pendingRef.current) ||
        allowNavigationRef.current
      ) return;
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
      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }
      if (!dirtyRef.current || allowNavigationRef.current) {
        onNavigate?.();
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
  }, [onNavigate]);

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
  mode: AdminFormMode;
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

export function useOptionalAdminFormRuntime() {
  return useContext(AdminFormRuntimeContext);
}

export type AdminFormRuntimeProps = {
  action: AdminFormAction;
  initialState?: AdminFormActionState;
  mode: AdminFormMode;
  entityKey: string;
  closeHref: string;
  navigation?: AdminFormNavigationContract;
  formId?: string;
  className?: string;
  children:
    | ReactNode
    | ((context: AdminFormRuntimeContextValue) => ReactNode);
};

function firstFieldError(state: AdminFormActionState) {
  return Object.entries(state.fieldErrors ?? {}).find(
    ([, messages]) => messages.length > 0,
  )?.[0];
}

function focusTarget(targetIdOrName: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const escapedName = CSS.escape(targetIdOrName);
      const target =
        document.getElementById(targetIdOrName) ??
        document.querySelector<HTMLElement>(`[name="${escapedName}"]`);
      if (!target) return;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      const focusable = target.matches(
        "input, textarea, select, button, [tabindex]",
      )
        ? target
        : target.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
      focusable?.focus({ preventScroll: true });
    });
  });
}

function revealFormError(
  state: AdminFormActionState,
  navigation?: AdminFormNavigationContract,
) {
  const fieldName = state.focusTarget ?? firstFieldError(state);
  if (!fieldName) return;
  const target = navigation?.fields[fieldName];
  const targetId = target?.targetId ?? fieldName;
  const tabId = state.tabTarget ?? target?.tabId;

  if (tabId && navigation?.eventName) {
    window.dispatchEvent(
      new CustomEvent(navigation.eventName, {
        detail: { tabId, targetId },
      }),
    );
    return;
  }
  focusTarget(targetId);
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
  initialState,
  mode,
  entityKey,
  closeHref,
  navigation,
  formId,
  className = "",
  children,
}: AdminFormRuntimeProps) {
  const router = useRouter();
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const feedbackChannel = `form:${entityKey}`;
  const clearFormFeedback = useCallback(
    () => clearFeedback(feedbackChannel),
    [clearFeedback, feedbackChannel],
  );
  const [resolvedInitialState] = useState(
    () => initialState ?? createAdminFormInitialState(mode),
  );
  const [state, formAction, actionPending] = useActionState(
    action,
    resolvedInitialState,
  );
  const handoffPending =
    state.status === "success" &&
    state.mode === "create" &&
    Boolean(state.editHref);
  const pending = actionPending || handoffPending;
  const formRef = useRef<HTMLFormElement>(null);
  const submittedBaselineRef = useRef<string | null>(null);
  const handledResultRef = useRef<AdminFormActionState>(
    createAdminFormInitialState(mode),
  );
  const { isDirty, markClean, requestNavigation, dialog } =
    useAdminUnsavedChangesGuard({
      rootRef: formRef,
      pending,
      resetKey: state.status === "success" ? state.savedRevision : undefined,
      onNavigate: clearFormFeedback,
    });
  const requestClose = useCallback(
    () => requestNavigation(closeHref),
    [closeHref, requestNavigation],
  );

  useEffect(() => {
    if (state.status === "idle" || handledResultRef.current === state) return;
    handledResultRef.current = state;
    clearFeedback(feedbackChannel);

    const nextFeedback = formFeedback(state);
    if (nextFeedback) {
      publishFeedback(nextFeedback, {
        channel: feedbackChannel,
        critical: false,
      });
    }
    if (state.status === "error") {
      revealFormError(state, navigation);
      return;
    }

    formRef.current?.dispatchEvent(
      new CustomEvent("admin-form-saved", {
        detail: { entityId: state.entityId, savedRevision: state.savedRevision },
      }),
    );

    if (state.mode === "create" && state.editHref) {
      const editHref = resolveSafeInternalPath(state.editHref, "");
      if (!editHref) {
        publishFeedback(
          {
            variant: "danger",
            title: "تعذر الانتقال إلى وضع التعديل",
            message: "تم رفض رابط تعديل غير آمن. حدّث الصفحة قبل الحفظ مرة أخرى.",
            layout: "inline",
            dismissible: true,
            lifecycle: "manual",
          },
          { channel: feedbackChannel, critical: true },
        );
        return;
      }
      const submittedBaseline = submittedBaselineRef.current ?? undefined;
      submittedBaselineRef.current = null;
      markClean(submittedBaseline);
      router.replace(editHref, { scroll: false });
      return;
    }
    const submittedBaseline = submittedBaselineRef.current ?? undefined;
    submittedBaselineRef.current = null;
    markClean(submittedBaseline);
  }, [
    clearFeedback,
    feedbackChannel,
    markClean,
    navigation,
    publishFeedback,
    router,
    state,
  ]);

  const context = useMemo<AdminFormRuntimeContextValue>(
    () => ({
      state,
      mode,
      pending,
      fieldErrors: state.fieldErrors ?? {},
      isDirty,
      requestClose,
    }),
    [isDirty, mode, pending, requestClose, state],
  );

  return (
    <AdminFormRuntimeContext.Provider value={context}>
      <form
        ref={formRef}
        id={formId}
        action={formAction}
        onSubmitCapture={() => {
          submittedBaselineRef.current = formRef.current
            ? serializeForm(formRef.current)
            : null;
          clearFeedback(feedbackChannel);
        }}
        noValidate
        aria-busy={pending || undefined}
        data-admin-form-runtime=""
        data-admin-form-entity={entityKey}
        data-admin-form-mode={mode}
        data-admin-form-dirty={isDirty ? "true" : "false"}
        className={className}
      >
        <fieldset
          disabled={pending}
          data-admin-form-fields=""
          className="contents"
        >
          {typeof children === "function" ? children(context) : children}
        </fieldset>
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
  const context = useOptionalAdminFormRuntime();
  if (!context) return null;
  const { state, fieldErrors } = context;
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
  submitLabel = "حفظ",
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
        data-admin-form-action="save"
        className={`${actionButtonClassName} flex-1 bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d] sm:flex-none`}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={requestClose}
        data-admin-form-action="close"
        className={`${actionButtonClassName} flex-1 border border-white/15 text-white/65 hover:border-white/30 hover:text-white sm:flex-none`}
      >
        {closeLabel}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? pendingLabel : ""}
      </span>
    </AdminStickyFormBar>
  );
}
