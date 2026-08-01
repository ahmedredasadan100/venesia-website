"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AdminActionFeedback } from "../../lib/admin/admin-action-feedback";
import AdminNotice from "./AdminNotice";

type AdminFeedbackEntry = {
  id: string;
  channel: string;
  critical: boolean;
  placement: "global" | "inline";
  reveal: boolean;
  feedback: AdminActionFeedback;
};

export type AdminFeedbackPublishOptions = {
  channel?: string;
  critical?: boolean;
  placement?: "global" | "inline";
  reveal?: boolean;
};

type AdminFeedbackContextValue = {
  entries: readonly AdminFeedbackEntry[];
  publishFeedback: (
    feedback: AdminActionFeedback,
    options?: AdminFeedbackPublishOptions,
  ) => string;
  dismissFeedback: (id: string) => void;
  clearFeedback: (channel?: string) => void;
};

const AdminFeedbackContext = createContext<AdminFeedbackContextValue | null>(
  null,
);

function feedbackSignature(feedback: AdminActionFeedback) {
  return [
    feedback.variant,
    feedback.title,
    feedback.message,
    feedback.lifecycle,
  ].join("|");
}

export function useAdminFeedback() {
  const context = useContext(AdminFeedbackContext);
  if (!context) {
    throw new Error("useAdminFeedback must be used inside AdminFeedbackProvider.");
  }
  return context;
}

export function useOptionalAdminFeedback() {
  return useContext(AdminFeedbackContext);
}

function AdminFeedbackViewportEntry({
  entry,
  onDismiss,
  placement = "global",
}: {
  entry: AdminFeedbackEntry;
  onDismiss: (id: string) => void;
  placement?: "global" | "inline";
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (placement !== "global" || !entry.critical) return;
    rootRef.current?.focus({ preventScroll: true });
  }, [entry.critical, entry.id, placement]);

  return (
    <div
      ref={rootRef}
      tabIndex={entry.critical ? -1 : undefined}
      data-admin-feedback-entry=""
      data-admin-feedback-channel={entry.channel}
      data-admin-feedback-variant={entry.feedback.variant}
      data-admin-feedback-critical={entry.critical ? "true" : "false"}
      className={
        placement === "global"
          ? "pointer-events-none drop-shadow-[0_20px_45px_rgba(0,0,0,0.45)] focus:outline-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
          : "focus:outline-none"
      }
    >
      <AdminNotice
        {...entry.feedback}
        dismissible
        onDismiss={() => onDismiss(entry.id)}
      />
    </div>
  );
}

export function AdminFeedbackViewport() {
  const { entries, dismissFeedback } = useAdminFeedback();
  const globalEntries = entries.filter(
    (entry) => entry.placement === "global",
  );

  if (!globalEntries.length) return null;

  return (
    <section
      aria-label="إشعارات لوحة الإدارة"
      data-admin-feedback-viewport=""
      className="pointer-events-none fixed inset-x-4 top-4 bottom-auto z-[120] flex max-h-[min(70vh,560px)] flex-col gap-3 overflow-y-auto sm:inset-x-auto sm:top-auto sm:bottom-6 sm:left-6 sm:w-[min(480px,calc(100vw-3rem))]"
    >
      {[...globalEntries].reverse().map((entry) => (
        <AdminFeedbackViewportEntry
          key={entry.id}
          entry={entry}
          onDismiss={dismissFeedback}
        />
      ))}
    </section>
  );
}

export function AdminFeedbackChannelViewport({
  channel,
  label,
}: {
  channel: string;
  label: string;
}) {
  const { entries, dismissFeedback } = useAdminFeedback();
  const rootRef = useRef<HTMLElement>(null);
  const inlineEntries = entries.filter(
    (entry) =>
      entry.channel === channel && entry.placement === "inline",
  );
  const latestEntry = inlineEntries.at(-1) ?? null;

  useEffect(() => {
    if (!latestEntry?.reveal) return;
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const rect = root.getBoundingClientRect();
    const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;

    if (!isVisible) {
      root.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }

    if (!latestEntry.critical) return;
    if (isVisible || prefersReducedMotion) {
      root.focus({ preventScroll: true });
      return;
    }

    const focusTimer = window.setTimeout(
      () => root.focus({ preventScroll: true }),
      350,
    );
    return () => window.clearTimeout(focusTimer);
  }, [latestEntry?.critical, latestEntry?.id, latestEntry?.reveal]);

  if (!inlineEntries.length) return null;

  return (
    <section
      ref={rootRef}
      tabIndex={latestEntry?.critical ? -1 : undefined}
      aria-label={label}
      data-admin-feedback-channel-viewport=""
      data-admin-feedback-channel={channel}
      data-admin-entity-feedback-slot=""
      data-admin-entity-feedback-reveal={
        latestEntry?.reveal ? "true" : "false"
      }
      className="scroll-mt-6 space-y-3 focus:outline-none"
    >
      {inlineEntries.map((entry) => (
        <AdminFeedbackViewportEntry
          key={entry.id}
          entry={entry}
          placement="inline"
          onDismiss={dismissFeedback}
        />
      ))}
    </section>
  );
}

