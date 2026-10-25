"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAdminFeedbackPolicy } from "../../../lib/admin/admin-action-feedback";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, adminFormLabelClassName } from "../../../lib/admin/admin-ui-styles";
import type {
  IntegrationAssetType,
  IntegrationConnectionStatus,
  IntegrationSnapshotItem,
} from "../../../lib/admin/integrations/integrations-contract";
import { isIntegrationAppConfigurationAuthorizationReady } from "../../../lib/admin/integrations/server-configuration-contract";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../AdminFeedbackProvider";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminActionButton, AdminCard, AdminConfirmDialog, AdminFormGrid, AdminFormSection, AdminListboxSelect, AdminStatusPill } from "../ui";
import { adminActionButtonClassName } from "../ui/AdminActionButton";
import { AdminModuleSectionHeader } from "../ui/AdminModuleTabs";
import IntegrationBrandIcon from "./IntegrationBrandIcon";

const ASSET_LABELS: Record<IntegrationAssetType, string> = {
  account: "الحساب",
  property: "GA4 Property",
  site: "Search Console Site",
  manager_customer: "Manager Customer",
  customer: "Google Ads Customer",
  business: "Business Portfolio",
  ad_account: "Ad Account",
  pixel: "Pixel",
  dataset: "Dataset",
  business_center: "Business Center",
  advertiser: "Advertiser Account",
  organization: "Organization",
  waba: "WhatsApp Business Account",
  phone_number: "Phone Number",
};

const STATUS_LABELS: Record<IntegrationConnectionStatus, string> = {
  authorizing: "جارٍ التفويض",
  authorized_unbound: "مفوّض دون أصل",
  discovering_assets: "جارٍ اكتشاف الأصول",
  pending_selection: "بانتظار اختيار الأصول",
  testing: "جارٍ الاختبار",
  syncing: "جارٍ المزامنة",
  connected: "متصل",
  disconnected: "غير متصل",
  needs_configuration: "يحتاج إعدادًا",
  needs_reauth: "يحتاج إعادة تفويض",
  needs_attention: "يحتاج انتباهًا",
  unavailable: "غير متاح",
};

const LIFECYCLE_STEPS = [
  "التفويض",
  "اختيار الأصول",
  "اختبار الاتصال",
  "المزامنة الأولى",
] as const;

type Operation =
  "discover" | "select_test_sync" | "test" | "sync" | "disconnect" | "diagnose";

function actionLabel(operation: Operation) {
  return {
    discover: "اكتشاف الأصول",
    select_test_sync: "اختبار وبدء المزامنة",
    test: "اختبار الاتصال",
    sync: "مزامنة الآن",
    disconnect: "فصل الاتصال",
    diagnose: "تشخيص الاتصال",
  }[operation];
}

