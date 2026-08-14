"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type FormEvent,
} from "react";

import type {
  IntegrationAppConfigurationStatus,
  IntegrationAppConfigurationSurfaceSnapshot,
  IntegrationsServerConfigurationSnapshot,
} from "../../../lib/admin/integrations/server-configuration-contract";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminConfirmDialog,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminStatusPill,
} from "../ui";
import IntegrationBrandIcon from "./IntegrationBrandIcon";

type Operation = "save" | "import_environment" | "test" | "remove";
type Feedback = { tone: "success" | "error"; message: string };

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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path d="M12 3 5.5 5.8v5.3c0 4.1 2.6 7.8 6.5 9.9 3.9-2.1 6.5-5.8 6.5-9.9V5.8L12 3Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProofCard({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <article className="rounded-[22px] border border-white/9 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-white/55">{label}</p>
        <span className={`size-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-300"}`} aria-hidden="true" />
      </div>
      <p className="mt-3 break-all font-en text-[11px] leading-5 text-white/38">{value}</p>
    </article>
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
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const sharedOnly = surface.key === "whatsapp";

  async function mutate(operation: Operation, values?: Record<string, string>) {
    if (pending || !actionsAvailable) return;
    setPending(operation);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/integrations/server-configuration/${surface.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation, expectedVersion: surface.version, ...(values ? { values } : {}) }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback({ tone: "error", message: safeFeedbackMessage(payload.error) });
        return;
      }
      const success = operation === "save"
        ? "حُفظ الإعداد داخل Vault دون إعادة أي Secret إلى المتصفح."
        : operation === "import_environment"
          ? "نُقلت قيم Bootstrap إلى CMS Vault بنجاح."
          : operation === "test"
            ? "اكتمل الاختبار الآمن. راجع حالة كل اتصال أدناه."
            : "حُذف App Configuration وأصبحت الاتصالات المتأثرة بحاجة لإعادة التفويض.";
      setFeedback({ tone: "success", message: success });
      setConfirmRemove(false);
      router.refresh();
    } catch {
      setFeedback({ tone: "error", message: "تعذر الوصول إلى Server Configuration owner." });
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
      setFeedback({ tone: "error", message: "تعذر نسخ Callback URL من المتصفح الحالي." });
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
      className="scroll-mt-24 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-bl from-white/[0.045] to-[#080B10]/82 shadow-[0_26px_80px_rgba(0,0,0,.22)]"
    >
      <div className="flex flex-col gap-5 border-b border-white/8 p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <IntegrationBrandIcon integration={SURFACE_ICONS[surface.key]} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-en text-lg font-semibold text-white">{surface.label}</h2>
              <AdminStatusPill tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</AdminStatusPill>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-white/42">{surface.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusPill tone={surface.source === "cms_vault" ? "green" : surface.source === "none" ? "muted" : "gold"}>
            {SOURCE_LABELS[surface.source]}
          </AdminStatusPill>
          {surface.sharedOwnerLabel ? <AdminStatusPill tone="blue">المالك: {surface.sharedOwnerLabel}</AdminStatusPill> : null}
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
        <div>
          {sharedOnly ? (
            <div className="rounded-2xl border border-sky-300/16 bg-sky-300/[.05] p-4 text-xs leading-6 text-sky-100/65">
              WhatsApp لا يملك نسخة مستقلة من App ID أو App Secret. عدّل القيم مرة واحدة من <a href="#meta" className="font-semibold text-sky-200 underline underline-offset-4">Meta App owner</a>.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              {surface.fields.map((field) => (
                <label key={field.key} className="block rounded-2xl border border-white/8 bg-black/15 p-4">
                  <span className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-white/68">
                    {field.label}
                    <span className={`text-[10px] ${field.configured ? "text-emerald-300/70" : "text-white/30"}`}>
                      {field.configured ? "محفوظ" : "غير محفوظ"}
                    </span>
                  </span>
                  <input
                    name={field.key}
                    type={field.secret ? "password" : "text"}
                    defaultValue={field.safeValue ?? ""}
                    placeholder={field.secret && field.configured ? "محفوظ — اكتب قيمة جديدة للاستبدال" : field.placeholder}
                    autoComplete={field.secret ? "new-password" : "off"}
                    spellCheck={false}
                    className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-[#090C11] px-4 font-en text-xs text-white outline-none placeholder:font-[inherit] placeholder:text-white/24 focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/15"
                  />
                  <span className="mt-2 block text-[10px] leading-5 text-white/34">{field.help}</span>
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={!actionsAvailable || pending !== null}
                  className="min-h-11 rounded-xl border border-[#D8B87A]/30 bg-[#D8B87A]/[.08] px-5 text-xs font-semibold text-[#E8CF9A] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
                >
                  {pending === "save" ? "جارٍ الحفظ داخل Vault…" : surface.version ? "حفظ / استبدال" : "حفظ داخل Vault"}
                </button>
                {surface.source === "environment_bootstrap" && surface.version === 0 ? (
                  <button
                    type="button"
                    disabled={!actionsAvailable || pending !== null}
                    onClick={() => void mutate("import_environment")}
                    className="min-h-11 rounded-xl border border-sky-300/18 px-5 text-xs font-semibold text-sky-100/70 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    {pending === "import_environment" ? "جارٍ النقل…" : "نقل Bootstrap إلى Vault"}
                  </button>
                ) : null}
              </div>
            </form>
          )}

          <div className="mt-5 space-y-3">
            {surface.callbackUrls.map((callback) => (
              <div key={callback.integration} className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-white/38">Callback URL — {callback.label}</p>
                    <p className="mt-2 break-all font-en text-[11px] leading-5 text-white/62">{callback.url || "Canonical domain غير متاح"}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!callback.url}
                    onClick={() => void copyCallback(callback.integration, callback.url)}
                    className="min-h-10 shrink-0 rounded-xl border border-white/10 px-4 text-[11px] font-semibold text-white/55 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
                  >
                    {copied === callback.integration ? "تم النسخ" : "نسخ"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Readiness وDiagnostics</h3>
          {surface.validations.map((validation) => (
            <div key={validation.integration} className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-en text-xs font-semibold text-white/68">{validation.label}</p>
                <AdminStatusPill tone={STATUS_TONES[validation.status]}>{STATUS_LABELS[validation.status]}</AdminStatusPill>
              </div>
              <p className="mt-3 text-[10px] leading-5 text-white/36">آخر فحص: {validation.lastTestedAt ? formatAdminDateTime(validation.lastTestedAt) : "لم يُفحص بعد"}</p>
              {validation.missing.length ? <p className="mt-2 font-en text-[10px] leading-5 text-amber-100/58">Missing: {validation.missing.join(", ")}</p> : null}
              {validation.safeErrorCode ? <p className="mt-2 font-en text-[10px] leading-5 text-rose-100/55">Diagnostic: {validation.safeErrorCode}</p> : null}
              {validation.configured ? (
                <Link href={`/admin/settings/integrations/${validation.integration}`} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-[#D8B87A]/22 px-4 text-[11px] font-semibold text-[#E8CF9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
                  فتح Connection Wizard
                </Link>
              ) : null}
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!actionsAvailable || surface.version === 0 || pending !== null}
              onClick={() => void mutate("test")}
              className="min-h-11 rounded-xl border border-emerald-300/18 px-4 text-xs font-semibold text-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {pending === "test" ? "جارٍ الاختبار…" : "اختبار الإعداد"}
            </button>
            {!sharedOnly ? (
              <button
                ref={removeButtonRef}
                type="button"
                disabled={!actionsAvailable || surface.version === 0 || pending !== null}
                onClick={() => setConfirmRemove(true)}
                className="min-h-11 rounded-xl border border-rose-300/18 px-4 text-xs font-semibold text-rose-100/65 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                حذف App Configuration
              </button>
            ) : null}
          </div>
          <p className="text-[10px] leading-5 text-white/30">Version {surface.version} · {surface.updatedAt ? `آخر تحديث ${formatAdminDateTime(surface.updatedAt)}` : "لم يُحفظ داخل CMS بعد"}</p>
          {ownerReady ? <p className="text-[10px] leading-5 text-emerald-100/55">الربط متاح فقط للاتصالات التي اجتازت فحص الإعداد الخاص بها.</p> : null}
        </aside>
      </div>

      {feedback ? (
        <p role={feedback.tone === "error" ? "alert" : "status"} className={`mx-5 mb-5 rounded-2xl border px-4 py-3 text-xs leading-6 ${feedback.tone === "error" ? "border-rose-300/18 bg-rose-300/[.055] text-rose-100/72" : "border-emerald-300/18 bg-emerald-300/[.055] text-emerald-100/72"}`}>
          {feedback.message}
        </p>
      ) : null}

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
    <AdminPageExperience className="min-w-0 pb-12" dir="rtl" state={snapshot.state === "ready" ? "ready" : "error"}>
      <AdminPageContextHeader
        eyebrow="INTEGRATIONS OWNER"
        title="إعدادات الربط على السيرفر"
        description="إدارة App-Level Credentials داخل CMS Vault. هذه الإعدادات تفتح OAuth فقط، ولا تملك Connection Tokens أو حالة الاتصال أو بيانات Analytics."
        meta={`${configuredOwners}/4 owners داخل CMS`}
        actions={(
          <Link href="/admin/settings/integrations" className="inline-flex min-h-11 items-center rounded-xl border border-white/12 px-4 text-xs font-semibold text-white/62 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
            العودة إلى منصة التكاملات
          </Link>
        )}
        status={snapshot.state === "ready" ? "ready" : "error"}
      />

      <section aria-labelledby="configuration-proof-heading" className="rounded-[28px] border border-white/10 bg-gradient-to-bl from-[#D8B87A]/[.055] to-[#080B10]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,.20)]">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-[18px] border border-[#D8B87A]/22 bg-[#D8B87A]/[.07] text-[#D8B87A]"><ShieldIcon /></div>
          <div>
            <h2 id="configuration-proof-heading" className="text-lg font-semibold text-white">Security وRuntime Proof</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-white/42">Secrets تُكتب وتُستبدل وتُحذف على السيرفر فقط. المتصفح يرى وجود القيمة وحالتها، ولا يستقبل القيمة المحفوظة أو Vault UUID.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ProofCard label="Supabase Vault" ready={snapshot.vaultAvailable} value={snapshot.vaultAvailable ? "Server-only RPC access" : "غير متاح"} />
          <ProofCard label="Migration Registry" ready={snapshot.migrationRegistered} value={snapshot.migrationRegistered ? "20260806140000" : "Migration غير مطبقة"} />
          <ProofCard label="Canonical OAuth Origin" ready={Boolean(snapshot.canonicalOrigin)} value={snapshot.canonicalOrigin ?? "غير متاح"} />
        </div>
        {!actionsAvailable ? <p role="status" className="mt-4 rounded-2xl border border-amber-300/16 bg-amber-300/[.055] px-4 py-3 text-xs leading-6 text-amber-100/68">الحفظ والاختبار متوقفان fail-closed حتى تتطابق Migration وVault مع Runtime. القيم الحالية لا تُعرض.</p> : null}
      </section>

      <nav aria-label="الانتقال السريع بين ملاك App Configuration" className="flex flex-wrap gap-2 rounded-[22px] border border-white/8 bg-white/[.025] p-3">
        {snapshot.surfaces.map((surface) => <a key={surface.key} href={`#${surface.key}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/9 px-4 text-[11px] font-semibold text-white/52 hover:border-[#D8B87A]/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">{surface.label}</a>)}
      </nav>

      <section aria-label="ملاك App Configuration" className="space-y-5">
        {snapshot.surfaces.map((surface) => <SurfaceCard key={surface.key} surface={surface} actionsAvailable={actionsAvailable} />)}
      </section>
    </AdminPageExperience>
  );
}
