"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { getAdminFeedbackPolicy } from "../../../lib/admin/admin-action-feedback";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../lib/admin/admin-ui-styles";
import type {
  IntegrationAppConfigurationStatus,
  IntegrationAppConfigurationSurfaceSnapshot,
  IntegrationsServerConfigurationSnapshot,
} from "../../../lib/admin/integrations/server-configuration-contract";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../AdminFeedbackProvider";
import {
  AdminConfirmDialog,
  AdminActionButton,
  ADMIN_FORM_STACK_CLASS_NAME,
  AdminCard,
  AdminFormControlHeader,
  AdminFormField,
  AdminFormGrid,
  AdminFormSection,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminStatusPill,
  adminFormFieldClassName,
} from "../ui";
import { adminActionButtonClassName } from "../ui/AdminActionButton";
import { AdminFormPendingFields } from "../ui/AdminFormRuntime";
import { AdminModuleSectionHeader } from "../ui/AdminModuleTabs";
import IntegrationBrandIcon from "./IntegrationBrandIcon";

type Operation = "save" | "import_environment" | "test" | "remove";

const STATUS_LABELS: Record<IntegrationAppConfigurationStatus, string> = {
  needs_configuration: "يحتاج إعدادًا",
  configuration_incomplete: "إعداد غير مكتمل",
  configuration_invalid: "إعداد غير صالح",
  configuration_saved_waiting_for_authorization: "محفوظ وينتظر التفويض",
  ready_to_connect: "جاهز للربط",
};

const STATUS_TONES: Record<IntegrationAppConfigurationStatus, "green" | "gold" | "muted" | "red" | "blue"> = {
  needs_configuration: "muted",
  configuration_incomplete: "gold",
  configuration_invalid: "red",
  configuration_saved_waiting_for_authorization: "blue",
  ready_to_connect: "green",
};

const SOURCE_LABELS = {
  cms_vault: "CMS Vault",
  environment_bootstrap: "Environment bootstrap",
  none: "غير مضبوط",
} as const;

const SURFACE_ICONS = {
  google: "google_analytics",
  meta: "meta_business",
  tiktok: "tiktok_ads",
  snapchat: "snapchat_ads",
  whatsapp: "whatsapp_business",
} as const;

const SAFE_ERRORS: Record<string, string> = {
  integration_app_configuration_action_invalid: "تعذر اعتماد الطلب. راجع القيم وأعد المحاولة.",
  integration_app_configuration_key_invalid: "يحتوي الطلب على حقل غير معتمد.",
  integration_app_configuration_csrf_rejected: "رُفض الطلب لأسباب أمنية. أعد تحميل الصفحة.",
  integration_app_configuration_version_conflict: "تغيّر الإعداد بواسطة جلسة أخرى. أعد تحميل الصفحة.",
  integration_app_configuration_test_conflict: "هناك اختبار آخر جارٍ لهذا التكامل.",
  integration_app_configuration_test_rate_limited: "وصل اختبار الإعداد إلى الحد الآمن. حاول لاحقًا.",
  integration_app_configuration_persistence_unavailable: "مخزن إعدادات التكاملات غير متاح حاليًا.",
  integration_vault_write_failed: "تعذر حفظ السر داخل Vault.",
  integration_environment_bootstrap_missing: "لا توجد قيم Bootstrap مكتملة للاستيراد.",
};

function safeFeedbackMessage(code: string | undefined) {
  if (!code) return "تعذر إكمال الإجراء بأمان.";
  return SAFE_ERRORS[code] ?? "تعذر إكمال الإجراء. راجع Diagnostics دون كشف بيانات الاعتماد.";
}

function ProofCard({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <AdminCard presentation="premium" className="p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-white/55">{label}</p>
        <span className={`size-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-300"}`} aria-hidden="true" />
      </div>
      <p className="mt-3 break-all font-en text-[11px] leading-5 text-white/38">{value}</p>
    </AdminCard>
  );
}

