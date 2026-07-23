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
  feedback: AdminActionFeedback;
};

export type AdminFeedbackPublishOptions = {
  channel?: string;
  critical?: boolean;
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
}: {
  entry: AdminFeedbackEntry;
  onDismiss: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry.critical) return;
    rootRef.current?.focus({ preventScroll: true });
  }, [entry.critical, entry.id]);

  return (
    <div
      ref={rootRef}
      tabIndex={entry.critical ? -1 : undefined}
      data-admin-feedback-entry=""
      data-admin-feedback-variant={entry.feedback.variant}
      data-admin-feedback-critical={entry.critical ? "true" : "false"}
      className="pointer-events-auto drop-shadow-[0_20px_45px_rgba(0,0,0,0.45)] focus:outline-none"
    >
      <AdminNotice
        {...entry.feedback}
        dismissible={entry.feedback.dismissible}
        onDismiss={() => onDismiss(entry.id)}
      />
    </div>
  );
}

export function AdminFeedbackViewport() {
  const { entries, dismissFeedback } = useAdminFeedback();

  if (!entries.length) return null;

  return (
    <section
      aria-label="إشعارات لوحة الإدارة"
      data-admin-feedback-viewport=""
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex max-h-[min(70vh,560px)] flex-col gap-3 overflow-y-auto sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(480px,calc(100vw-3rem))]"
    >
      {entries.map((entry) => (
        <AdminFeedbackViewportEntry
          key={entry.id}
          entry={entry}
          onDismiss={dismissFeedback}
        />
      ))}
    </section>
  );
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
      const critical =
        options.critical ??
        (feedback.variant === "danger" && feedback.lifecycle === "persistent");
      const id = `admin-feedback-${++sequenceRef.current}`;
      const incoming: AdminFeedbackEntry = {
        id,
        channel,
        critical,
        feedback,
      };

      setEntries((current) => {
        const signature = feedbackSignature(feedback);
        const duplicate = current.find(
          (entry) =>
            entry.channel === channel &&
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
                (entry.critical || entry.channel !== channel),
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
              (entry) => !entry.critical || retainedCriticalIds.has(entry.id),
            ),
            incoming,
          ];
        }

        return [
          ...current.filter(
            (entry) => entry.critical || entry.channel !== channel,
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
