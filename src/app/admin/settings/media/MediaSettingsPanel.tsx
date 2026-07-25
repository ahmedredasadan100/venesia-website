"use client";

import { useActionState, useEffect, useState } from "react";

import { useAdminFeedback } from "../../../../components/admin/AdminFeedbackProvider";
import {
  CMS_IMAGE_EXTENSIONS,
  CMS_PDF_EXTENSIONS,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";
import type { MediaCatalogRuntimeState } from "../../../../lib/admin/media-catalog/catalog";
import type { MediaSettings } from "../../../../lib/admin/media-catalog/settings";
import {
  MEDIA_SETTINGS_ACTION_INITIAL,
  updateMediaSettingsAction,
} from "./actions";

const inputClass =
  "h-11 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[var(--admin-accent)]/45";

export default function MediaSettingsPanel({
  settings,
  catalogState,
  storage,
}: {
  settings: MediaSettings;
  catalogState: MediaCatalogRuntimeState | null;
  storage: { provider: string; imageBucket: string; documentBucket: string };
}) {
  const [state, formAction, pending] = useActionState(updateMediaSettingsAction, MEDIA_SETTINGS_ACTION_INITIAL);
  const [reconciling, setReconciling] = useState<"dry" | "apply" | null>(null);
  const { publishFeedback } = useAdminFeedback();

  useEffect(() => {
    if (state.status === "idle") return;
    publishFeedback(
      {
        variant: state.status === "success" ? "success" : "danger",
        title: state.status === "success" ? "تم حفظ الإعدادات" : "تعذر حفظ الإعدادات",
        message: state.message,
        layout: "inline",
        dismissible: true,
        lifecycle: state.status === "success" ? "manual" : "persistent",
      },
      { channel: "media-settings", critical: state.status === "error" },
    );
  }, [publishFeedback, state]);

  async function reconcile(dryRun: boolean) {
    setReconciling(dryRun ? "dry" : "apply");
    try {
      const response = await fetch("/api/admin/media-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "reconcile", dryRun }),
      });
      const payload = (await response.json()) as {
        error?: string;
        storageAssetCount?: number;
        discoveredReferenceCount?: number;
        uncertainties?: string[];
      };
      if (!response.ok) throw new Error(payload.error || "تعذر تشغيل reconciliation.");
      publishFeedback(
        {
          variant: payload.uncertainties?.length ? "warning" : "success",
          title: dryRun ? "اكتمل الفحص الجاف" : "اكتملت المزامنة",
          message: `الأصول: ${payload.storageAssetCount ?? 0} — المراجع: ${payload.discoveredReferenceCount ?? 0}${payload.uncertainties?.length ? ` — حالات عدم يقين: ${payload.uncertainties.length}` : ""}`,
          layout: "inline",
          dismissible: true,
          lifecycle: payload.uncertainties?.length ? "persistent" : "manual",
        },
        { channel: "media-settings", critical: Boolean(payload.uncertainties?.length) },
      );
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تشغيل reconciliation",
          message: error instanceof Error ? error.message : "تعذر تشغيل reconciliation.",
          layout: "stacked",
          dismissible: true,
          lifecycle: "persistent",
        },
        { channel: "media-settings", critical: true },
      );
    } finally {
      setReconciling(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form action={formAction} className="admin-premium-card space-y-6 rounded-[28px] p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">سياسة الرفع</h2>
          <p className="mt-1 text-sm leading-7 text-white/50">قيود خادمية يستخدمها Upload owner نفسه؛ الحدود القصوى لا تتجاوز سياسة Storage الحالية.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">أقصى حجم للصورة — MB</span>
            <input name="maxImageMb" type="number" min="1" max="5" defaultValue={settings.maxImageBytes / 1024 / 1024} className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">أقصى حجم للمستند — MB</span>
            <input name="maxDocumentMb" type="number" min="1" max="12" defaultValue={settings.maxDocumentBytes / 1024 / 1024} className={inputClass} />
          </label>
        </div>

        <fieldset className="space-y-3 rounded-2xl border border-white/10 p-4">
          <legend className="px-2 text-xs font-semibold text-white/60">الأنواع والامتدادات</legend>
          <div className="flex flex-wrap gap-4">
            {(["image", "document"] as const).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" name="allowedKinds" value={kind} defaultChecked={settings.allowedKinds.includes(kind)} />
                {kind === "image" ? "صور" : "PDF"}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {CMS_IMAGE_EXTENSIONS.map((extension) => (
              <label key={extension} className="flex items-center gap-2 text-xs text-white/55">
                <input type="checkbox" name="allowedImageExtensions" value={extension} defaultChecked={settings.allowedImageExtensions.includes(extension)} />
                {extension}
              </label>
            ))}
            {CMS_PDF_EXTENSIONS.map((extension) => (
              <label key={extension} className="flex items-center gap-2 text-xs text-white/55">
                <input type="checkbox" name="allowedDocumentExtensions" value={extension} defaultChecked={settings.allowedDocumentExtensions.includes(extension)} />
                {extension}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="mimeVerification" defaultChecked={settings.mimeVerification} />
            التحقق من تطابق MIME مع الامتداد
          </label>
        </fieldset>

        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm leading-7 text-emerald-100/75">
          Collision policy: أسماء فريدة فقط. الحذف: صفر مراجع authoritative. لا يمكن تغيير provider أو bucket أو credentials من الواجهة.
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-semibold text-white/60">سياسة الأبعاد</p><p className="mt-2 text-xs leading-6 text-white/40">يُحتفظ بأبعاد الملف الأصلية وتُسجل عند صيغ الصور المدعومة. لا يرفض Upload أبعادًا بعينها حاليًا.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-semibold text-white/60">الضغط والجودة</p><p className="mt-2 text-xs leading-6 text-white/40">لا يعيد Storage owner ضغط bytes. تستخدم الواجهة `next/image` لتقديم thumbnails محسّنة دون تغيير الأصل.</p></div>
        </div>

        <div className="flex justify-end border-t border-white/10 pt-5">
          <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--admin-accent)] px-5 py-3 text-sm font-bold text-[#05070B] disabled:opacity-50">
            {pending ? "جارٍ الحفظ…" : "حفظ إعدادات الميديا"}
          </button>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="admin-premium-card rounded-[24px] p-5">
          <h2 className="font-semibold text-white">حالة التخزين</h2>
          <dl className="mt-4 space-y-3 text-sm text-white/55">
            <div><dt className="text-white/35">Provider</dt><dd className="font-mono text-white/75">{storage.provider}</dd></div>
            <div><dt className="text-white/35">Images bucket</dt><dd className="font-mono text-white/75">{storage.imageBucket}</dd></div>
            <div><dt className="text-white/35">Documents bucket</dt><dd className="font-mono text-white/75">{storage.documentBucket}</dd></div>
            <div><dt className="text-white/35">Capacity</dt><dd className="text-white/55">غير متاحة من عقد Storage الحالي — لا يتم عرض quota تخمينية.</dd></div>
          </dl>
        </section>

        <section className="admin-premium-card rounded-[24px] p-5">
          <h2 className="font-semibold text-white">Catalog reconciliation</h2>
          <p className={`mt-3 text-sm ${catalogState?.state === "synced" ? "text-emerald-300" : "text-amber-200"}`}>
            {catalogState ? `الحالة: ${catalogState.state}` : "الكتالوج غير متاح في البيئة المتصلة."}
          </p>
          <p className="mt-2 text-xs leading-6 text-white/40">آخر مزامنة: {catalogState?.lastCatalogSync ?? "لم تُنفذ"}</p>
          {catalogState?.warnings.length ? <ul className="mt-3 list-inside list-disc text-xs leading-6 text-amber-200/80">{catalogState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div className="mt-4 grid gap-2">
            <button type="button" disabled={Boolean(reconciling)} onClick={() => void reconcile(true)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 disabled:opacity-50">
              {reconciling === "dry" ? "جارٍ الفحص…" : "Dry Run"}
            </button>
            <button type="button" disabled={Boolean(reconciling)} onClick={() => void reconcile(false)} className="rounded-xl border border-[var(--admin-accent)]/35 bg-[var(--admin-accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--admin-accent)] disabled:opacity-50">
              {reconciling === "apply" ? "جارٍ التصالح…" : "تشغيل Reconciliation"}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