function SurfaceCard({
  surface,
  actionsAvailable,
}: {
  surface: IntegrationAppConfigurationSurfaceSnapshot;
  actionsAvailable: boolean;
}) {
  const router = useRouter();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const feedbackChannel = `integration-server-configuration:${surface.key}`;
  const activeFeedbackChannel = useRef<string | null>(null);
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const sharedOnly = surface.key === "whatsapp";

  useEffect(() => {
    activeFeedbackChannel.current = feedbackChannel;
    return () => {
      activeFeedbackChannel.current = null;
      clearFeedback(feedbackChannel);
    };
  }, [clearFeedback, feedbackChannel]);

  function publishOperationFeedback(variant: "success" | "danger", message: string) {
    if (activeFeedbackChannel.current !== feedbackChannel) return;
    publishFeedback({
      ...getAdminFeedbackPolicy(variant === "success" ? "transient_action" : "action_validation"),
      variant,
      title: variant === "success" ? "تم الإجراء" : "تعذر إكمال الإجراء",
      message,
      layout: "stacked",
      dismissSearchParams: [],
    }, { channel: feedbackChannel, placement: "inline", critical: false });
  }

  async function mutate(operation: Operation, values?: Record<string, string>) {
    if (pending || !actionsAvailable) return;
    setPending(operation);
    clearFeedback(feedbackChannel);
    try {
      const response = await fetch(`/api/admin/integrations/server-configuration/${surface.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation, expectedVersion: surface.version, ...(values ? { values } : {}) }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        publishOperationFeedback("danger", safeFeedbackMessage(payload.error));
        return;
      }
      const success = operation === "save"
        ? "حُفظ الإعداد داخل Vault دون إعادة أي Secret إلى المتصفح."
        : operation === "import_environment"
          ? "نُقلت قيم Bootstrap إلى CMS Vault بنجاح."
          : operation === "test"
            ? "اكتمل الاختبار الآمن. راجع حالة كل اتصال أدناه."
            : "حُذف App Configuration وأصبحت الاتصالات المتأثرة بحاجة لإعادة التفويض.";
      publishOperationFeedback("success", success);
      setConfirmRemove(false);
      router.refresh();
    } catch {
      publishOperationFeedback("danger", "تعذر الوصول إلى Server Configuration owner.");
    } finally {
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]),
    );
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
      input.value = "";
    }
    void mutate("save", values);
  }

  async function copyCallback(integration: string, url: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(integration);
    } catch {
      publishOperationFeedback("danger", "تعذر نسخ Callback URL من المتصفح الحالي.");
    }
  }

  const ownerReady = surface.validations.some((item) => item.configured);
  const status = surface.validations.some((item) => item.status === "configuration_invalid")
    ? "configuration_invalid"
    : surface.validations.some((item) => item.status === "ready_to_connect")
      ? "ready_to_connect"
      : surface.validations.some((item) => item.status === "configuration_saved_waiting_for_authorization")
        ? "configuration_saved_waiting_for_authorization"
        : surface.validations.some((item) => item.status === "configuration_incomplete")
          ? "configuration_incomplete"
          : "needs_configuration";

  return (
    <article
      id={surface.key}
      className="min-w-0 scroll-mt-24"
    >
      <AdminFormSection presentation="panel" header={(
        <AdminModuleSectionHeader
          id={`integration-configuration-${surface.key}`}
          sectionHeading={surface.label}
          sectionDescription={surface.description}
          icon="settings"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
          sectionSummary={(
            <>
              <IntegrationBrandIcon integration={SURFACE_ICONS[surface.key]} />
              <AdminStatusPill tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</AdminStatusPill>
          <AdminStatusPill tone={surface.source === "cms_vault" ? "green" : surface.source === "none" ? "muted" : "gold"}>
            {SOURCE_LABELS[surface.source]}
          </AdminStatusPill>
          {surface.sharedOwnerLabel ? <AdminStatusPill tone="blue">المالك: {surface.sharedOwnerLabel}</AdminStatusPill> : null}
            </>
          )}
        />
      )}>
      <div className={ADMIN_FORM_STACK_CLASS_NAME}>

      <AdminFormGrid>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          {sharedOnly ? (
            <div className="rounded-2xl border border-sky-300/16 bg-sky-300/[.05] p-4 text-xs leading-6 text-sky-100/65">
              WhatsApp لا يملك نسخة مستقلة من App ID أو App Secret. عدّل القيم مرة واحدة من <a href="#meta" className="font-semibold text-sky-200 underline underline-offset-4">Meta App owner</a>.
            </div>
          ) : (
            <form onSubmit={submit} className={ADMIN_FORM_STACK_CLASS_NAME} autoComplete="off">
              <AdminFormPendingFields pending={pending !== null}>
              <div className={ADMIN_FORM_STACK_CLASS_NAME}>
              <AdminFormGrid columns={1}>
              {surface.fields.map((field) => (
                <AdminCard key={field.key} presentation="premium" className="p-3">
                  <AdminFormField presentation="panel" hint={field.help} label={(
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    {field.label}
                    <AdminStatusPill tone={field.configured ? "green" : "muted"}>
                      {field.configured ? "محفوظ" : "غير محفوظ"}
                    </AdminStatusPill>
                  </span>
                  )}>
                  <input
                    name={field.key}
                    type={field.secret ? "password" : "text"}
                    defaultValue={field.safeValue ?? ""}
                    placeholder={field.secret && field.configured ? "محفوظ — اكتب قيمة جديدة للاستبدال" : field.placeholder}
                    autoComplete={field.secret ? "new-password" : "off"}
                    spellCheck={false}
                    className={adminFormFieldClassName("font-en")}
                  />
                  </AdminFormField>
                </AdminCard>
              ))}
              </AdminFormGrid>
              <div className="flex flex-wrap gap-2">
                <AdminActionButton
                  type="submit"
                  disabled={!actionsAvailable || pending !== null}
                  variant="primary"
                >
                  {pending === "save" ? "جارٍ الحفظ داخل Vault…" : surface.version ? "حفظ / استبدال" : "حفظ داخل Vault"}
                </AdminActionButton>
                {surface.source === "environment_bootstrap" && surface.version === 0 ? (
                  <AdminActionButton
                    type="button"
                    disabled={!actionsAvailable || pending !== null}
                    onClick={() => void mutate("import_environment")}
                    variant="dark"
                  >
                    {pending === "import_environment" ? "جارٍ النقل…" : "نقل Bootstrap إلى Vault"}
                  </AdminActionButton>
                ) : null}
              </div>
              </div>
              </AdminFormPendingFields>
            </form>
          )}

          <AdminFormGrid columns={1}>
            {surface.callbackUrls.map((callback) => (
              <AdminCard key={callback.integration} presentation="premium" className="p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <AdminFormControlHeader title={`Callback URL — ${callback.label}`} presentation="compact-inline" />
                    <p className="mt-2 break-all font-en text-[11px] leading-5 text-white/62">{callback.url || "Canonical domain غير متاح"}</p>
                  </div>
                  <AdminActionButton
                    type="button"
                    disabled={!callback.url}
                    onClick={() => void copyCallback(callback.integration, callback.url)}
                    variant="dark"
                  >
                    {copied === callback.integration ? "تم النسخ" : "نسخ"}
                  </AdminActionButton>
                </div>
              </AdminCard>
            ))}
          </AdminFormGrid>
        </div>

        <aside>
          <AdminFormSection presentation="panel" header={(
            <AdminModuleSectionHeader
              id={`integration-readiness-${surface.key}`}
              sectionHeading="Readiness وDiagnostics"
              icon="activity"
              sectionHeaderPresentation="premium"
              sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
            />
          )}>
          <div className={ADMIN_FORM_STACK_CLASS_NAME}>
          {surface.validations.map((validation) => (
            <AdminCard key={validation.integration} presentation="premium" className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AdminFormControlHeader title={validation.label} presentation="compact-inline" />
                <AdminStatusPill tone={STATUS_TONES[validation.status]}>{STATUS_LABELS[validation.status]}</AdminStatusPill>
              </div>
              <p className="mt-3 text-[10px] leading-5 text-white/36">آخر فحص: {validation.lastTestedAt ? formatAdminDateTime(validation.lastTestedAt) : "لم يُفحص بعد"}</p>
              {validation.missing.length ? <p className="mt-2 font-en text-[10px] leading-5 text-amber-100/58">Missing: {validation.missing.join(", ")}</p> : null}
              {validation.safeErrorCode ? <p className="mt-2 font-en text-[10px] leading-5 text-rose-100/55">Diagnostic: {validation.safeErrorCode}</p> : null}
              {validation.configured ? (
                <AdminActionButton href={`/admin/settings/integrations/${validation.integration}`} variant="dark" className="mt-3">
                  فتح Connection Wizard
                </AdminActionButton>
              ) : null}
            </AdminCard>
          ))}

          <div className="flex flex-wrap gap-2">
            <AdminActionButton
              type="button"
              disabled={!actionsAvailable || surface.version === 0 || pending !== null}
              onClick={() => void mutate("test")}
              variant="dark"
            >
              {pending === "test" ? "جارٍ الاختبار…" : "اختبار الإعداد"}
            </AdminActionButton>
            {!sharedOnly ? (
              <AdminActionButton
                buttonRef={removeButtonRef}
                type="button"
                disabled={!actionsAvailable || surface.version === 0 || pending !== null}
                onClick={() => setConfirmRemove(true)}
                variant="danger"
              >
                حذف App Configuration
              </AdminActionButton>
            ) : null}
          </div>
          <p className="text-[10px] leading-5 text-white/30">Version {surface.version} · {surface.updatedAt ? `آخر تحديث ${formatAdminDateTime(surface.updatedAt)}` : "لم يُحفظ داخل CMS بعد"}</p>
          {ownerReady ? <p className="text-[10px] leading-5 text-emerald-100/55">الربط متاح فقط للاتصالات التي اجتازت فحص الإعداد الخاص بها.</p> : null}
          </div>
          </AdminFormSection>
        </aside>
      </AdminFormGrid>

      <div className="empty:hidden">
        <AdminFeedbackChannelViewport channel={feedbackChannel} label={`نتيجة إعداد ${surface.label}`} />
      </div>
      </div>
      </AdminFormSection>

      <AdminConfirmDialog
        open={confirmRemove}
        title={`حذف إعداد ${surface.label}؟`}
        description="سيُحذف App Configuration من Vault، وستنتقل الاتصالات التابعة إلى needs_reauth. لا يمكن استعادة Secrets بعد الحذف."
        confirmLabel="حذف من Vault"
        pending={pending === "remove"}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => mutate("remove")}
        returnFocusRef={removeButtonRef}
      />
    </article>
  );
}

export default function IntegrationsServerConfiguration({
  snapshot,
}: {
  snapshot: IntegrationsServerConfigurationSnapshot;
}) {
  const actionsAvailable = snapshot.migrationRegistered && snapshot.vaultAvailable;
  const configuredOwners = snapshot.surfaces.filter((surface) => surface.key !== "whatsapp" && surface.version > 0).length;

  return (
    <AdminPageExperience as="div" className="min-w-0 pb-12" dir="rtl" state={snapshot.state === "ready" ? "ready" : "error"}>
      <AdminPageContextHeader
        visualPreset="integrations"
        eyebrow="INTEGRATIONS OWNER"
        title="إعدادات الربط على السيرفر"
        description="إدارة App-Level Credentials داخل CMS Vault. هذه الإعدادات تفتح OAuth فقط، ولا تملك Connection Tokens أو حالة الاتصال أو بيانات Analytics."
        meta={`${configuredOwners}/4 owners داخل CMS`}
        actions={(
          <AdminActionButton href="/admin/settings/integrations" variant="dark">
            العودة إلى منصة التكاملات
          </AdminActionButton>
        )}
        status={snapshot.state === "ready" ? "ready" : "error"}
      />

      <div role="region" aria-labelledby="configuration-proof-heading">
      <AdminFormSection presentation="panel" header={(
        <AdminModuleSectionHeader
          id="integration-configuration-proof"
          sectionHeading={<span id="configuration-proof-heading">Security وRuntime Proof</span>}
          sectionDescription="Secrets تُكتب وتُستبدل وتُحذف على السيرفر فقط. المتصفح يرى وجود القيمة وحالتها، ولا يستقبل القيمة المحفوظة أو Vault UUID."
          icon="security"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
      )}>
        <div className={ADMIN_FORM_STACK_CLASS_NAME}>
        <AdminFormGrid columns={3}>
          <ProofCard label="Supabase Vault" ready={snapshot.vaultAvailable} value={snapshot.vaultAvailable ? "Server-only RPC access" : "غير متاح"} />
          <ProofCard label="Migration Registry" ready={snapshot.migrationRegistered} value={snapshot.migrationRegistered ? "20260806140000" : "Migration غير مطبقة"} />
          <ProofCard label="Canonical OAuth Origin" ready={Boolean(snapshot.canonicalOrigin)} value={snapshot.canonicalOrigin ?? "غير متاح"} />
        </AdminFormGrid>
        {!actionsAvailable ? <p role="status" className="rounded-2xl border border-amber-300/16 bg-amber-300/[.055] px-4 py-3 text-xs leading-6 text-amber-100/68">الحفظ والاختبار متوقفان fail-closed حتى تتطابق Migration وVault مع Runtime. القيم الحالية لا تُعرض.</p> : null}
        </div>
      </AdminFormSection>
      </div>

      <nav aria-label="الانتقال السريع بين ملاك App Configuration" className="flex flex-wrap gap-2">
        {snapshot.surfaces.map((surface) => <a key={surface.key} href={`#${surface.key}`} className={adminActionButtonClassName({ variant: "dark" })}>{surface.label}</a>)}
      </nav>

      <section aria-label="ملاك App Configuration" className={ADMIN_FORM_STACK_CLASS_NAME}>
        {snapshot.surfaces.map((surface) => <SurfaceCard key={surface.key} surface={surface} actionsAvailable={actionsAvailable} />)}
      </section>
    </AdminPageExperience>
  );
}
