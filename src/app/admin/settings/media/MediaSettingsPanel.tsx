"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminConfirmDialog from "../../../../components/admin/ui/AdminConfirmDialog";
import AdminFormRuntime, {
  AdminFormError,
} from "../../../../components/admin/ui/AdminFormRuntime";
import {
  CMS_IMAGE_EXTENSIONS,
  CMS_PDF_EXTENSIONS,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";
import { getMediaReadinessReasonLabel } from "../../../../lib/admin/media-catalog/readiness";
import type { MediaSettings } from "../../../../lib/admin/media-catalog/settings";
import type { MediaCatalogReadiness } from "../../../../lib/admin/media-catalog/types";
import { updateMediaSettingsAction } from "./actions";
import {
  MEDIA_SETTINGS_ACTION_INITIAL,
  MEDIA_SETTINGS_LIMITS,
} from "./media-settings-action-contract";

type ReconciliationResult = {
  dryRun: boolean;
  previewReliable: boolean;
  complete: boolean;
  storageAssetCount: number;
  catalogAssetCount: number;
  toRegisterCount: number;
  missingObjectCount: number;
  providerCount: number;
  scannedProviderCount: number;
  discoveredReferenceCount: number;
  uncertainties: string[];
  error?: string;
};

const inputClass =
  "h-11 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[var(--admin-accent)]/45";

function formatScanDate(value: string | null) {
  if (!value) return "لم يكتمل فحص بعد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير معروف";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function MediaSettingsPanel({
  settings,
  readiness,
}: {
  settings: MediaSettings;
  readiness: MediaCatalogReadiness;
}) {
  const router = useRouter();
  const { publishFeedback } = useAdminFeedback();
  const [allowedKinds, setAllowedKinds] = useState(settings.allowedKinds);
  const [allowedImageExtensions, setAllowedImageExtensions] = useState(
    settings.allowedImageExtensions,
  );
  const [allowedDocumentExtensions, setAllowedDocumentExtensions] = useState(
    settings.allowedDocumentExtensions,
  );
  const [scanBusy, setScanBusy] = useState<"preview" | "apply" | null>(null);
  const [preview, setPreview] = useState<ReconciliationResult | null>(null);
  const [confirmScan, setConfirmScan] = useState(false);
  const canRunScan =
    readiness.catalogAvailable &&
    readiness.managedStorageAvailable &&
    Boolean(readiness.context.identity);
  const canApplyScan = canRunScan && preview?.previewReliable === true;

  function announce(
    variant: "success" | "danger" | "warning",
    title: string,
    message: string,
  ) {
    publishFeedback(
      {
        variant,
        title,
        message,
        layout: "inline",
        dismissible: true,
        lifecycle: variant === "danger" ? "persistent" : "manual",
      },
      {
        channel: "media-settings-reconciliation",
        critical: variant === "danger",
      },
    );
  }

  function toggleKind(kind: "image" | "document", checked: boolean) {
    setAllowedKinds((current) =>
      checked
        ? [...new Set([...current, kind])]
        : current.filter((item) => item !== kind),
    );
    if (!checked && kind === "image") setAllowedImageExtensions([]);
    if (!checked && kind === "document") setAllowedDocumentExtensions([]);
  }

  function toggleImageExtension(extension: string, checked: boolean) {
    setAllowedImageExtensions((current) =>
      checked
        ? [...new Set([...current, extension])]
        : current.filter((item) => item !== extension),
    );
    if (checked) {
      setAllowedKinds((current) => [...new Set([...current, "image" as const])]);
    }
  }

  function toggleDocumentExtension(extension: string, checked: boolean) {
    setAllowedDocumentExtensions((current) =>
      checked
        ? [...new Set([...current, extension])]
        : current.filter((item) => item !== extension),
    );
    if (checked) {
      setAllowedKinds((current) => [...new Set([...current, "document" as const])]);
    }
  }

  async function runScan(dryRun: boolean) {
    setScanBusy(dryRun ? "preview" : "apply");
    try {
      const response = await fetch("/api/admin/media-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "reconcile", dryRun }),
      });
      const result = (await response.json()) as ReconciliationResult;
      if (!response.ok) {
        throw new Error(result.error || "تعذر تنفيذ فحص مكتبة الوسائط.");
      }
      if (dryRun) {
        setPreview(result);
        announce(
          result.previewReliable ? "success" : "warning",
          result.previewReliable ? "اكتملت معاينة الفحص" : "المعاينة غير مكتملة",
          result.previewReliable
            ? `ستُجهز ${result.toRegisterCount} ملفات للمكتبة، وسيُفحص ${result.discoveredReferenceCount} ارتباطًا.`
            : "تعذر فحص جميع مواضع الارتباط؛ لن تُعامل هذه المعاينة كنتيجة موثوقة.",
        );
      } else {
        setConfirmScan(false);
        setPreview(null);
        announce(
          result.complete ? "success" : "warning",
          result.complete ? "اكتمل الفحص والمزامنة" : "اكتمل الفحص مع عناصر تحتاج مراجعة",
          result.complete
            ? "أصبحت نتائج الاستخدام مرتبطة بالتخزين والبيئة الحاليين."
            : `لم يكتمل فحص ${result.uncertainties.length} حالة؛ ستظل إجراءات الأمان محجوبة.`,
        );
        router.refresh();
      }
    } catch (error) {
      setConfirmScan(false);
      announce(
        "danger",
        "تعذر إكمال الفحص",
        error instanceof Error ? error.message : "حدث خطأ غير معروف.",
      );
    } finally {
      setScanBusy(null);
    }
  }

  return (
    <>
      <section className="admin-premium-card mx-auto mb-6 w-full max-w-6xl space-y-5 rounded-[28px] p-5 sm:p-6 lg:p-8">
        <div>
          <h2 className="text-lg font-semibold text-white">حالة فحص المكتبة</h2>
          <p className="mt-1 text-sm leading-7 text-white/50">
            يطابق الفحص الملفات المُدارة في مكان الحفظ مع سجل المكتبة ومواضع استخدامها.
          </p>
        </div>

        <AdminFeedbackChannelViewport
          channel="media-settings-reconciliation"
          label="نتيجة فحص مكتبة الوسائط"
        />

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs text-white/40">آخر فحص مكتمل</dt>
            <dd className="mt-2 font-semibold text-white">
              {formatScanDate(readiness.lastCompletedScanAt)}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs text-white/40">حالة الفحص</dt>
            <dd className="mt-2 font-semibold text-white">
              {readiness.usageResultsAuthoritative ? "مكتمل" : "غير مكتمل"}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs text-white/40">موثوقية نتائج الاستخدام</dt>
            <dd className="mt-2 font-semibold text-white">
              {readiness.usageResultsAuthoritative ? "موثوقة" : "غير جاهزة للاعتماد"}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs text-white/40">ملفات لم يكتمل فحصها</dt>
            <dd className="mt-2 font-semibold text-white">{readiness.unscannedAssetCount}</dd>
          </div>
        </dl>

        {!readiness.usageResultsAuthoritative ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4">
            <p className="text-sm font-semibold text-amber-100">سبب عدم الجاهزية</p>
            <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-100/70">
              {readiness.reasons.map((reason) => (
                <li key={reason}>• {getMediaReadinessReasonLabel(reason)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            <p className="font-semibold text-white">نتيجة المعاينة</p>
            <p className="mt-2 leading-7">
              {preview.storageAssetCount} ملفًا في مكان الحفظ، {preview.catalogAssetCount} ملفًا
              جاهزًا للإدارة، {preview.toRegisterCount} يحتاج تجهيزًا، و
              {preview.missingObjectCount} غير موجود في مكان الحفظ.
            </p>
            <p className="mt-1 text-xs text-white/42">
              تم فحص {preview.scannedProviderCount} من {preview.providerCount} مصادر ارتباط.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            disabled={!canRunScan || scanBusy !== null}
            onClick={() => void runScan(true)}
            className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/75 disabled:opacity-40"
          >
            {scanBusy === "preview" ? "جارٍ إعداد المعاينة…" : "معاينة الفحص"}
          </button>
          <button
            type="button"
            title={!canApplyScan ? "نفّذ معاينة موثوقة أولًا قبل تطبيق الفحص والمزامنة." : undefined}
            disabled={!canApplyScan || scanBusy !== null}
            onClick={() => setConfirmScan(true)}
            className="rounded-2xl bg-[var(--admin-accent)] px-5 py-3 text-sm font-bold text-[#05070B] disabled:opacity-40"
          >
            تنفيذ الفحص والمزامنة
          </button>
        </div>
      </section>

      <AdminFormRuntime
        action={updateMediaSettingsAction}
        initialState={MEDIA_SETTINGS_ACTION_INITIAL}
        mode="edit"
        entityKey="media-settings"
        className="admin-premium-card mx-auto w-full max-w-6xl space-y-6 rounded-[28px] p-5 sm:p-6 lg:p-8"
      >
        {({ fieldErrors, pending }) => (
          <>
            <div>
              <h2 className="text-lg font-semibold text-white">سياسة رفع الملفات</h2>
              <p className="mt-1 text-sm leading-7 text-white/50">
                تحدد هذه القيم أنواع الملفات وأحجامها المسموح بها عند الرفع من لوحة الإدارة.
              </p>
            </div>

            <AdminFeedbackChannelViewport
              channel="form:media-settings"
              label="نتيجة حفظ إعدادات الميديا"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">أقصى حجم للصورة — MB</span>
                <input
                  name="maxImageMb"
                  type="number"
                  min={MEDIA_SETTINGS_LIMITS.minimumMegabytes}
                  max={MEDIA_SETTINGS_LIMITS.maximumImageMegabytes}
                  required
                  defaultValue={settings.maxImageBytes / 1024 / 1024}
                  aria-invalid={Boolean(fieldErrors.maxImageMb?.length)}
                  aria-describedby={fieldErrors.maxImageMb?.length ? "maxImageMb-error" : undefined}
                  className={`${inputClass} ${fieldErrors.maxImageMb?.length ? "border-red-300/45" : ""}`}
                />
                <AdminFormError name="maxImageMb" className="text-xs font-normal leading-5 text-red-200" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">أقصى حجم للمستند — MB</span>
                <input
                  name="maxDocumentMb"
                  type="number"
                  min={MEDIA_SETTINGS_LIMITS.minimumMegabytes}
                  max={MEDIA_SETTINGS_LIMITS.maximumDocumentMegabytes}
                  required
                  defaultValue={settings.maxDocumentBytes / 1024 / 1024}
                  aria-invalid={Boolean(fieldErrors.maxDocumentMb?.length)}
                  aria-describedby={fieldErrors.maxDocumentMb?.length ? "maxDocumentMb-error" : undefined}
                  className={`${inputClass} ${fieldErrors.maxDocumentMb?.length ? "border-red-300/45" : ""}`}
                />
                <AdminFormError name="maxDocumentMb" className="text-xs font-normal leading-5 text-red-200" />
              </label>
            </div>

            <fieldset
              className={`space-y-5 rounded-2xl border p-4 sm:p-5 ${fieldErrors.allowedKinds?.length ? "border-red-300/35" : "border-white/10"}`}
              aria-describedby={fieldErrors.allowedKinds?.length ? "allowedKinds-error" : undefined}
            >
              <legend className="px-2 text-xs font-semibold text-white/60">الأنواع والامتدادات المسموح بها</legend>
              <div className="flex flex-wrap gap-4">
                {(["image", "document"] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      name="allowedKinds"
                      value={kind}
                      checked={allowedKinds.includes(kind)}
                      onChange={(event) => toggleKind(kind, event.currentTarget.checked)}
                    />
                    {kind === "image" ? "صور" : "مستندات PDF"}
                  </label>
                ))}
              </div>
              <AdminFormError name="allowedKinds" className="text-xs font-normal leading-5 text-red-200" />
              <div
                role="group"
                aria-labelledby="allowed-image-extensions-label"
                aria-describedby={fieldErrors.allowedImageExtensions?.length ? "allowedImageExtensions-error" : undefined}
                className={`rounded-2xl border p-4 ${fieldErrors.allowedImageExtensions?.length ? "border-red-300/30" : "border-white/8"}`}
              >
                <p id="allowed-image-extensions-label" className="mb-3 text-xs font-semibold text-white/45">امتدادات الصور</p>
                <div className="flex flex-wrap gap-3">
                  {CMS_IMAGE_EXTENSIONS.map((extension) => (
                    <label key={extension} className="flex items-center gap-2 text-xs text-white/55">
                      <input
                        type="checkbox"
                        name="allowedImageExtensions"
                        value={extension}
                        checked={allowedImageExtensions.includes(extension)}
                        onChange={(event) => toggleImageExtension(extension, event.currentTarget.checked)}
                      />
                      {extension}
                    </label>
                  ))}
                </div>
                <AdminFormError name="allowedImageExtensions" className="mt-3 text-xs font-normal leading-5 text-red-200" />
              </div>
              <div
                role="group"
                aria-labelledby="allowed-document-extensions-label"
                aria-describedby={fieldErrors.allowedDocumentExtensions?.length ? "allowedDocumentExtensions-error" : undefined}
                className={`rounded-2xl border p-4 ${fieldErrors.allowedDocumentExtensions?.length ? "border-red-300/30" : "border-white/8"}`}
              >
                <p id="allowed-document-extensions-label" className="mb-3 text-xs font-semibold text-white/45">امتدادات المستندات</p>
                <div className="flex flex-wrap gap-3">
                  {CMS_PDF_EXTENSIONS.map((extension) => (
                    <label key={extension} className="flex items-center gap-2 text-xs text-white/55">
                      <input
                        type="checkbox"
                        name="allowedDocumentExtensions"
                        value={extension}
                        checked={allowedDocumentExtensions.includes(extension)}
                        onChange={(event) => toggleDocumentExtension(extension, event.currentTarget.checked)}
                      />
                      {extension}
                    </label>
                  ))}
                </div>
                <AdminFormError name="allowedDocumentExtensions" className="mt-3 text-xs font-normal leading-5 text-red-200" />
              </div>
              <label className="flex items-start gap-2 text-sm leading-6 text-white/70">
                <input type="checkbox" name="mimeVerification" defaultChecked={settings.mimeVerification} className="mt-1" />
                التحقق من أن محتوى الملف يطابق امتداده قبل قبوله
              </label>
            </fieldset>

            <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs leading-6 text-white/42">
              تُطبق التغييرات على عمليات الرفع الجديدة، ولا تعدّل الملفات الموجودة حاليًا.
            </p>

            <div className="flex justify-end border-t border-white/10 pt-5">
              <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--admin-accent)] px-5 py-3 text-sm font-bold text-[#05070B] disabled:opacity-50">
                {pending ? "جارٍ الحفظ…" : "حفظ إعدادات الرفع"}
              </button>
            </div>
          </>
        )}
      </AdminFormRuntime>

      <AdminConfirmDialog
        open={confirmScan}
        title="تنفيذ الفحص والمزامنة؟"
        description="ستتم مطابقة ملفات Supabase Storage مع سجل المكتبة وفحص مواضع الارتباط. لن تُحذف أو تُستبدل أي ملفات."
        confirmLabel="تنفيذ الفحص والمزامنة"
        pending={scanBusy === "apply"}
        onCancel={() => setConfirmScan(false)}
        onConfirm={() => runScan(false)}
      />
    </>
  );
}
