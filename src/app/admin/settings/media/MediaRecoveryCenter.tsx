"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import type {
  MediaRecoveryAction,
  MediaRecoveryItem,
  MediaRecoveryQueue,
} from "../../../../lib/admin/media-catalog/recovery-contract";
import { formatAdminDateTime } from "../../../../lib/content-dates";

const ACTION_LABELS: Record<MediaRecoveryAction, string> = {
  retry_verification: "التحقق من هذا الملف",
  retry_finalization: "إكمال إنهاء الحذف",
  cancel_reservation: "إلغاء حجز الحذف",
  confirm_missing: "تأكيد فقد الملف",
  preview_scoped_reconciliation: "فحص ارتباطات هذا الملف",
  resolve_write_lease: "حل عملية الحفظ",
};
const CONFIRM_ACTIONS = new Set<MediaRecoveryAction>([
  "retry_finalization",
  "cancel_reservation",
  "confirm_missing",
  "resolve_write_lease",
]);

const STATE_LABELS: Record<string, string> = {
  reserved: "الحذف متوقف قبل الإنهاء",
  recovery_required: "تحتاج عملية الحذف إلى مراجعة",
  deleting: "الحذف قيد التحقق",
  missing: "الملف غير موجود في مكان الحفظ",
  uncertain: "حالة الملف غير مؤكدة",
  active: "عملية الحفظ لم تكتمل",
  failed: "تعذر إكمال عملية الحفظ",
  expired: "انتهت مهلة عملية الحفظ",
};

function getStateLabel(state: string) {
  return STATE_LABELS[state] ?? "حالة تحتاج مراجعة";
}

async function requestRecoveryQueue() {
  const response = await fetch("/api/admin/media-library/recovery", {
    cache: "no-store",
  });
  const body = (await response.json()) as MediaRecoveryQueue & { error?: string };
  if (!response.ok) throw new Error(body.error || "تعذر تحميل مركز التعافي.");
  return body;
}

