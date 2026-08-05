"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { IntegrationAssetType, IntegrationConnectionStatus, IntegrationSnapshotItem } from "../../../lib/admin/integrations/integrations-contract";
import { AdminConfirmDialog, AdminStatusPill } from "../ui";
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

const LIFECYCLE_STEPS = ["التفويض", "اختيار الأصول", "اختبار الاتصال", "المزامنة الأولى"] as const;

type Operation = "discover" | "select_test_sync" | "test" | "sync" | "disconnect" | "diagnose";

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
  const disconnectButtonRef = useRef<HTMLButtonElement | null>(null);
  const testButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    callbackError ? { tone: "error", message: callbackError } : null,
  );
  const initialSelection = Object.fromEntries(
    item.selectedAssets.map((asset) => [asset.type, asset.id ?? ""]),
  ) as Partial<Record<IntegrationAssetType, string>>;
  const [selection, setSelection] = useState(initialSelection);
  const groups = useMemo(() => {
    const map = new Map<IntegrationAssetType, IntegrationSnapshotItem["availableAssets"]>();
    for (const asset of item.availableAssets) {
      map.set(asset.type, [...(map.get(asset.type) ?? []), asset]);
    }
    return [...map.entries()];
  }, [item.availableAssets]);

  useEffect(() => {
    if (requestedAction === "test") testButtonRef.current?.focus();
  }, [requestedAction]);

  async function execute(operation: Operation, extra?: Record<string, unknown>) {
    if (!item.liveConnectionSupported || pending) return;
    setPending(operation);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/integrations/${item.key}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation, ...(item.connectionId ? { connectionId: item.connectionId } : {}), ...extra }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        result?: { message?: string; code?: string; status?: string };
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "integration_action_failed");
      const diagnostic = operation === "diagnose" && payload.result?.message
        ? `${payload.result.message}${payload.result.code ? ` (${payload.result.code})` : ""}`
        : null;
      setFeedback({ tone: "success", message: diagnostic ?? `${actionLabel(operation)} تم بنجاح.` });
      setConfirmDisconnect(false);
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "integration_action_failed" });
      throw error;
    } finally {
      setPending(null);
    }
  }

  const selectedIds = Object.values(selection).filter((value): value is string => Boolean(value));
  const requiredReady = item.requiredAssetTypes.every((type) => Boolean(selection[type]));
  const canAuthorize = item.liveConnectionSupported && item.missingConfiguration.length === 0;
  const showAssetSelection = groups.length > 0 && ["pending_selection", "testing", "needs_attention"].includes(item.status);
  const progressIndex = ["connected", "syncing"].includes(item.status)
    ? 3
    : item.status === "testing" || item.selectedAssets.length > 0
      ? 2
      : ["discovering_assets", "pending_selection"].includes(item.status) || item.availableAssets.length > 0
        ? 1
        : item.connectionId || ["authorizing", "authorized_unbound"].includes(item.status)
          ? 0
          : -1;

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/settings/integrations" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">
        العودة إلى التكاملات
      </Link>

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/85 p-6 shadow-[0_24px_80px_rgba(0,0,0,.24)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <IntegrationBrandIcon integration={item.key} />
            <div>
              <p className="font-en text-xl font-semibold text-white">{item.label}</p>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/45">{item.description}</p>
            </div>
          </div>
          <AdminStatusPill tone={item.status === "connected" ? "green" : item.status.includes("attention") || item.status === "needs_reauth" ? "red" : "gold"}>
            {STATUS_LABELS[item.status]}
          </AdminStatusPill>
        </div>

        <ol aria-label="مراحل ربط التكامل" className="mt-5 grid gap-2 sm:grid-cols-4">
          {LIFECYCLE_STEPS.map((step, index) => (
            <li key={step} aria-current={index === progressIndex ? "step" : undefined} className={`rounded-xl border px-3 py-2 text-[11px] ${index <= progressIndex ? "border-[#D8B87A]/25 bg-[#D8B87A]/[.08] text-[#E8CF9A]" : "border-white/8 bg-white/[.02] text-white/30"}`}>
              <span className="me-2 font-en">{index + 1}</span>{step}
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] text-white/35">آخر مزامنة</p><p className="mt-2 font-en text-xs text-white/65">{item.lastSyncAt ?? "—"}</p></div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] text-white/35">المزامنة التالية</p><p className="mt-2 font-en text-xs text-white/65">{item.nextSyncAt ?? "—"}</p></div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] text-white/35">الأصول المحددة</p><p className="mt-2 font-en text-xs text-white/65">{item.selectedAssets.length}</p></div>
        </div>

        <p className="mt-5 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs leading-6 text-white/50">{item.message}</p>
        {feedback ? <p role={feedback.tone === "error" ? "alert" : "status"} className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${feedback.tone === "error" ? "border-rose-400/20 bg-rose-400/[.07] text-rose-100" : "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-100"}`}>{feedback.message}</p> : null}
      </section>

      {item.missingConfiguration.length ? (
        <section className="rounded-[24px] border border-amber-300/18 bg-amber-300/[.055] p-5">
          <h2 className="text-sm font-semibold text-amber-100">Server configuration مطلوبة</h2>
          <p className="mt-2 text-xs leading-6 text-amber-100/65">لا يمكن بدء OAuth قبل ضبط App Credentials التالية في بيئة السيرفر:</p>
          <ul className="mt-3 space-y-2 font-en text-xs text-amber-100/80">{item.missingConfiguration.map((name) => <li key={name}>• {name}</li>)}</ul>
        </section>
      ) : null}

      {showAssetSelection ? (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/85 p-6">
          <h2 className="text-lg font-semibold text-white">اختيار أصول Venesia</h2>
          <p className="mt-2 text-xs leading-6 text-white/42">يُسمح بأصل واحد من كل نوع. العلاقات والصلاحيات تُفحص على السيرفر قبل الاختبار.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {groups.map(([type, assets]) => (
              <label key={type} className="block rounded-2xl border border-white/8 bg-white/[.025] p-4">
                <span className="text-xs font-semibold text-white/70">{ASSET_LABELS[type]} {item.requiredAssetTypes.includes(type) ? <span className="text-[#D8B87A]">*</span> : <span className="text-white/30">(اختياري)</span>}</span>
                <select
                  value={selection[type] ?? ""}
                  onChange={(event) => setSelection((current) => ({ ...current, [type]: event.target.value }))}
                  className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-[#0B0E13] px-3 text-xs text-white outline-none focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/15"
                >
                  <option value="">بدون اختيار</option>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.displayName} — {asset.externalId}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!requiredReady || pending !== null}
            onClick={() => void execute("select_test_sync", { assetIds: selectedIds }).catch(() => undefined)}
            className="mt-5 min-h-11 cursor-pointer rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/[.10] px-5 text-xs font-semibold text-[#E8CF9A] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]"
          >
            {pending === "select_test_sync" ? "جارٍ الاختبار والمزامنة…" : "اختبار الاتصال وبدء المزامنة"}
          </button>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/85 p-6">
        <h2 className="text-lg font-semibold text-white">إجراءات الاتصال</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {canAuthorize ? <Link href={`/api/admin/integrations/${item.key}/authorize`} className="inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/[.08] px-5 text-xs font-semibold text-[#E8CF9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]">{item.connectionId ? "إعادة التفويض" : "بدء التفويض"}</Link> : null}
          {item.connectionId && !groups.length ? <button type="button" disabled={pending !== null} onClick={() => void execute("discover").catch(() => undefined)} className="min-h-11 rounded-xl border border-white/12 px-5 text-xs font-semibold text-white/65 disabled:opacity-40">اكتشاف الأصول</button> : null}
          {item.connectionId && item.selectedAssets.length ? <button ref={testButtonRef} type="button" disabled={pending !== null} onClick={() => void execute("test").catch(() => undefined)} className="min-h-11 rounded-xl border border-white/12 px-5 text-xs font-semibold text-white/65 disabled:opacity-40">اختبار الاتصال</button> : null}
          {item.connectionId ? <button type="button" disabled={pending !== null} onClick={() => void execute("diagnose").catch(() => undefined)} className="min-h-11 rounded-xl border border-white/12 px-5 text-xs font-semibold text-white/65 disabled:opacity-40">تشخيص الاتصال</button> : null}
          {item.connectionId && ["connected", "needs_attention"].includes(item.status) ? <button type="button" disabled={pending !== null} onClick={() => void execute("sync").catch(() => undefined)} className="min-h-11 rounded-xl border border-emerald-400/20 px-5 text-xs font-semibold text-emerald-100/75 disabled:opacity-40">مزامنة الآن</button> : null}
          {item.reportsAvailable ? <Link href={item.reportsHref} className="inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/25 px-5 text-xs font-semibold text-[#E8CF9A]">عرض التقارير</Link> : null}
          {item.connectionId ? <button ref={disconnectButtonRef} type="button" disabled={pending !== null} onClick={() => setConfirmDisconnect(true)} className="min-h-11 rounded-xl border border-rose-400/20 px-5 text-xs font-semibold text-rose-200/75 disabled:opacity-40">فصل الاتصال</button> : null}
        </div>
      </section>

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