export default function IntegrationConnectionWizard({
  item,
  requestedAction,
  callbackError,
}: {
  item: IntegrationSnapshotItem;
  requestedAction: string | null;
  callbackError: string | null;
}) {
  const router = useRouter();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const feedbackChannel = `integration-connection:${item.key}`;
  const activeFeedbackChannel = useRef<string | null>(null);
  const disconnectButtonRef = useRef<HTMLButtonElement | null>(null);
  const testButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const initialSelection = Object.fromEntries(
    item.selectedAssets.map((asset) => [asset.type, asset.id ?? ""]),
  ) as Partial<Record<IntegrationAssetType, string>>;
  const [selection, setSelection] = useState(initialSelection);
  const groups = useMemo(() => {
    const map = new Map<
      IntegrationAssetType,
      IntegrationSnapshotItem["availableAssets"]
    >();
    for (const asset of item.availableAssets) {
      map.set(asset.type, [...(map.get(asset.type) ?? []), asset]);
    }
    return [...map.entries()];
  }, [item.availableAssets]);

  const publishOperationFeedback = useCallback((variant: "success" | "danger", message: string) => {
    if (activeFeedbackChannel.current !== feedbackChannel) return;
    publishFeedback({
      ...getAdminFeedbackPolicy(variant === "success" ? "transient_action" : "action_validation"),
      variant,
      title: variant === "success" ? "تم الإجراء" : "تعذر إكمال الإجراء",
      message,
      layout: "stacked",
      dismissSearchParams: [],
    }, { channel: feedbackChannel, placement: "inline", critical: false });
  }, [feedbackChannel, publishFeedback]);

  useEffect(() => {
    activeFeedbackChannel.current = feedbackChannel;
    if (callbackError) publishOperationFeedback("danger", callbackError);
    return () => {
      activeFeedbackChannel.current = null;
      clearFeedback(feedbackChannel);
    };
  }, [callbackError, clearFeedback, feedbackChannel, publishOperationFeedback]);

  useEffect(() => {
    if (requestedAction === "test") testButtonRef.current?.focus();
  }, [requestedAction]);

  async function execute(
    operation: Operation,
    extra?: Record<string, unknown>,
  ) {
    if (!item.liveConnectionSupported || pending) return;
    setPending(operation);
    clearFeedback(feedbackChannel);
    try {
      const response = await fetch(
        `/api/admin/integrations/${item.key}/action`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation,
            ...(item.connectionId ? { connectionId: item.connectionId } : {}),
            ...extra,
          }),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: { message?: string; code?: string; status?: string };
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? "integration_action_failed");
      const diagnostic =
        operation === "diagnose" && payload.result?.message
          ? `${payload.result.message}${payload.result.code ? ` (${payload.result.code})` : ""}`
          : null;
      publishOperationFeedback("success", diagnostic ?? `${actionLabel(operation)} تم بنجاح.`);
      setConfirmDisconnect(false);
      router.refresh();
    } catch (error) {
      publishOperationFeedback("danger", error instanceof Error ? error.message : "integration_action_failed");
      throw error;
    } finally {
      setPending(null);
    }
  }

  const selectedIds = Object.values(selection).filter(
    (value): value is string => Boolean(value),
  );
  const requiredReady = item.requiredAssetTypes.every((type) =>
    Boolean(selection[type]),
  );
  const canAuthorize =
    item.liveConnectionSupported &&
    item.appConfigurationStatus !== null &&
    isIntegrationAppConfigurationAuthorizationReady({
      status: item.appConfigurationStatus,
      lastTestedAt: item.appConfigurationLastTestedAt,
    });
  const showAssetSelection =
    groups.length > 0 &&
    ["pending_selection", "testing", "needs_attention"].includes(item.status);
  const progressIndex = ["connected", "syncing"].includes(item.status)
    ? 3
    : item.status === "testing" || item.selectedAssets.length > 0
      ? 2
      : ["discovering_assets", "pending_selection"].includes(item.status) ||
          item.availableAssets.length > 0
        ? 1
        : item.connectionId ||
            ["authorizing", "authorized_unbound"].includes(item.status)
          ? 0
          : -1;

  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME} dir="rtl">
      <AdminActionButton href="/admin/settings/integrations" variant="dark">
        العودة إلى التكاملات
      </AdminActionButton>

      <AdminFormSection presentation="panel" header={(
        <AdminModuleSectionHeader
          id="integration-connection-overview"
          sectionHeading={item.label}
          sectionDescription={item.description}
          icon="link"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          sectionSummary={(
            <>
              <IntegrationBrandIcon integration={item.key} />
          <AdminStatusPill
            tone={
              item.status === "connected"
                ? "green"
                : item.status.includes("attention") ||
                    item.status === "needs_reauth"
                  ? "red"
                  : "gold"
            }
          >
            {STATUS_LABELS[item.status]}
          </AdminStatusPill>
            </>
          )}
        />
      )}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>

        <ol
          aria-label="مراحل ربط التكامل"
          className="grid gap-2 sm:grid-cols-4"
        >
          {LIFECYCLE_STEPS.map((step, index) => (
            <li
              key={step}
              aria-current={index === progressIndex ? "step" : undefined}
              className={`rounded-xl border px-3 py-2 text-[11px] ${index <= progressIndex ? "border-[#D8B87A]/25 bg-[#D8B87A]/[.08] text-[#E8CF9A]" : "border-white/8 bg-white/[.02] text-white/30"}`}
            >
              <span className="me-2 font-en">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <AdminFormGrid columns={3}>
          <AdminCard presentation="premium" className="p-3">
            <p className="text-[10px] text-white/35">آخر مزامنة</p>
            <p className="mt-2 font-en text-xs text-white/65">
              {formatAdminDateTime(item.lastSyncAt)}
            </p>
          </AdminCard>
          <AdminCard presentation="premium" className="p-3">
            <p className="text-[10px] text-white/35">المزامنة التالية</p>
            <p className="mt-2 font-en text-xs text-white/65">
              {formatAdminDateTime(item.nextSyncAt)}
            </p>
          </AdminCard>
          <AdminCard presentation="premium" className="p-3">
            <p className="text-[10px] text-white/35">الأصول المحددة</p>
            <p className="mt-2 font-en text-xs text-white/65">
              {item.selectedAssets.length}
            </p>
          </AdminCard>
        </AdminFormGrid>

        <p className="text-xs leading-6 text-white/50">
          {item.message}
        </p>
        <div className="empty:hidden">
          <AdminFeedbackChannelViewport channel={feedbackChannel} label="نتيجة إجراء التكامل" />
        </div>
        </div>
      </AdminFormSection>

      {!canAuthorize && item.liveConnectionSupported ? (
        <AdminFormSection presentation="panel" header={(
          <AdminModuleSectionHeader
            id="integration-configuration-unavailable"
            sectionHeading="App Configuration غير جاهزة"
            icon="settings"
            sectionHeaderPresentation="premium"
            sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          />
        )}>
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <p className="text-xs leading-6 text-amber-100/65">
            لا يمكن بدء OAuth قبل حفظ الإعداد داخل CMS Vault واجتياز الفحص
            الآمن. حالة المصدر:{" "}
            <span className="font-en">{item.appConfigurationSource}</span>.
          </p>
          {item.missingConfiguration.length ? (
            <ul className="space-y-2 font-en text-xs text-amber-100/80">
              {item.missingConfiguration.map((name) => (
                <li key={name}>• {name}</li>
              ))}
            </ul>
          ) : null}
          <AdminActionButton
            href={`/admin/settings/integrations/server-configuration#${item.key === "whatsapp_business" ? "whatsapp" : item.key.startsWith("google_") ? "google" : item.key === "meta_business" ? "meta" : item.key === "tiktok_ads" ? "tiktok" : "snapchat"}`}
            variant="dark"
          >
            فتح إعدادات الربط على السيرفر
          </AdminActionButton>
          </div>
        </AdminFormSection>
      ) : null}

      {showAssetSelection ? (
        <AdminFormSection presentation="panel" header={(
          <AdminModuleSectionHeader
            id="integration-asset-selection"
            sectionHeading="اختيار أصول Venesia"
            sectionDescription="يُسمح بأصل واحد من كل نوع. العلاقات والصلاحيات تُفحص على السيرفر قبل الاختبار."
            icon="database"
            sectionHeaderPresentation="premium"
            sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          />
        )}>
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          <AdminFormGrid>
            {groups.map(([type, assets]) => (
              <AdminCard key={type} presentation="premium" className="p-3">
                <div className={adminFormLabelClassName({ textInset: true })}>
                <span
                  id={`integration-asset-${type}-label`}
                  data-admin-form-label-text
                >
                  {ASSET_LABELS[type]}{" "}
                  {item.requiredAssetTypes.includes(type) ? (
                    <span className="text-[#D8B87A]">*</span>
                  ) : (
                    <span className="text-white/30">(اختياري)</span>
                  )}
                </span>
                <AdminListboxSelect
                  value={selection[type] ?? ""}
                  onChange={(value) =>
                    setSelection((current) => ({ ...current, [type]: value }))
                  }
                  options={[
                    { value: "", label: "بدون اختيار" },
                    ...assets
                      .filter((asset): asset is typeof asset & { id: string } =>
                        Boolean(asset.id),
                      )
                      .map((asset) => ({
                        value: asset.id,
                        label: `${asset.displayName} — ${asset.externalId}`,
                      })),
                  ]}
                  ariaLabelledBy={`integration-asset-${type}-label`}
                />
                </div>
              </AdminCard>
            ))}
          </AdminFormGrid>
          <AdminActionButton
            type="button"
            disabled={!requiredReady || pending !== null}
            onClick={() =>
              void execute("select_test_sync", { assetIds: selectedIds }).catch(
                () => undefined,
              )
            }
            variant="primary"
          >
            {pending === "select_test_sync"
              ? "جارٍ الاختبار والمزامنة…"
              : "اختبار الاتصال وبدء المزامنة"}
          </AdminActionButton>
          </div>
        </AdminFormSection>
      ) : null}

      <AdminFormSection presentation="panel" header={(
        <AdminModuleSectionHeader
          id="integration-connection-actions"
          sectionHeading="إجراءات الاتصال"
          icon="settings"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
      )}>
        <div className="flex flex-wrap gap-3">
          {canAuthorize ? (
            <a
              href={`/api/admin/integrations/${item.key}/authorize`}
              className={adminActionButtonClassName({ variant: "primary" })}
            >
              {item.connectionId ? "إعادة التفويض" : "بدء التفويض"}
            </a>
          ) : null}
          {item.connectionId && !groups.length ? (
            <AdminActionButton
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("discover").catch(() => undefined)}
              variant="dark"
            >
              اكتشاف الأصول
            </AdminActionButton>
          ) : null}
          {item.connectionId && item.selectedAssets.length ? (
            <AdminActionButton
              buttonRef={testButtonRef}
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("test").catch(() => undefined)}
              variant="dark"
            >
              اختبار الاتصال
            </AdminActionButton>
          ) : null}
          {item.connectionId ? (
            <AdminActionButton
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("diagnose").catch(() => undefined)}
              variant="dark"
            >
              تشخيص الاتصال
            </AdminActionButton>
          ) : null}
          {item.connectionId &&
          ["connected", "needs_attention"].includes(item.status) ? (
            <AdminActionButton
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("sync").catch(() => undefined)}
              variant="dark"
            >
              مزامنة الآن
            </AdminActionButton>
          ) : null}
          {item.reportsAvailable ? (
            <AdminActionButton
              href={item.reportsHref}
              variant="dark"
            >
              عرض التقارير
            </AdminActionButton>
          ) : null}
          {item.connectionId ? (
            <AdminActionButton
              buttonRef={disconnectButtonRef}
              type="button"
              disabled={pending !== null}
              onClick={() => setConfirmDisconnect(true)}
              variant="danger"
            >
              فصل الاتصال
            </AdminActionButton>
          ) : null}
        </div>
      </AdminFormSection>

      <AdminConfirmDialog
        open={confirmDisconnect}
        title={`فصل ${item.label}؟`}
        description="سيُطلب إلغاء صلاحية الاتصال لدى المزوّد عندما يدعم ذلك، ثم تُحذف Credentials من Vault وRead Models المرتبطة محليًا."
        confirmLabel="فصل وحذف Credentials"
        pending={pending === "disconnect"}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => execute("disconnect")}
        returnFocusRef={disconnectButtonRef}
      />
    </div>
  );
}