export default function MediaRecoveryCenter() {
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const [queue, setQueue] = useState<MediaRecoveryQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: MediaRecoveryAction;
    item: MediaRecoveryItem;
  } | null>(null);
  const confirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const recoveryRootRef = useRef<HTMLElement>(null);
  const queueRequestRef = useRef<Promise<MediaRecoveryQueue> | null>(null);

  const announce = useCallback((input: {
    variant: "success" | "warning" | "danger";
    title: string;
    message: string;
  }) => {
    clearFeedback("media-settings-recovery");
    publishFeedback(
      {
        ...input,
        layout: "inline",
        dismissible: true,
        lifecycle: input.variant === "danger" ? "persistent" : "manual",
      },
      {
        channel: "media-settings-recovery",
        critical: input.variant === "danger",
        placement: "inline",
        reveal: input.variant === "danger",
      },
    );
  }, [clearFeedback, publishFeedback]);

  const requestQueue = useCallback(() => {
    if (queueRequestRef.current) return queueRequestRef.current;

    const request: Promise<MediaRecoveryQueue> = requestRecoveryQueue().finally(() => {
      if (queueRequestRef.current === request) queueRequestRef.current = null;
    });
    queueRequestRef.current = request;
    return request;
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await requestQueue());
    } catch (error) {
      announce({
        variant: "danger",
        title: "تعذر تحميل حالات الميديا",
        message: error instanceof Error ? error.message : "حدث خطأ غير معروف.",
      });
    } finally {
      setLoading(false);
    }
  }, [announce, requestQueue]);

  useEffect(() => {
    let active = true;
    void requestQueue()
      .then((nextQueue) => {
        if (active) setQueue(nextQueue);
      })
      .catch((error: unknown) => {
        if (!active) return;
        announce({
          variant: "danger",
          title: "تعذر تحميل حالات الميديا",
          message: error instanceof Error ? error.message : "حدث خطأ غير معروف.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [announce, requestQueue]);

  async function execute(
    action: MediaRecoveryAction,
    item: MediaRecoveryItem,
    invokedFromConfirmation = false,
  ) {
    const operationKey = `${item.kind}:${item.id}:${action}`;
    setPending(operationKey);
    try {
      const response = await fetch("/api/admin/media-library/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          target: {
            kind: item.kind,
            id: item.id,
            expectedUpdatedAt: item.updatedAt ?? undefined,
          },
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        auditWarning?: string | null;
        mutated?: boolean;
        verification?: {
          storageState: "exists" | "missing";
          persistedReferenceCount: number;
          liveReferenceCount: number;
          uncertainties: string[];
        } | null;
      };
      if (!response.ok) {
        throw new Error(
          [body.error || "تعذر تنفيذ إجراء التعافي.", body.auditWarning].filter(Boolean).join(" "),
        );
      }
      const verification = body.verification;
      announce({
        variant: body.auditWarning
          ? "warning"
          : body.mutated
            ? "success"
            : verification?.uncertainties.length
              ? "warning"
              : "success",
        title: body.auditWarning
          ? "اكتمل الإجراء مع تنبيه في سجل التدقيق"
          : body.mutated
            ? "تم تحديث حالة الميديا بأمان"
            : "اكتمل التحقق",
        message: [
          body.mutated
            ? "أُعيد فحص الحالة وتطبيق الإجراء المسموح فقط."
            : verification
              ? `حالة التخزين: ${verification.storageState === "exists" ? "الملف موجود" : "الملف غير موجود"}، الارتباطات المحفوظة ${verification.persistedReferenceCount}، والارتباطات الحية ${verification.liveReferenceCount}.`
              : "اكتمل التحقق دون تغيير البيانات.",
          body.auditWarning,
        ].filter(Boolean).join(" "),
      });
      setConfirmation(null);
      await loadQueue();
    } catch (error) {
      announce({
        variant: "danger",
        title: "تم منع الإجراء",
        message: error instanceof Error ? error.message : "تعذر إثبات أمان الإجراء.",
      });
      if (invokedFromConfirmation) throw error;
    } finally {
      setPending(null);
    }
  }

  function requestAction(
    action: MediaRecoveryAction,
    item: MediaRecoveryItem,
    trigger: HTMLButtonElement,
  ) {
    if (CONFIRM_ACTIONS.has(action)) {
      confirmationTriggerRef.current = trigger;
      setConfirmation({ action, item });
      return;
    }
    void execute(action, item);
  }

  return (
    <>
      <section
        ref={recoveryRootRef}
        tabIndex={-1}
        className="admin-premium-card mx-auto mb-6 w-full max-w-6xl space-y-5 rounded-[28px] p-5 sm:p-6 lg:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">حالات تحتاج مراجعة</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-white/50">
              يعرض هذا القسم عمليات الحذف أو الحفظ التي توقفت في حالة آمنة. إجراءات التحقق هنا تخص الملف المعروض، بينما تاريخ الفحص الشامل يصف آخر فحص لكل مصادر الارتباط.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || pending !== null}
            onClick={() => void loadQueue()}
            className="rounded-2xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 disabled:opacity-40"
          >
            {loading ? "جارٍ التحقق…" : "تحديث الحالات"}
          </button>
        </div>

        <AdminFeedbackChannelViewport
          channel="media-settings-recovery"
          label="نتيجة مراجعة حالات الميديا"
        />

        {queue?.warning ? (
          <p className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-7 text-amber-100/75">
            {queue.warning}
          </p>
        ) : null}

        {queue?.available && queue.truncated ? (
          <p className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-7 text-amber-100/75">
            تُعرض أول {queue.resultLimitPerType} حالة من كل نوع. قد توجد حالات إضافية؛ عالج الحالات الحالية ثم حدّث القائمة.
          </p>
        ) : null}

        {queue?.available ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <dt className="text-xs text-white/40">
                عمليات حذف متوقفة{queue.truncated ? " (المعروضة)" : ""}
              </dt>
              <dd className="mt-2 text-xl font-bold text-white">{queue.counts.stuckDeletes}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <dt className="text-xs text-white/40">
                أصول مفقودة أو غير مؤكدة{queue.truncated ? " (المعروضة)" : ""}
              </dt>
              <dd className="mt-2 text-xl font-bold text-white">{queue.counts.missingOrUncertainAssets}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <dt className="text-xs text-white/40">
                عمليات حفظ غير محلولة{queue.truncated ? " (المعروضة)" : ""}
              </dt>
              <dd className="mt-2 text-xl font-bold text-white">{queue.counts.unresolvedLeaseBatches}</dd>
            </div>
          </dl>
        ) : null}

        {queue?.available && queue.items.length === 0 ? (
          <p className="rounded-2xl border border-emerald-300/15 bg-emerald-300/6 p-4 text-sm text-emerald-100/75">
            لا توجد حاليًا حالات تشغيلية عالقة تحتاج تدخلًا.
          </p>
        ) : null}

        {queue?.available && queue.items.length ? (
          <div className="space-y-3">
            {queue.items.map((item) => (
              <article
                key={`${item.kind}:${item.id}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.assetLabel}</p>
                    <p className="mt-1 text-xs text-white/42">
                      الحالة: {getStateLabel(item.state)} · عدد الأصول: {item.assetCount}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1 text-[11px] text-amber-100/75">
                    {item.kind === "delete_reservation"
                      ? "حجز حذف"
                      : item.kind === "write_lease"
                        ? "عملية حفظ"
                        : "أصل يحتاج تحققًا"}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-6 text-white/58">{item.suggestedAction}</p>
                <dl className="mt-3 grid gap-2 text-[11px] text-white/42 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt>معرّف الأصل</dt>
                    <dd className="mt-1 break-all font-mono text-white/65" dir="ltr">
                      {item.assetId ?? "غير متاح"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt>مسار الملف</dt>
                    <dd className="mt-1 break-all font-mono text-white/65" dir="ltr">
                      {item.publicValue ?? "غير متاح"}
                    </dd>
                  </div>
                  <div><dt>بدأت</dt><dd className="mt-1 text-white/65">{formatAdminDateTime(item.startedAt)}</dd></div>
                  <div><dt>آخر تحديث للحالة</dt><dd className="mt-1 text-white/65">{formatAdminDateTime(item.updatedAt)}</dd></div>
                  {item.expiresAt ? (
                    <div><dt>انتهاء مهلة الحفظ</dt><dd className="mt-1 text-white/65">{formatAdminDateTime(item.expiresAt)}</dd></div>
                  ) : null}
                  <div className="min-w-0">
                    <dt>رمز التعثر</dt>
                    <dd className="mt-1 break-all font-mono text-white/65" dir="ltr">
                      {item.failureCode ?? "غير متاح"}
                    </dd>
                  </div>
                  <div><dt>آخر تحقق تخزين</dt><dd className="mt-1 text-white/65">{formatAdminDateTime(item.lastStorageVerification)}</dd></div>
                  <div><dt>آخر فحص شامل لكل المصادر</dt><dd className="mt-1 text-white/65">{formatAdminDateTime(item.lastProviderScan)}</dd></div>
                </dl>
                {item.blockedReasons.length ? (
                  <ul className="mt-3 space-y-1 text-xs leading-6 text-amber-100/65">
                    {item.blockedReasons.map((reason) => <li key={reason}>• {reason}</li>)}
                  </ul>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
                  {item.allowedActions.map((action) => {
                    const operationKey = `${item.kind}:${item.id}:${action}`;
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={pending !== null}
                        onClick={(event) => requestAction(action, item, event.currentTarget)}
                        className="rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white/70 disabled:opacity-40"
                      >
                        {pending === operationKey ? "جارٍ التنفيذ…" : ACTION_LABELS[action]}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <AdminConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation ? `${ACTION_LABELS[confirmation.action]}؟` : "تأكيد الإجراء"}
        description="سيعيد النظام التحقق من التخزين والارتباطات داخل الطلب نفسه، وسيمنع الإجراء إذا بقي أي نقص أو تعارض."
        confirmLabel={confirmation ? ACTION_LABELS[confirmation.action] : "تأكيد"}
        pending={Boolean(confirmation && pending === `${confirmation.item.kind}:${confirmation.item.id}:${confirmation.action}`)}
        returnFocusRef={confirmationTriggerRef}
        fallbackFocusRef={recoveryRootRef}
        onCancel={() => setConfirmation(null)}
        onConfirm={() =>
          confirmation
            ? execute(confirmation.action, confirmation.item, true)
            : Promise.resolve()
        }
      />
    </>
  );
}