/**
 * Thin route adapter for server/redirect feedback. The provider remains the
 * state owner; consumers only declare the feedback they received and where it
 * belongs in the shared page flow.
 */
export function AdminFeedbackRegion({
  channel,
  label,
  feedback,
}: {
  channel: string;
  label: string;
  feedback?: AdminActionFeedback | null;
}) {
  const { publishFeedback, clearFeedback } = useAdminFeedback();

  useEffect(() => {
    clearFeedback(channel);
    if (feedback) {
      publishFeedback(feedback, {
        channel,
        placement: "inline",
        reveal: feedback.variant === "danger",
      });
    }

    return () => clearFeedback(channel);
  }, [channel, clearFeedback, feedback, publishFeedback]);

  return <AdminFeedbackChannelViewport channel={channel} label={label} />;
}

export default function AdminFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const sequenceRef = useRef(0);
  const [entries, setEntries] = useState<AdminFeedbackEntry[]>([]);

  const dismissFeedback = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearFeedback = useCallback((channel?: string) => {
    setEntries((current) =>
      channel ? current.filter((entry) => entry.channel !== channel) : [],
    );
  }, []);

  const publishFeedback = useCallback(
    (
      feedback: AdminActionFeedback,
      options: AdminFeedbackPublishOptions = {},
    ) => {
      const channel = options.channel ?? "global";
      const placement = options.placement ?? "global";
      const critical =
        options.critical ??
        (feedback.variant === "danger" && feedback.lifecycle === "persistent");
      const id = `admin-feedback-${++sequenceRef.current}`;
      const incoming: AdminFeedbackEntry = {
        id,
        channel,
        critical,
        placement,
        reveal: options.reveal ?? critical,
        feedback,
      };

      setEntries((current) => {
        const signature = feedbackSignature(feedback);
        const duplicate = current.find(
          (entry) =>
            entry.channel === channel &&
            entry.placement === placement &&
            feedbackSignature(entry.feedback) === signature,
        );
        if (duplicate) {
          return current.map((entry) =>
            entry.id === duplicate.id
              ? { ...incoming, id: duplicate.id }
              : entry,
          );
        }

        if (feedback.variant === "success") {
          return [
            ...current.filter(
              (entry) =>
                entry.feedback.variant !== "success" &&
                (entry.critical ||
                  entry.channel !== channel ||
                  entry.placement !== placement),
            ),
            incoming,
          ];
        }

        if (critical) {
          const criticalEntries = current.filter((entry) => entry.critical);
          const retainedCriticalIds = new Set(
            criticalEntries.slice(-3).map((entry) => entry.id),
          );
          return [
            ...current.filter(
              (entry) =>
                !(
                  entry.channel === channel &&
                  entry.placement === placement &&
                  !entry.critical
                ) &&
                (!entry.critical || retainedCriticalIds.has(entry.id)),
            ),
            incoming,
          ];
        }

        return [
          ...current.filter(
            (entry) =>
              entry.critical ||
              entry.channel !== channel ||
              entry.placement !== placement,
          ),
          incoming,
        ];
      });

      return id;
    },
    [],
  );

  const value = useMemo<AdminFeedbackContextValue>(
    () => ({
      entries,
      publishFeedback,
      dismissFeedback,
      clearFeedback,
    }),
    [clearFeedback, dismissFeedback, entries, publishFeedback],
  );

  return (
    <AdminFeedbackContext.Provider value={value}>
      {children}
      <AdminFeedbackViewport />
    </AdminFeedbackContext.Provider>
  );
}
