"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MediaCatalogAsset,
  MediaCatalogPage,
  MediaSmartView,
} from "../../../lib/admin/media-catalog/types";
import { getMediaReadinessReasonLabel } from "../../../lib/admin/media-catalog/readiness";
import {
  CMS_IMAGE_ACCEPT,
  CMS_PDF_ACCEPT,
  validateCmsUploadFile,
} from "../../../lib/admin/media-intelligence/cms-upload-policy";
import { useAdminFeedback } from "../AdminFeedbackProvider";
import AdminConfirmDialog from "../ui/AdminConfirmDialog";
import MediaUsagePanel from "../media-intelligence/MediaUsagePanel";
import MediaNoImage from "./MediaNoImage";

type LibraryMode = "manage" | "select-one" | "select-many";
type KindFilter = "all" | "image" | "document";
type ViewMode = "grid" | "list";
type PageSize = 10 | 20 | 30 | 50 | 100;

type PendingConfirmation =
  | { kind: "delete"; assets: MediaCatalogAsset[] }
  | { kind: "replace"; previous: MediaCatalogAsset; next: MediaCatalogAsset }
  | { kind: "move"; asset: MediaCatalogAsset; targetFolder: string; targetFilename: string }
  | null;
type UploadRow = { name: string; state: "pending" | "uploading" | "complete" | "error"; error?: string };

export type MediaLibraryCoreProps = {
  mode?: LibraryMode;
  initialFolder?: string;
  initialKind?: KindFilter;
  onConfirmSelection?: (paths: string[]) => void;
  onCancelSelection?: () => void;
  className?: string;
};

const SMART_VIEWS: Array<{ id: MediaSmartView; label: string; description: string }> = [
  { id: "all", label: "كل الملفات", description: "كل الملفات المرصودة في المكتبة." },
  { id: "used", label: "قيد الاستخدام", description: "ملفات جاهزة للإدارة ولها مواضع استخدام مؤكدة بعد اكتمال الفحص." },
  { id: "unused", label: "غير مستخدمة", description: "ملفات جاهزة للإدارة ثبت عدم وجود مواضع استخدام لها بعد اكتمال الفحص." },
  { id: "missing_alt", label: "صور بلا وصف افتراضي", description: "صور جاهزة للإدارة لا تحتوي على وصف افتراضي." },
  { id: "missing", label: "غير موجودة في مكان الحفظ", description: "ملفات مسجلة في المكتبة لم يعد أصلها الفعلي موجودًا." },
  { id: "drift", label: "تحتاج تجهيزًا أو مراجعة", description: "ملفات مُدارة لم تكتمل مطابقتها بين مكان الحفظ وسجل المكتبة." },
];

const PAGE_SIZES: PageSize[] = [10, 20, 30, 50, 100];

function formatBytes(value: number | null) {
  if (value == null) return "غير معروف";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "غير معروف" : parsed.toLocaleDateString("ar-EG");
}

function isManaged(asset: MediaCatalogAsset) {
  return asset.catalogRegistered && !asset.id.startsWith("unmanaged:") && asset.provider === "supabase";
}

function referenceCountLabel(value: number | null) {
  return value === null ? "لم يكتمل فحص الارتباطات" : `${value} ارتباط مسجل`;
}

function assetManagementStatus(asset: MediaCatalogAsset) {
  if (asset.missingObject) return "غير موجود في مكان الحفظ";
  if (asset.catalogRegistered) return "جاهز للإدارة";
  if (asset.provider === "filesystem") return "ملف محلي للعرض فقط";
  return "يحتاج تجهيزًا للمكتبة";
}

