"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminActionButton from "../../../../components/admin/ui/AdminActionButton";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import { AdminFormSection } from "../../../../components/admin/ui/AdminForm";
import { AdminModuleSectionHeader } from "../../../../components/admin/ui/AdminModuleTabs";
import { AdminFormGrid } from "../../../../components/admin/ui/AdminFormRuntime";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";
import { updateMaintenanceModeAction } from "./actions";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";

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
      const result = await updateMaintenanceModeAction(nextValue);
      setEnabled(nextValue);
      setConfirmNextEnabled(null);
      publishFeedback(
        mapAdminActionResultToFeedback(result),
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
      <AdminFormSection
        presentation="panel"
        header={<AdminModuleSectionHeader
          id="maintenance-mode"
          sectionHeading="وضع الصيانة"
          sectionDescription={
            <>
              عند التفعيل، تُحوَّل الصفحات العامة إلى <code className="text-white/75">/maintenance</code> حتى يتم
              تسجيل الدخول بنفس بيانات الأدمن. لوحة التحكم تبقى متاحة من{" "}
              <code className="text-white/75">/admin</code>.
            </>
          }
          icon="settings"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          sectionSummary={
            <AdminActionButton
              buttonRef={toggleTriggerRef}
              type="button"
              onClick={() => {
                if (readAvailable) setConfirmNextEnabled(!enabled);
              }}
              disabled={pending || refreshPending || !readAvailable}
              aria-pressed={readAvailable ? enabled : undefined}
              variant={readAvailable && enabled ? "danger" : readAvailable ? "primary" : "dark"}
            >
              {pending
                ? "جاري الحفظ…"
                : !readAvailable
                  ? "الحالة غير متاحة"
                  : enabled
                    ? "إيقاف الصيانة"
                    : "تشغيل الصيانة"}
            </AdminActionButton>
          }
        />}
      >
        <AdminFormGrid columns={1}>


          {!readAvailable ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <AdminNotice
                variant="danger"
                dismissible={false}
                message="تعذرت قراءة إعداد وضع الصيانة. أعد المحاولة قبل إجراء أي تغيير."
              />
              <AdminActionButton
                type="button"
                disabled={refreshPending}
                onClick={() => startRefreshTransition(() => router.refresh())}
                variant="danger"
              >
                {refreshPending ? "جاري إعادة القراءة…" : "إعادة المحاولة"}
              </AdminActionButton>
            </div>
          ) : null}

          <AdminFeedbackChannelViewport
            channel={FEEDBACK_CHANNEL}
            label="نتيجة تحديث وضع الصيانة"
          />

          <p className="text-sm text-white/45">
            الحالة الحالية:{" "}
            <AdminStatusPill tone={!readAvailable ? "red" : enabled ? "gold" : "muted"}>
              {!readAvailable ? "غير متاحة" : enabled ? "مفعّل" : "متوقف"}
            </AdminStatusPill>
          </p>

        </AdminFormGrid>
      </AdminFormSection>

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
