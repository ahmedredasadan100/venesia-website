"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import { updateMaintenanceModeAction } from "./actions";

type MaintenanceModePanelProps = {
  initialReadState:
    | { status: "ready"; enabled: boolean }
    | { status: "unavailable" };
};

const FEEDBACK_CHANNEL = "settings-general-maintenance";

export default function MaintenanceModePanel({ initialReadState }: MaintenanceModePanelProps) {
  const router = useRouter();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const readAvailable = initialReadState.status === "ready";
  const [enabled, setEnabled] = useState(
    initialReadState.status === "ready" ? initialReadState.enabled : false,
  );
  const [pending, setPending] = useState(false);
  const [refreshPending, startRefreshTransition] = useTransition();
  const [confirmNextEnabled, setConfirmNextEnabled] = useState<boolean | null>(null);
  const toggleTriggerRef = useRef<HTMLButtonElement>(null);

  async function applyMaintenanceMode(nextValue: boolean) {
    if (!readAvailable) return;
    clearFeedback(FEEDBACK_CHANNEL);
    setPending(true);
    try {
      await updateMaintenanceModeAction(nextValue);
      setEnabled(nextValue);
      setConfirmNextEnabled(null);
      publishFeedback(
        {
          variant: "success",
          title: nextValue ? "تم تشغيل وضع الصيانة" : "تم إيقاف وضع الصيانة",
          message: nextValue
            ? "أصبحت الصفحات العامة في وضع الصيانة وفق الإعداد الحالي."
            : "عادت الصفحات العامة إلى وضع التشغيل المعتاد.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: FEEDBACK_CHANNEL, placement: "inline" },
      );
      router.refresh();
    } catch (toggleError) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تحديث وضع الصيانة",
          message:
            toggleError instanceof Error
              ? toggleError.message
              : "تعذر تحديث وضع الصيانة.",
          layout: "inline",
          dismissible: true,
          lifecycle: "persistent",
        },
        {
          channel: FEEDBACK_CHANNEL,
          placement: "inline",
          critical: true,
          reveal: true,
        },
      );
      throw toggleError;
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="space-y-4 rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Maintenance Mode</p>
            <h2 className="mt-2 text-xl font-semibold text-white">وضع الصيانة</h2>
            <p className="mt-3 text-sm leading-7 text-white/55">
              عند التفعيل، تُحوَّل الصفحات العامة إلى <code className="text-white/75">/maintenance</code> حتى يتم
              تسجيل الدخول بنفس بيانات الأدمن. لوحة التحكم تبقى متاحة من{" "}
              <code className="text-white/75">/admin</code>.
            </p>
          </div>

          <button
            ref={toggleTriggerRef}
            type="button"
            onClick={() => {
              if (readAvailable) setConfirmNextEnabled(!enabled);
            }}
            disabled={pending || refreshPending || !readAvailable}
            aria-pressed={readAvailable ? enabled : undefined}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60",
              readAvailable && enabled
                ? "border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                : readAvailable
                  ? "border border-[#D8B87A]/30 bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]"
                  : "border border-white/10 bg-white/5 text-white/45",
            ].join(" ")}
          >
            {pending
              ? "جاري الحفظ…"
              : !readAvailable
                ? "الحالة غير متاحة"
                : enabled
                  ? "إيقاف الصيانة"
                  : "تشغيل الصيانة"}
          </button>
        </div>

        {!readAvailable ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            <p>تعذرت قراءة إعداد وضع الصيانة. أعد المحاولة قبل إجراء أي تغيير.</p>
            <button
              type="button"
              disabled={refreshPending}
              onClick={() => startRefreshTransition(() => router.refresh())}
              className="rounded-xl border border-red-200/25 px-3 py-2 font-semibold transition hover:bg-red-100/10 disabled:opacity-60"
            >
              {refreshPending ? "جاري إعادة القراءة…" : "إعادة المحاولة"}
            </button>
          </div>
        ) : null}

        <AdminFeedbackChannelViewport
          channel={FEEDBACK_CHANNEL}
          label="نتيجة تحديث وضع الصيانة"
        />

        <p className="text-sm text-white/45">
          الحالة الحالية:{" "}
          <span className={readAvailable && enabled ? "font-semibold text-[#D8B87A]" : "font-semibold text-white/70"}>
            {!readAvailable ? "غير متاحة" : enabled ? "مفعّل" : "متوقف"}
          </span>
        </p>

      </section>

      <AdminConfirmDialog
        open={readAvailable && confirmNextEnabled !== null}
        title={
          confirmNextEnabled
            ? "تشغيل وضع الصيانة؟"
            : "إيقاف وضع الصيانة؟"
        }
        description={
          confirmNextEnabled
            ? "ستُحوّل الصفحات العامة إلى صفحة الصيانة، بينما تبقى لوحة الإدارة متاحة للمستخدمين المصرح لهم."
            : "ستعود الصفحات العامة إلى وضع التشغيل المعتاد فور اكتمال الحفظ."
        }
        confirmLabel={confirmNextEnabled ? "تشغيل وضع الصيانة" : "إيقاف وضع الصيانة"}
        pending={pending}
        returnFocusRef={toggleTriggerRef}
        onCancel={() => setConfirmNextEnabled(null)}
        onConfirm={() =>
          confirmNextEnabled === null
            ? Promise.resolve()
            : applyMaintenanceMode(confirmNextEnabled)
        }
      />
    </>
  );
}