function AssetPreview({ asset, compact = false }: { asset: MediaCatalogAsset; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (asset.kind !== "image") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#10141C,#05070B)] px-4 text-center">
        <span className="grid h-12 w-10 place-items-center rounded-lg border border-red-300/25 bg-red-300/10 font-en text-xs font-bold text-red-100 shadow-[0_10px_28px_rgba(0,0,0,.28)]">PDF</span>
        {!compact ? <span className="max-w-full truncate text-[10px] text-white/38">مستند قابل للمعاينة</span> : null}
      </div>
    );
  }
  if (failed || asset.missingObject) {
    return <MediaNoImage compact={compact} label={asset.missingObject ? "الأصل مفقود" : "تعذر عرض الصورة"} />;
  }
  return (
    <Image
      src={asset.publicUrl}
      alt={asset.defaultAltText ?? ""}
      fill
      loading="lazy"
      sizes={compact ? "96px" : "(max-width: 640px) 92vw, (max-width: 1280px) 40vw, 220px"}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function PdfDocumentPreview({ asset }: { asset: MediaCatalogAsset }) {
  if (asset.missingObject) return <MediaNoImage label="المستند مفقود" />;
  return (
    <div className="flex h-full min-w-0 flex-col bg-[#05070B]">
      <iframe
        src={`${asset.publicUrl}#page=1&view=FitH&toolbar=0&navpanes=0`}
        title={`معاينة ${asset.displayName}`}
        loading="lazy"
        className="min-h-0 flex-1 border-0 bg-white"
      />
      <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="border-t border-white/10 px-3 py-2 text-center text-xs text-[#D8B87A]">
        فتح المستند كاملًا
      </a>
    </div>
  );
}

export default function MediaLibraryCore({
  mode = "manage",
  initialFolder = "images",
  initialKind = "all",
  onConfirmSelection,
  onCancelSelection,
  className = "",
}: MediaLibraryCoreProps) {
  const { publishFeedback } = useAdminFeedback();
  const [folder, setFolder] = useState<string | null>(initialFolder);
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [smartView, setSmartView] = useState<MediaSmartView>("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [data, setData] = useState<MediaCatalogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [folderDraft, setFolderDraft] = useState("");
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showPhysicalForm, setShowPhysicalForm] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPageNumber(1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadPage = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setError(null);
    const parameters = new URLSearchParams({
      kind,
      view: smartView,
      page: String(pageNumber),
      pageSize: String(pageSize),
    });
    if (folder) parameters.set("folder", folder);
    if (query) parameters.set("q", query);
    try {
      const response = await fetch(`/api/admin/media-library?${parameters}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as MediaCatalogPage & { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل مكتبة الوسائط.");
      setData(payload);
      setSelectedIds((current) => current.filter((id) => payload.assets.some((asset) => asset.id === id)));
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل مكتبة الوسائط.");
      setData(null);
    } finally {
      if (requestControllerRef.current === controller) setLoading(false);
    }
  }, [folder, kind, pageNumber, pageSize, query, smartView]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadPage());
    return () => window.cancelAnimationFrame(frame);
  }, [loadPage]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const selectedAssets = useMemo(
    () => (data?.assets ?? []).filter((asset) => selectedIds.includes(asset.id)),
    [data?.assets, selectedIds],
  );
  const selectionCanBeConfirmed =
    selectedAssets.length > 0 &&
    selectedAssets.every((asset) => asset.status === "active" && !asset.missingObject);
  const focusedAsset = selectedAssets.at(-1) ?? null;
  const selectedAssetsManaged =
    data?.catalogState === "available" && selectedAssets.length > 0 && selectedAssets.every(isManaged);
  const canSafelyDeleteSelectedAssets =
    selectedAssetsManaged && data?.readiness.safeDeleteReady === true;
  const canRebindSelectedAssets =
    selectedAssetsManaged && data?.readiness.usageResultsAuthoritative === true;
  const activeSmartView = SMART_VIEWS.find((item) => item.id === smartView) ?? SMART_VIEWS[0];
  const referenceViewUnavailable =
    folder === null &&
    (smartView === "used" || smartView === "unused") &&
    data?.readiness.usageResultsAuthoritative === false;
  const safeDeleteUnavailableReason = selectedAssets.some((asset) => !isManaged(asset))
    ? "الحذف الآمن متاح فقط للملفات الجاهزة للإدارة في Supabase Storage."
    : data?.readiness.reasons[0]
      ? getMediaReadinessReasonLabel(data.readiness.reasons[0])
      : "لم تكتمل شروط الحذف الآمن بعد.";
  const rootFolders = useMemo(
    () => (data?.folders ?? []).filter((item) => item.parentPath === null),
    [data?.folders],
  );
  const childFolders = useMemo(
    () => folder ? (data?.folders ?? []).filter((item) => item.parentPath === folder) : [],
    [data?.folders, folder],
  );

  function openFolder(nextFolder: string) {
    setFolder(nextFolder);
    setSmartView("all");
    setPageNumber(1);
    setSelectedIds([]);
  }

  function openSmartView(nextView: MediaSmartView) {
    setFolder(null);
    setSmartView(nextView);
    setPageNumber(1);
    setSelectedIds([]);
  }

  function chooseAsset(asset: MediaCatalogAsset) {
    if (mode !== "manage" && (asset.status !== "active" || asset.missingObject)) return;
    setSelectedIds((current) => {
      if (mode === "select-one") return current.includes(asset.id) ? [] : [asset.id];
      return current.includes(asset.id)
        ? current.filter((id) => id !== asset.id)
        : [...current, asset.id];
    });
  }

  function announce(variant: "success" | "danger" | "warning", title: string, message: string) {
    publishFeedback(
      {
        variant,
        title,
        message,
        layout: "inline",
        dismissible: true,
        lifecycle: variant === "danger" ? "persistent" : "manual",
      },
      { channel: "media-library", critical: variant === "danger" },
    );
  }

  async function uploadOne(file: File, targetFolder = folder) {
    const requestedKind = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
    const validation = validateCmsUploadFile(file, requestedKind);
    if (!validation.ok) throw new Error(`${file.name}: ${validation.message}`);
    const body = new FormData();
    body.set("file", file);
    body.set("folder", targetFolder ?? (requestedKind === "pdf" ? "files" : "images"));
    body.set("kind", requestedKind);
    const response = await fetch("/api/admin/media-library", { method: "POST", body });
    const payload = (await response.json()) as { asset?: MediaCatalogAsset; error?: string };
    if (!response.ok || !payload.asset) throw new Error(payload.error || `تعذر رفع ${file.name}.`);
    return payload.asset;
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy("upload");
    setUploadSummary(`0 / ${files.length}`);
    setUploadRows(Array.from(files).map((file) => ({ name: file.name, state: "pending" })));
    let completed = 0;
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      setUploadRows((current) => current.map((row) => row.name === file.name && row.state === "pending" ? { ...row, state: "uploading" } : row));
      try {
        await uploadOne(file);
        completed += 1;
        setUploadRows((current) => current.map((row) => row.name === file.name && row.state === "uploading" ? { ...row, state: "complete" } : row));
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : file.name;
        failures.push(message);
        setUploadRows((current) => current.map((row) => row.name === file.name && row.state === "uploading" ? { ...row, state: "error", error: message } : row));
      }
      setUploadSummary(`${completed} / ${files.length}`);
    }
    setBusy(null);
    await loadPage();
    if (failures.length) {
      announce("warning", "اكتمل الرفع جزئيًا", `نجح ${completed} وفشل ${failures.length}. ${failures[0]}`);
    } else {
      announce("success", "اكتمل الرفع", `تمت إضافة ${completed} ملف إلى المكتبة.`);
    }
  }

  async function createFolder() {
    const displayName = folderDraft.trim();
    const segment = displayName
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `folder-${Date.now()}`;
    if (!displayName || !folder) return;
    setBusy("folder");
    try {
      const nextFolder = `${folder}/${segment}`;
      const response = await fetch("/api/admin/media-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "create_folder", folder: nextFolder, displayName }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر إنشاء المجلد.");
      setFolderDraft("");
      setShowFolderForm(false);
      await loadPage();
      announce("success", "تم إنشاء المجلد", nextFolder);
    } catch (folderError) {
      announce("danger", "تعذر إنشاء المجلد", folderError instanceof Error ? folderError.message : "خطأ غير معروف.");
    } finally {
      setBusy(null);
    }
  }

  async function updateMetadata(formData: FormData) {
    if (!focusedAsset || !isManaged(focusedAsset)) return;
    setBusy("metadata");
    try {
      const response = await fetch("/api/admin/media-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "update_metadata",
          assetId: focusedAsset.id,
          displayName: String(formData.get("displayName") || ""),
          defaultAltText: String(formData.get("defaultAltText") || "") || null,
          defaultTitle: String(formData.get("defaultTitle") || "") || null,
          defaultCaption: String(formData.get("defaultCaption") || "") || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ بيانات الأصل.");
      await loadPage();
      announce("success", "تم حفظ بيانات الأصل", "لم تتغير هوية التخزين أو المراجع.");
    } catch (metadataError) {
      announce("danger", "تعذر حفظ البيانات", metadataError instanceof Error ? metadataError.message : "خطأ غير معروف.");
    } finally {
      setBusy(null);
    }
  }

  async function stageReplacement(file: File | null) {
    if (!file || !focusedAsset || busy) return;
    setBusy("replace-upload");
    try {
      const next = await uploadOne(file, focusedAsset.folderPath);
      setConfirmation({ kind: "replace", previous: focusedAsset, next });
    } catch (replacementError) {
      announce("danger", "تعذر رفع الأصل البديل", replacementError instanceof Error ? replacementError.message : "خطأ غير معروف.");
    } finally {
      setBusy(null);
    }
  }

  async function executeConfirmation() {
    if (!confirmation) return;
    if (confirmation.kind === "delete") {
      setBusy("delete");
      try {
        for (const asset of confirmation.assets) {
          const response = await fetch("/api/admin/media-library", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset: asset.publicUrl }),
          });
          const payload = (await response.json()) as { error?: string; state?: string };
          if (!response.ok) throw new Error(payload.error || `تعذر حذف ${asset.displayName}.`);
        }
        setSelectedIds([]);
        setConfirmation(null);
        await loadPage();
        announce("success", "تم الحذف الآمن", "حُذفت فقط الملفات التي ثبت عدم ارتباطها بأي محتوى.");
      } catch (deleteError) {
        setConfirmation(null);
        announce("danger", "تم منع الحذف", deleteError instanceof Error ? deleteError.message : "تعذر إثبات سلامة الحذف.");
      } finally {
        setBusy(null);
      }
      return;
    }

    if (confirmation.kind === "move") {
      setBusy("move");
      try {
        const response = await fetch("/api/admin/media-library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "move_asset",
            assetId: confirmation.asset.id,
            targetFolder: confirmation.targetFolder,
            targetFilename: confirmation.targetFilename,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "تعذر نقل الأصل أو إعادة تسميته.");
        setConfirmation(null);
        setShowPhysicalForm(false);
        setSelectedIds([]);
        await loadPage();
        announce("success", "اكتملت عملية التخزين", "تغير المسار الفعلي وأعيد ربط المراجع المدعومة.");
      } catch (moveError) {
        setConfirmation(null);
        announce("danger", "لم تكتمل عملية التخزين", `${moveError instanceof Error ? moveError.message : "خطأ غير معروف."} لم يُعلن نجاح جزئي.`);
      } finally {
        setBusy(null);
      }
      return;
    }

    setBusy("replace");
    try {
      const response = await fetch("/api/admin/media-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "replace_all",
          previousAssetId: confirmation.previous.id,
          nextAssetId: confirmation.next.id,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر استبدال المراجع.");
      setConfirmation(null);
      setSelectedIds([confirmation.next.id]);
      await loadPage();
      announce("success", "اكتمل الاستبدال", "أُعيد ربط المراجع المدعومة وبقي الأصل القديم محفوظًا.");
    } catch (replacementError) {
      setConfirmation(null);
      announce("danger", "لم يكتمل الاستبدال", `${replacementError instanceof Error ? replacementError.message : "خطأ غير معروف."} بقي الأصلان محفوظين.`);
    } finally {
      setBusy(null);
    }
  }

  async function copyPublicUrl(asset: MediaCatalogAsset) {
    try {
      await navigator.clipboard.writeText(asset.publicUrl);
      announce("success", "تم نسخ الرابط", asset.displayName);
    } catch {
      announce("warning", "تعذر النسخ التلقائي", "يمكن نسخ الرابط يدويًا من لوحة التفاصيل.");
    }
  }

  const selectionMode = mode !== "manage";
  const canMutate = data?.catalogState === "available";
  const confirmDescription = confirmation?.kind === "replace"
    ? `سيتم تحديث مواضع الاستخدام المدعومة من «${confirmation.previous.displayName}» إلى «${confirmation.next.displayName}». سيبقى الملف القديم محفوظًا.`
    : confirmation?.kind === "move"
      ? `سينتقل الملف إلى ${confirmation.targetFolder}/${confirmation.targetFilename} مع تحديث مواضع الاستخدام المدعومة. لن يعتمد التغيير إذا لم يكتمل كله.`
      : `سيتم فحص ارتباطات ${confirmation?.kind === "delete" ? confirmation.assets.length : 0} ملف قبل الحذف. لن يُحذف أي ملف عند تعذر إثبات سلامة العملية.`;

  return (
    <div className={`min-w-0 w-full max-w-full space-y-4 ${className}`} dir="rtl" data-media-library-mode={mode}>
      {data?.warning ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100" role="status">
          {data.warning}
        </div>
      ) : null}

      <div className="grid min-h-[640px] min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
        <aside className="order-1 min-w-0 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 xl:order-none">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-white">المجلدات</h2>
            {mode === "manage" && folder ? (
              <button type="button" onClick={() => setShowFolderForm((value) => !value)} className="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-[#D8B87A]">+ جديد</button>
            ) : null}
          </div>
          {showFolderForm ? (
            <div className="mt-3 space-y-2">
              <input value={folderDraft} onChange={(event) => setFolderDraft(event.currentTarget.value)} placeholder="اسم المجلد" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" />
              <button type="button" disabled={busy === "folder"} onClick={() => void createFolder()} className="w-full rounded-xl bg-[#D8B87A] px-3 py-2 text-xs font-bold text-[#05070B] disabled:opacity-50">إنشاء داخل {folder}</button>
            </div>
          ) : null}
          <nav className="mt-4 space-y-1" aria-label="مجلدات الوسائط">
            {rootFolders.map((item) => (
              <button key={item.id} type="button" onClick={() => openFolder(item.path)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${folder === item.path ? "bg-[#D8B87A]/14 text-[#D8B87A]" : "text-white/60 hover:bg-white/5"}`}>
                <span>{item.displayName}</span><span className="text-xs text-white/35">{item.totalAssetCount}</span>
              </button>
            ))}
            {childFolders.map((item) => (
              <button key={item.id} type="button" onClick={() => openFolder(item.path)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 pe-6 text-sm text-white/55 hover:bg-white/5">
                <span>⌞ {item.displayName}</span><span className="text-xs text-white/30">{item.totalAssetCount}</span>
              </button>
            ))}
          </nav>
          {mode === "manage" ? <><div className="my-4 h-px bg-white/8" /><h3 className="text-xs font-semibold text-white/48">عروض كل المكتبة</h3><p className="mb-2 mt-1 text-[10px] leading-5 text-white/28">تتجاهل هذه العروض المجلد الحالي وتفحص جميع الملفات.</p><div className="space-y-1">{SMART_VIEWS.map((item) => <button key={item.id} type="button" onClick={() => openSmartView(item.id)} title={item.description} className={`w-full rounded-xl px-3 py-2 text-right text-sm ${folder === null && smartView === item.id ? "bg-white/8 text-white" : "text-white/48 hover:text-white/75"}`}>{item.label}</button>)}</div><Link href="/admin/reports/topics-without-image" className="mt-4 block rounded-xl border border-white/10 px-3 py-2 text-xs leading-5 text-white/55 hover:text-white">تقرير الموضوعات بلا صورة ←</Link></> : null}
        </aside>

        <section className="order-2 min-w-0 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 xl:order-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={Boolean(busy)} className="rounded-xl bg-[#D8B87A] px-4 py-2 text-sm font-bold text-[#05070B] disabled:opacity-50">{busy === "upload" ? `جارٍ الرفع ${uploadSummary ?? ""}` : "رفع ملفات"}</button>
              <input ref={uploadInputRef} type="file" multiple accept={`${CMS_IMAGE_ACCEPT},${CMS_PDF_ACCEPT}`} className="hidden" onChange={(event) => { void uploadFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
              {mode === "manage" && selectedAssets.length ? (
                <button type="button" title={!canSafelyDeleteSelectedAssets ? safeDeleteUnavailableReason : undefined} disabled={!canSafelyDeleteSelectedAssets || Boolean(busy)} onClick={() => setConfirmation({ kind: "delete", assets: selectedAssets })} className="rounded-xl border border-red-300/25 px-4 py-2 text-sm text-red-200 disabled:opacity-40">{canSafelyDeleteSelectedAssets ? `حذف آمن (${selectedAssets.length})` : "الحذف الآمن غير جاهز"}</button>
              ) : null}
              {mode === "manage" && selectedAssets.length === 1 ? <button type="button" title={!canRebindSelectedAssets ? safeDeleteUnavailableReason : undefined} disabled={!canRebindSelectedAssets || Boolean(busy)} onClick={() => setShowPhysicalForm(true)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/65 disabled:opacity-40">نقل / إعادة تسمية</button> : null}
              {selectedAssets.length ? <button type="button" onClick={() => setSelectedIds([])} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/55">مسح التحديد</button> : null}
            </div>
            <div className="flex gap-1 rounded-xl border border-white/10 p-1">
              <button type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/45"}`}>شبكة</button>
              <button type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/45"}`}>قائمة</button>
            </div>
          </div>
          {uploadRows.length ? <div className="mb-4 grid gap-2 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-2">{uploadRows.map((row, index) => <div key={`${row.name}-${index}`} className="min-w-0"><p className="truncate text-xs text-white/65">{row.name}</p><p className={`mt-1 text-[10px] ${row.state === "error" ? "text-red-200" : row.state === "complete" ? "text-emerald-300" : "text-white/35"}`}>{row.state === "pending" ? "في الانتظار" : row.state === "uploading" ? "جارٍ الرفع…" : row.state === "complete" ? "اكتمل" : row.error}</p></div>)}</div> : null}

          <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_170px]">
            <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.currentTarget.value)} placeholder="ابحث بالاسم…" className="h-11 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#D8B87A]/40" />
            <select aria-label="نوع الملف" value={kind} onChange={(event) => { setKind(event.currentTarget.value as KindFilter); setPageNumber(1); }} className="h-11 rounded-2xl border border-white/10 bg-[#080B10] px-3 text-sm text-white outline-none">
              <option value="all">كل الأنواع</option><option value="image">صور</option><option value="document">PDF</option>
            </select>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/38">
            {folder ? folder.split("/").map((segment, index, segments) => {
              const target = segments.slice(0, index + 1).join("/");
              return <button key={target} type="button" onClick={() => openFolder(target)} className="rounded-full border border-white/8 px-2.5 py-1 hover:text-white">{segment}</button>;
            }) : <span className="rounded-full border border-[#D8B87A]/20 bg-[#D8B87A]/8 px-2.5 py-1 text-[#D8B87A]">{activeSmartView.label}</span>}
            <span>— {data?.total ?? 0} نتيجة</span>
          </div>
          {!folder ? <p className="mb-4 text-xs leading-6 text-white/38">{activeSmartView.description}</p> : null}

          {folder && childFolders.length ? <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{childFolders.map((item) => <button key={item.id} type="button" onClick={() => openFolder(item.path)} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-right hover:border-[#D8B87A]/30"><span className="block text-lg text-[#D8B87A]/70">▰</span><span className="mt-2 block truncate text-sm font-semibold text-white">{item.displayName}</span><span className="mt-1 block text-[10px] text-white/35">{item.totalAssetCount} أصل — {formatBytes(item.totalBytes)}</span><span className="mt-1 block text-[10px] text-white/25">{item.directAssetCount} في المستوى الحالي</span></button>)}</div> : null}

          {loading ? <div className="grid h-64 place-items-center text-sm text-white/45" role="status">جارٍ تحميل الملفات…</div> : null}
          {error ? <div className="rounded-2xl border border-red-300/20 bg-red-300/8 p-4 text-sm text-red-100" role="alert">{error}</div> : null}
          {!loading && !error && !data?.assets.length ? <div className="grid h-56 place-items-center px-4 text-center text-sm leading-7 text-white/42">{referenceViewUnavailable ? smartView === "used" ? "عرض الملفات المستخدمة غير جاهز حتى يكتمل فحص مواضع الاستخدام." : "عرض الملفات غير المستخدمة غير جاهز حتى يكتمل فحص مواضع الاستخدام." : "لا توجد ملفات مطابقة داخل هذا العرض."}</div> : null}

          {!loading && data?.assets.length ? (
            <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
              {data.assets.map((asset) => {
                const selected = selectedIds.includes(asset.id);
                const selectable = mode === "manage" || (asset.status === "active" && !asset.missingObject);
                return viewMode === "grid" ? (
                  <article key={asset.id} className={`relative overflow-hidden rounded-2xl border bg-black/25 transition ${selected ? "border-[#D8B87A]/70 ring-1 ring-[#D8B87A]/25" : "border-white/10 hover:border-white/20"}`}>
                    <button type="button" disabled={!selectable} onClick={() => chooseAsset(asset)} className="block w-full text-right disabled:cursor-not-allowed disabled:opacity-45" aria-pressed={selected} title={!selectable ? "هذا الملف غير متاح للاختيار أثناء مراجعة حالته." : undefined}>
                      <span className="absolute end-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-md border border-white/40 bg-black/55 text-xs text-white">{selected ? "✓" : ""}</span>
                      <div className="relative h-36"><AssetPreview asset={asset} /></div>
                      <div className="space-y-1 p-3">
                        <p className="truncate text-sm font-semibold text-white">{asset.displayName}</p>
                        <p className="flex justify-between gap-2 text-[11px] text-white/38"><span>{formatBytes(asset.sizeBytes)}</span><span>{referenceCountLabel(asset.referenceCount)}</span></p>
                        {!asset.catalogRegistered || asset.missingObject ? <p className={`text-[10px] ${asset.missingObject ? "text-amber-200" : "text-white/35"}`}>{assetManagementStatus(asset)}</p> : null}
                      </div>
                    </button>
                    <button type="button" onClick={() => void copyPublicUrl(asset)} className="absolute bottom-2 end-2 rounded-lg px-2 py-1 text-xs text-white/45 hover:bg-white/8 hover:text-white" aria-label={`نسخ رابط ${asset.displayName}`}>⧉</button>
                  </article>
                ) : (
                  <button key={asset.id} type="button" disabled={!selectable} onClick={() => chooseAsset(asset)} aria-pressed={selected} title={!selectable ? "هذا الملف غير متاح للاختيار أثناء مراجعة حالته." : undefined} className={`grid w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-2 text-right disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-[#D8B87A]/60 bg-[#D8B87A]/6" : "border-white/8 bg-black/20"}`}>
                    <span className="relative h-14 overflow-hidden rounded-xl"><AssetPreview asset={asset} compact /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{asset.displayName}</span><span className="block truncate text-[11px] text-white/35" dir="ltr">{asset.objectKey}</span></span>
                    <span className="text-xs text-white/40">{formatBytes(asset.sizeBytes)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {data ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4" aria-label="صفحات الأصول">
              <p className="text-xs text-white/45">إجمالي النتائج: <span className="font-semibold text-white">{data.total}</span></p>
              <label className="flex items-center gap-2 text-xs text-white/45">
                <span>حجم الصفحة</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.currentTarget.value) as PageSize); setPageNumber(1); }} className="h-9 rounded-xl border border-white/10 bg-[#080B10] px-3 text-xs text-white outline-none">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-3">
                <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 disabled:opacity-30">السابق</button>
                <span className="text-xs text-white/40">صفحة {pageNumber} من {Math.max(1, data.totalPages)}</span>
                <button type="button" disabled={pageNumber >= Math.max(1, data.totalPages)} onClick={() => setPageNumber((value) => value + 1)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 disabled:opacity-30">التالي</button>
              </div>
            </div>
          ) : null}

          {selectionMode ? (
            <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#080B10]/95 pt-4 backdrop-blur">
              <span className="text-sm text-white/50">تم تحديد {selectedAssets.length}</span>
              <div className="flex gap-2"><button type="button" onClick={onCancelSelection} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60">إلغاء</button><button type="button" disabled={!selectionCanBeConfirmed} onClick={() => onConfirmSelection?.(selectedAssets.map((asset) => asset.publicUrl))} className="rounded-xl bg-[#D8B87A] px-5 py-2 text-sm font-bold text-[#05070B] disabled:opacity-40">تأكيد الاختيار</button></div>
            </div>
          ) : null}
        </section>

        <aside className="order-3 min-w-0 space-y-4 xl:order-none">
          {selectedAssets.length > 1 ? (
            <section className="rounded-[24px] border border-[#D8B87A]/20 bg-[#080B10]/92 p-5"><h2 className="font-semibold text-white">تحديد متعدد</h2><p className="mt-2 text-3xl font-semibold text-[#D8B87A]">{selectedAssets.length}</p><p className="mt-1 text-sm text-white/45">الحجم الإجمالي: {formatBytes(selectedAssets.reduce((total, asset) => total + (asset.sizeBytes ?? 0), 0))}</p><p className="mt-4 text-xs leading-6 text-white/35">يمكن تنفيذ الحذف الآمن كملخص واحد؛ يُفحص كل أصل منفردًا ويفشل الإجراء عند أول حالة غير آمنة.</p><button type="button" onClick={() => setSelectedIds([])} className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60">مسح التحديد</button></section>
          ) : !focusedAsset ? (
            data ? (
              <section className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-5">
                <h2 className="font-semibold text-white">ملخص مكتبة الوسائط</h2>
                <p className="mt-2 text-xs leading-5 text-white/40">الأرقام التالية محسوبة من مجموعة الملفات نفسها التي تعرضها المكتبة.</p>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">إجمالي الملفات</dt><dd className="mt-1 text-lg font-semibold text-white">{data.summary.assetCount}</dd></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">المجلدات</dt><dd className="mt-1 text-lg font-semibold text-white">{data.summary.folderCount}</dd></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">الصور</dt><dd className="mt-1 text-lg font-semibold text-white">{data.summary.imageCount}</dd></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">المستندات</dt><dd className="mt-1 text-lg font-semibold text-white">{data.summary.documentCount}</dd></div>
                  <div className="col-span-2 rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">حجم الملفات المعروضة</dt><dd className="mt-1 text-lg font-semibold text-white">{formatBytes(data.summary.totalBytes)}</dd><p className="mt-1 text-[10px] text-white/28">{data.summary.managedStorageAssetCount} ملف مُدار{data.summary.readOnlyAssetCount ? ` — ${data.summary.readOnlyAssetCount} محلي للعرض فقط` : ""}{data.summary.unknownSizeCount ? ` — حجم ${data.summary.unknownSizeCount} غير معروف` : ""}</p></div>
                  <div className="col-span-2 rounded-xl border border-white/8 bg-black/20 p-3"><dt className="text-white/38">أكبر ملف معروض</dt><dd className="mt-1 break-words font-semibold text-white">{data.summary.largestAsset?.displayName ?? "لا يوجد"}</dd><p className="mt-1 text-[10px] text-white/30">{data.summary.largestAsset ? `${formatBytes(data.summary.largestAsset.sizeBytes)} — ${data.summary.largestAsset.folderPath}` : "—"}</p></div>
                </dl>
                <dl className="mt-4 grid gap-2 border-t border-white/8 pt-4 text-xs text-white/45 sm:grid-cols-2">
                  <div><dt>ملفات جاهزة للإدارة</dt><dd className="mt-1 font-semibold text-white">{data.summary.catalogRegisteredCount}</dd></div>
                  <div><dt>تحتاج تجهيزًا للمكتبة</dt><dd className="mt-1 font-semibold text-white">{data.summary.unreconciledAssetCount}</dd></div>
                  <div><dt>لم يكتمل فحص الارتباطات</dt><dd className="mt-1 font-semibold text-white">{data.summary.usageUnknownCount}</dd></div>
                  <div><dt>غير موجودة في مكان الحفظ</dt><dd className="mt-1 font-semibold text-white">{data.summary.missingObjectCount}</dd></div>
                </dl>
              </section>
            ) : (
              <section className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-5"><h2 className="font-semibold text-white">تفاصيل الأصل</h2><p className="mt-2 text-sm leading-6 text-white/42">حدد أصلًا لعرض هويته، بياناته، ومراجع الاستخدام.</p></section>
            )
          ) : (
            <>
              <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#080B10]/92">
                <div className={focusedAsset.kind === "document" ? "h-72" : "relative h-48"}>{focusedAsset.kind === "document" ? <PdfDocumentPreview asset={focusedAsset} /> : <AssetPreview asset={focusedAsset} />}</div>
                <div className="space-y-3 p-5">
                  <div><h2 className="break-words font-semibold text-white">{focusedAsset.displayName}</h2><p className="mt-1 break-all font-mono text-[10px] text-white/35" dir="ltr">{focusedAsset.objectKey}</p><p className="mt-2 text-[10px] text-[#D8B87A]/70">{assetManagementStatus(focusedAsset)}</p></div>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-white/45"><div><dt>الحجم</dt><dd className="text-white/70">{formatBytes(focusedAsset.sizeBytes)}</dd></div><div><dt>تاريخ الإضافة</dt><dd className="text-white/70">{formatDate(focusedAsset.createdAt)}</dd></div><div><dt>النوع</dt><dd className="break-all text-white/70">{focusedAsset.extension} / {focusedAsset.mimeType ?? "غير معروف"}</dd></div><div><dt>الأبعاد</dt><dd className="text-white/70">{focusedAsset.kind === "document" ? "مستند PDF" : focusedAsset.width && focusedAsset.height ? `${focusedAsset.width} × ${focusedAsset.height}` : "غير معروفة"}</dd></div><div><dt>أضيف بواسطة</dt><dd className="text-white/70">{focusedAsset.uploadedBy ?? "غير معروف"}</dd></div><div><dt>حالة الملف</dt><dd className="text-white/70">{assetManagementStatus(focusedAsset)}</dd></div><div><dt>الاستخدام</dt><dd className="text-white/70">{focusedAsset.referenceCount === null ? "يعرض الفحص المباشر أدناه" : `${focusedAsset.referenceCount} ارتباط مسجل`}</dd></div><div><dt>المجلد</dt><dd className="break-all text-white/70">{focusedAsset.folderPath}</dd></div></dl>
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copyPublicUrl(focusedAsset)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">نسخ الرابط</button><a href={focusedAsset.publicUrl} download target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">تنزيل</a></div>
                </div>
              </section>
              {mode === "manage" ? (
                <section className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-5">
                  <h2 className="font-semibold text-white">البيانات الوصفية</h2>
                  <form key={focusedAsset.id} action={(formData) => void updateMetadata(formData)} className="mt-4 space-y-3">
                    <input name="displayName" defaultValue={focusedAsset.displayName} aria-label="اسم العرض" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" />
                    {focusedAsset.kind === "image" ? <><input name="defaultAltText" defaultValue={focusedAsset.defaultAltText ?? ""} placeholder="النص البديل الافتراضي" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" /><input name="defaultTitle" defaultValue={focusedAsset.defaultTitle ?? ""} placeholder="العنوان الافتراضي" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" /><textarea name="defaultCaption" defaultValue={focusedAsset.defaultCaption ?? ""} placeholder="التعليق" className="min-h-20 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none" /></> : null}
                    <button type="submit" disabled={!isManaged(focusedAsset) || busy === "metadata"} className="w-full rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-3 py-2 text-sm font-semibold text-[#D8B87A] disabled:opacity-40">حفظ البيانات</button>
                  </form>
                  <div className="mt-4 border-t border-white/8 pt-4"><button type="button" disabled={!canMutate || !data?.readiness.usageResultsAuthoritative || !isManaged(focusedAsset) || Boolean(busy)} onClick={() => replacementInputRef.current?.click()} className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 disabled:opacity-40">{busy === "replace-upload" ? "جارٍ رفع بديل جديد…" : "رفع بديل ثم استبدال كل المراجع"}</button><input ref={replacementInputRef} type="file" accept={focusedAsset.kind === "image" ? CMS_IMAGE_ACCEPT : CMS_PDF_ACCEPT} className="hidden" onChange={(event) => { void stageReplacement(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} /><p className="mt-2 text-[10px] leading-5 text-white/35">يتطلب الاستبدال فحص ارتباطات مكتملًا، ويبقى الأصل القديم محفوظًا.</p></div>
                  {showPhysicalForm ? <form key={`move-${focusedAsset.id}`} action={(formData) => {
                    const targetFolder = String(formData.get("targetFolder") || "").trim();
                    const targetFilename = String(formData.get("targetFilename") || "").trim();
                    if (targetFolder && targetFilename) setConfirmation({ kind: "move", asset: focusedAsset, targetFolder, targetFilename });
                  }} className="mt-4 space-y-2 border-t border-white/8 pt-4"><p className="text-xs font-semibold text-white/60">تغيير المجلد أو اسم الملف</p><input name="targetFolder" defaultValue={focusedAsset.folderPath} aria-label="مجلد الوجهة" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 font-mono text-xs text-white outline-none" dir="ltr" /><input name="targetFilename" defaultValue={focusedAsset.objectKey.split("/").at(-1)} aria-label="اسم الملف الفعلي الجديد" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 font-mono text-xs text-white outline-none" dir="ltr" /><div className="flex gap-2"><button type="button" onClick={() => setShowPhysicalForm(false)} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55">إلغاء</button><button type="submit" className="flex-1 rounded-xl border border-[#D8B87A]/30 px-3 py-2 text-xs font-semibold text-[#D8B87A]">مراجعة العملية</button></div></form> : null}
                </section>
              ) : null}
              <MediaUsagePanel assetPath={focusedAsset.publicUrl} />
            </>
          )}
        </aside>
      </div>

      <AdminConfirmDialog
        open={confirmation !== null}
        title={confirmation?.kind === "replace" ? "استبدال كل المراجع المدعومة؟" : confirmation?.kind === "move" ? "تنفيذ تغيير فعلي لمسار التخزين؟" : "حذف الأصول المحددة؟"}
        description={confirmDescription}
        confirmLabel={confirmation?.kind === "replace" ? "تأكيد الاستبدال" : confirmation?.kind === "move" ? "تأكيد النقل / التسمية" : "فحص ثم حذف"}
        pending={busy === "delete" || busy === "replace" || busy === "move"}
        onCancel={() => setConfirmation(null)}
        onConfirm={executeConfirmation}
      />
    </div>
  );
}
