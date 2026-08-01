"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import { updateMaintenanceModeAction } from "./actions";

type MaintenanceModePanelProps = {
  initialEnabled: boolean;
};

const FEEDBACK_CHANNEL = "settings-general-maintenance";

export default function MaintenanceModePanel({ initialEnabled }: MaintenanceModePanelProps) {
  const router = useRouter();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [confirmNextEnabled, setConfirmNextEnabled] = useState<boolean | null>(null);
  const toggleTriggerRef = useRef<HTMLButtonElement>(null);

  async function applyMaintenanceMode(nextValue: boolean) {
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
            onClick={() => setConfirmNextEnabled(!enabled)}
            disabled={pending}
            aria-pressed={enabled}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60",
              enabled
                ? "border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                : "border border-[#D8B87A]/30 bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]",
            ].join(" ")}
          >
            {pending ? "جاري الحفظ…" : enabled ? "إيقاف الصيانة" : "تشغيل الصيانة"}
          </button>
        </div>

        <AdminFeedbackChannelViewport
          channel={FEEDBACK_CHANNEL}
          label="نتيجة تحديث وضع الصيانة"
        />

        <p className="text-sm text-white/45">
          الحالة الحالية:{" "}
          <span className={enabled ? "font-semibold text-[#D8B87A]" : "font-semibold text-white/70"}>
            {enabled ? "مفعّل" : "متوقف"}
          </span>
        </p>

      </section>

      <AdminConfirmDialog
        open={confirmNextEnabled !== null}
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
