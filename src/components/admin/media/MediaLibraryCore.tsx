"use client";

import { readMediaDeleteResults } from "../../../lib/admin/media-catalog/delete-saga";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MediaCatalogAsset,
  MediaCatalogPage,
  MediaDeleteEligibility,
  MediaSmartView,
  MediaReferenceRecord,
} from "../../../lib/admin/media-catalog/types";
import {
  applyAdminEntityUrlPatch,
  type AdminEntityFilterDef,
} from "../../../lib/admin/entity-list";
import { getMediaReadinessReasonPresentation } from "../../../lib/admin/media-catalog/readiness";
import {
  CMS_IMAGE_ACCEPT,
  CMS_PDF_ACCEPT,
  validateCmsUploadFile,
  resolveCmsUploadKind,
  resolveCmsUploadFolder,
  isCmsUploadFolderCompatible,
  type CmsUploadValidationPolicy,
} from "../../../lib/admin/media-intelligence/cms-upload-policy";
import { formatAdminDateTime } from "../../../lib/content-dates";
import {
  AdminFeedbackChannelViewport,
  useAdminFeedback,
} from "../AdminFeedbackProvider";
import AdminEntityListFilters from "../entity-list/AdminEntityListFilters";
import AdminListboxSelect from "../ui/AdminListboxSelect";
import AdminConfirmDialog from "../ui/AdminConfirmDialog";
import AdminTablePagination from "../ui/AdminTablePagination";
import MediaUsagePanel from "../media-intelligence/MediaUsagePanel";
import MediaNoImage from "./MediaNoImage";
import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../../venesia-scrollbar-styles";

type LibraryMode = "manage" | "select-one" | "select-many";
type KindFilter = "all" | "image" | "document";
type ViewMode = "grid" | "list";
type PageSize = 10 | 20 | 30 | 50 | 100;

type PendingConfirmation =
  | { kind: "delete"; assets: MediaCatalogAsset[]; folder?: string | null; phase: "checking" | "ready" | "failed"; checks: MediaDeleteEligibility[]; results: { name: string; deleted: boolean; error?: string }[]; total?: number; error?: string }
  | { kind: "replace"; previous: MediaCatalogAsset; next: MediaCatalogAsset }
  | { kind: "move"; assets: MediaCatalogAsset[]; targetFolder: string; targetFilename?: string; previews: MovePreview[] }
  | null;
type MovePreview = { id: string; asset?: MediaCatalogAsset; targetObjectKey?: string; references?: MediaReferenceRecord[]; error?: string | null };
type MoveResult = { id: string; name: string; success: boolean; error?: string };

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
const TOPIC_MEDIA_CATALOG_SYNC_STORAGE_KEY = "venisia:admin:topic-media-catalog-sync";
const MEDIA_LIBRARY_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "kind",
    paramKey: "kind",
    label: "نوع الملف",
    type: "single_select",
    allValue: "all",
    placeholder: "نوع الملف",
    options: [
      { value: "image", label: "صور" },
      { value: "document", label: "PDF" },
    ],
  },
];

function formatBytes(value: number | null) {
  if (value == null) return "غير معروف";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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
  const searchParams = useSearchParams();
  const pickerKind = mode === "manage" ? null : initialKind === "document" ? "pdf" : "image";
  const safeDeleteStatusId = useId();
  const { clearFeedback, publishFeedback } = useAdminFeedback();
  const [folder, setFolder] = useState<string | null>(() =>
    mode === "manage"
      ? (searchParams.get("folder") ?? (searchParams.has("view") ? null : initialFolder))
      : resolveCmsUploadFolder(initialFolder, pickerKind ?? "image"),
  );
  const [kind, setKind] = useState<KindFilter>(() => {
    const value = mode === "manage" ? searchParams.get("kind") : null;
    return pickerKind ? (pickerKind === "pdf" ? "document" : "image")
      : value === "image" || value === "document" ? value : initialKind;
  });
  const [smartView, setSmartView] = useState<MediaSmartView>(() =>
    mode === "manage"
      ? (SMART_VIEWS.find((item) => item.id === searchParams.get("view"))?.id ?? "all")
      : "all",
  );
  const [query, setQuery] = useState(() =>
    mode === "manage" ? (searchParams.get("q") ?? "") : "",
  );
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [data, setData] = useState<MediaCatalogPage | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [folderDraft, setFolderDraft] = useState("");
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showPhysicalForm, setShowPhysicalForm] = useState(false);
  const [moveFolder, setMoveFolder] = useState("images");
  const [moveResults, setMoveResults] = useState<MoveResult[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const libraryRootRef = useRef<HTMLDivElement>(null);
  const deleteConfirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const moveConfirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const replacementConfirmationTriggerRef = useRef<HTMLButtonElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const refreshFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== "manage") return;
    function syncFromHistory() {
      const parameters = new URLSearchParams(window.location.search);
      const nextQuery = parameters.get("q") ?? "";
      const rawKind = parameters.get("kind");
      const nextKind = rawKind === "image" || rawKind === "document" ? rawKind : "all";
      setQuery(nextQuery);
      setKind(nextKind);
      setFolder(parameters.get("folder") ?? (parameters.has("view") ? null : initialFolder));
      setSmartView(SMART_VIEWS.find((item) => item.id === parameters.get("view"))?.id ?? "all");
      setPageNumber(1);
      setSelectedIds([]);
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [initialFolder, mode]);

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
    if (folder) {
      parameters.set("folder", folder);
      parameters.set("folderScope", "direct");
    }
    if (query) parameters.set("q", query);
    try {
      const response = await fetch(`/api/admin/media-library?${parameters}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as MediaCatalogPage & { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل مكتبة الوسائط.");
      setData(payload);
      setDataRevision((current) => current + 1);
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
  }, [loadPage, refreshRevision]);

  useEffect(() => {
    const scheduleLibraryRefresh = () => {
      if (refreshFrameRef.current !== null) return;
      refreshFrameRef.current = window.requestAnimationFrame(() => {
        refreshFrameRef.current = null;
        void loadPage();
      });
    };
    const refreshVisibleLibrary = () => {
      if (document.visibilityState === "hidden") return;
      scheduleLibraryRefresh();
    };
    const refreshAfterTopicSave = (event: StorageEvent) => {
      if (event.key !== TOPIC_MEDIA_CATALOG_SYNC_STORAGE_KEY || !event.newValue) return;
      scheduleLibraryRefresh();
    };
    window.addEventListener("focus", refreshVisibleLibrary);
    document.addEventListener("visibilitychange", refreshVisibleLibrary);
    window.addEventListener("storage", refreshAfterTopicSave);
    return () => {
      window.removeEventListener("focus", refreshVisibleLibrary);
      document.removeEventListener("visibilitychange", refreshVisibleLibrary);
      window.removeEventListener("storage", refreshAfterTopicSave);
      if (refreshFrameRef.current !== null) window.cancelAnimationFrame(refreshFrameRef.current);
      refreshFrameRef.current = null;
    };
  }, [loadPage]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const selectedAssets = useMemo(
    () => (data?.assets ?? []).filter((asset) => selectedIds.includes(asset.id)),
    [data?.assets, selectedIds],
  );
  const selectionCanBeConfirmed =
    selectedAssets.length > 0 &&
    selectedAssets.every((asset) => asset.status === "active" && !asset.missingObject
      && (!pickerKind || asset.kind === (pickerKind === "pdf" ? "document" : "image")));
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
  const safeDeleteReadinessMessages = useMemo(() => {
    if (!selectedAssets.length || canSafelyDeleteSelectedAssets) return [];

    if (!selectedAssetsManaged) {
      if (selectedAssets.some((asset) => asset.provider === "filesystem")) {
        return [{
          label: "الأصل محفوظ محليًا للعرض فقط ولا يخضع للحذف المُدار.",
          action: "استخدم أصلًا جاهزًا للإدارة من Supabase Storage.",
          actionHref: null,
        }];
      }
      if (selectedAssets.some((asset) => !asset.catalogRegistered)) {
        return [{
          label: "الأصل غير مسجل داخل Media Catalog.",
          action: "افتح إعدادات الميديا، ثم استخدم «معاينة الفحص»، وبعد نجاحها استخدم «تنفيذ الفحص والمزامنة».",
          actionHref: "/admin/settings/media" as const,
        }];
      }
      return [{
        label: "الحذف الآمن متاح فقط للملفات الجاهزة للإدارة في Supabase Storage.",
        action: "راجع حالة الأصل ومكان حفظه قبل إعادة المحاولة.",
        actionHref: null,
      }];
    }

    const readinessReasons = data?.readiness.reasons ?? [];
    if (readinessReasons.length) {
      return readinessReasons.map(getMediaReadinessReasonPresentation);
    }
    return [{
      label: "لم تكتمل شروط الحذف الآمن بعد.",
      action: "افتح إعدادات الميديا لمراجعة حالة الفحص والمزامنة.",
      actionHref: "/admin/settings/media" as const,
    }];
  }, [canSafelyDeleteSelectedAssets, data?.readiness.reasons, selectedAssets, selectedAssetsManaged]);
  const safeDeleteUnavailableReason = safeDeleteReadinessMessages
    .map((item) => item.label)
    .join(" ");

  const availableFolders = (data?.folders ?? []).filter((item) =>
    !pickerKind || isCmsUploadFolderCompatible(item.path, pickerKind));

  const childFolders = useMemo(
    () => folder ? (data?.folders ?? []).filter((item) => item.parentPath === folder
      && (!pickerKind || isCmsUploadFolderCompatible(item.path, pickerKind))) : [],
    [data?.folders, folder, pickerKind],
  );

  function updateLibraryHistory(patch: Record<string, string | null>, behavior: "push" | "replace" = "push") {
    if (mode !== "manage") return;
    const next = applyAdminEntityUrlPatch(new URLSearchParams(window.location.search), patch);
    const nextQuery = next.toString();
    window.history[behavior === "replace" ? "replaceState" : "pushState"](
      window.history.state,
      "",
      window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash,
    );
  }

  function openFolder(nextFolder: string) {
    if (pickerKind && !isCmsUploadFolderCompatible(nextFolder, pickerKind)) return;
    updateLibraryHistory({ folder: nextFolder, view: null });
    setFolder(nextFolder);
    setSmartView("all");
    setPageNumber(1);
    setSelectedIds([]);
  }

  function openSmartView(nextView: MediaSmartView) {
    updateLibraryHistory({ folder: null, view: nextView });
    setFolder(null);
    setSmartView(nextView);
    setPageNumber(1);
    setSelectedIds([]);
  }

  function chooseAsset(asset: MediaCatalogAsset) {
    if (pickerKind && asset.kind !== (pickerKind === "pdf" ? "document" : "image")) return;
    if (mode !== "manage" && (asset.status !== "active" || asset.missingObject)) return;
    setSelectedIds((current) => {
      if (mode === "select-one") return current.includes(asset.id) ? [] : [asset.id];
      return current.includes(asset.id)
        ? current.filter((id) => id !== asset.id)
        : [...current, asset.id];
    });
  }

  function announce(variant: "success" | "danger" | "warning", title: string, message: string) {
    clearFeedback("media-library");
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
        channel: "media-library",
        critical: variant === "danger",
        placement: "inline",
        reveal: variant === "danger",
      },
    );
  }

  async function uploadOne(file: File, targetFolder = folder) {
    const requestedKind = pickerKind ?? resolveCmsUploadKind(file.name, file.type);
    // Read the runtime policy for every upload, including an already-open picker.
    const policyResponse = await fetch("/api/admin/media-library?policy=upload", { cache: "no-store" });
    const policyPayload = (await policyResponse.json()) as { uploadPolicy?: CmsUploadValidationPolicy; error?: string };
    if (!policyResponse.ok || !policyPayload.uploadPolicy) {
      throw new Error(policyPayload.error || "تعذر قراءة إعدادات رفع الملفات. حاول مجددًا.");
    }
    const validation = validateCmsUploadFile(file, requestedKind, policyPayload.uploadPolicy);
    if (!validation.ok) throw new Error(`${file.name}: ${validation.message}`);
    const prepared = await fetch("/api/admin/media-library", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "prepare_upload", file: { name: file.name, type: file.type, size: file.size },
        folder: resolveCmsUploadFolder(targetFolder, requestedKind), kind: requestedKind }),
    });
    const upload = (await prepared.json()) as { signedUrl?: string; receipt?: string; error?: string };
    if (!prepared.ok || !upload.signedUrl || !upload.receipt) throw new Error(upload.error || `تعذر تجهيز رفع ${file.name}.`);
    const body = new FormData();
    body.set("cacheControl", "3600");
    body.set("", file);
    const transferred = await fetch(upload.signedUrl, { method: "PUT", body });
    if (!transferred.ok) throw new Error(`تعذر نقل ${file.name} إلى التخزين. تحقق من الاتصال وحد التخزين ثم حاول مجددًا.`);
    const response = await fetch("/api/admin/media-library", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "complete_upload", receipt: upload.receipt }),
    });
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
    const uploadedFolders = new Set<string>();
    const uploadDestination = folder; // Capture the destination for the entire batch.
    setQuery("");
    setPageNumber(1);
    updateLibraryHistory({ q: null }, "replace");
    for (const file of Array.from(files)) {
      setUploadRows((current) => current.map((row) => row.name === file.name && row.state === "pending" ? { ...row, state: "uploading" } : row));
      try {
        const asset = await uploadOne(file, uploadDestination);
        uploadedFolders.add(asset.folderPath);
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
    if (uploadedFolders.size === 1 && !uploadedFolders.has(folder ?? "")) {
      openFolder([...uploadedFolders][0]);
      if (mode === "manage") {
        setKind("all");
        updateLibraryHistory({ kind: null }, "replace");
      }
    } else if (uploadedFolders.size > 1) {
      openSmartView("all");
      setKind("all");
      updateLibraryHistory({ kind: null }, "replace");
    }
    setRefreshRevision((current) => current + 1);
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

  async function previewDelete(assets: MediaCatalogAsset[], targetFolder?: string | null) {
    setConfirmation({ kind: "delete", assets, folder: targetFolder, phase: "checking", checks: [], results: [] });
    setBusy("delete-preview");
    try {
      const response = await fetch("/api/admin/media-library", { method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(120_000), body: JSON.stringify({ operation: "preview_delete", ...(targetFolder ? { folder: targetFolder } : { assets: assets.map(asset => asset.publicUrl) }) }) });
      const payload = await response.json() as { assets: MediaCatalogAsset[]; checks: MediaDeleteEligibility[]; folder: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر فحص الاستخدامات.");
      setConfirmation({ kind: "delete", assets: payload.assets, folder: payload.folder, phase: "ready", checks: payload.checks, results: [] });
    } catch (error) {
      setConfirmation({ kind: "delete", assets, folder: targetFolder, phase: "failed", checks: [], results: [], error: error instanceof Error ? error.message : "تعذر فحص الاستخدامات." });
    } finally { setBusy(null); }
  }

  async function executeConfirmation() {
    const activeConfirmation = confirmation;
    if (!activeConfirmation) return;
    if (activeConfirmation.kind === "delete") {
      if (activeConfirmation.phase === "failed") return previewDelete(activeConfirmation.assets, activeConfirmation.folder);
      if (activeConfirmation.phase !== "ready") return;
      setBusy("delete");
      const results: { name: string; deleted: boolean; error?: string }[] = [];
      const remaining: MediaCatalogAsset[] = [];

      let folderError: string | undefined;
      const catalogWarnings: string[] = [];
      try {
        const outcomes = new Map<string, { name: string; deleted: boolean; error?: string }>();
        const receive = (publicUrl: string, deleted: boolean, error?: string) => {
          const asset = activeConfirmation.assets.find(item => item.publicUrl === publicUrl);
          if (!asset || outcomes.has(publicUrl)) return;
          outcomes.set(publicUrl, { name: asset.displayName, deleted, error });
          results.push(outcomes.get(publicUrl)!);
          if (deleted) {
            setData(current => current ? { ...current, assets: current.assets.filter(item => item.id !== asset.id) } : current);
            setSelectedIds(current => current.filter(id => id !== asset.id));
          } else remaining.push(asset);
          setConfirmation({ ...activeConfirmation, total: activeConfirmation.assets.length, results: [...results] });
        };
        // Share preflight and refresh in bounded batches; stream settled results.
        for (let start = 0; start < activeConfirmation.assets.length; start += 100) {
          const batch = activeConfirmation.assets.slice(start, start + 100);
          try {
            const response = await fetch("/api/admin/media-library", { method: "DELETE", headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(300_000),
              body: JSON.stringify({ assets: batch.map(asset => ({ asset: asset.publicUrl,
                confirmReferenced: activeConfirmation.checks.some(check => check.state === "in_use" && check.asset.id === asset.id) })) }) });
            catalogWarnings.push(...await readMediaDeleteResults(response, event => receive(event.asset, event.deleted, event.error)));
            for (const asset of batch) if (!outcomes.has(asset.publicUrl)) receive(asset.publicUrl, false, "لم تصل نتيجة مؤكدة؛ أعد الفحص قبل المحاولة.");
          } catch (error) {
            for (const asset of batch) if (!outcomes.has(asset.publicUrl)) receive(asset.publicUrl, false,
              error instanceof Error ? error.message : "تعذر إكمال الحذف؛ أعد الفحص.");
          }
        }
        if (activeConfirmation.folder && remaining.length === 0) {
          try {
            const response = await fetch("/api/admin/media-library", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operation: "delete_folder", folder: activeConfirmation.folder }) });
            const payload = await response.json() as { error?: string };
            if (!response.ok) throw new Error(payload.error || "تعذر إنهاء حذف المجلد.");
          } catch (error) { folderError = error instanceof Error ? error.message : "تعذر إنهاء حذف المجلد."; }
        }
        setSelectedIds(remaining.map(asset => asset.id));
        await loadPage();
        const deleted = results.filter(result => result.deleted).length;
        if (remaining.length || folderError) {
          setConfirmation({ ...activeConfirmation, assets: remaining, phase: "failed", total: activeConfirmation.assets.length, results, error: folderError });
          announce("danger", "نتيجة الحذف", `تم حذف ${deleted}؛ تعذر حذف ${remaining.length}. ${folderError ?? "راجع أسباب الفشل في نافذة الحذف."}`);
        } else {
          setConfirmation(null);
          if (activeConfirmation.folder) openFolder(activeConfirmation.folder.split("/").slice(0, -1).join("/"));
          announce(catalogWarnings.length ? "warning" : "success", "تم الحذف", `تم حذف ${deleted} ملف${activeConfirmation.folder ? " والمجلد" : ""}. تبقى بيانات الصفوف والمراجع السابقة محفوظة كأصول محذوفة، ويمكن حفظ التعديلات واختيار بدائل.${catalogWarnings.length ? " تعذر تحديث جاهزية المكتبة: " + catalogWarnings.join("، ") : ""}`);
        }
      } finally { setBusy(null); }
      return;
    }

    if (activeConfirmation.kind === "move") {
      setBusy("move");
      const results: MoveResult[] = [];
      const catalogWarnings: string[] = [];
      try {
        // One independent request at a time: no shared rollback or bulk timeout.
        for (const asset of activeConfirmation.assets) {
          try {
            const response = await fetch("/api/admin/media-library", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "move_asset", assetId: asset.id, targetFolder: activeConfirmation.targetFolder, ...(activeConfirmation.targetFilename === undefined ? {} : { targetFilename: activeConfirmation.targetFilename }) }) });
            const payload = await response.json() as { error?: string; code?: string; catalogWarnings?: string[] };
            if (!response.ok) throw new Error(payload.code === "UNSUPPORTED_REFERENCE_OWNER" ? payload.code : payload.error || "تعذر النقل.");
            catalogWarnings.push(...(payload.catalogWarnings ?? []));
            results.push({ id: asset.id, name: asset.displayName, success: true });
          } catch (error) { results.push({ id: asset.id, name: asset.displayName, success: false, error: error instanceof Error ? error.message : "تعذر إثبات نتيجة النقل؛ أعد تحميل المكتبة قبل المحاولة." }); }
          setMoveResults([...results]);
        }
        const failed = results.filter(result => !result.success);
        setSelectedIds(failed.map(result => result.id));
        setConfirmation(null);
        setShowPhysicalForm(failed.length > 0);
        await loadPage();
        announce(failed.length || catalogWarnings.length ? "warning" : "success", "نتيجة نقل الصور", "نجح " + (results.length - failed.length) + " وفشل " + failed.length + (failed.length ? ". بقيت الصور الفاشلة محددة لإعادة المحاولة فقط." : ".") + (catalogWarnings.length ? " يلزم تحديث جاهزية المكتبة: " + catalogWarnings.join("، ") : ""));
      } finally { setBusy(null); }
      return;
    }

    setBusy("replace");
    try {
      const response = await fetch("/api/admin/media-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "replace_all",
          previousAssetId: activeConfirmation.previous.id,
          nextAssetId: activeConfirmation.next.id,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر استبدال المراجع.");
      setConfirmation(null);
      setSelectedIds([activeConfirmation.next.id]);
      await loadPage();
      announce("success", "اكتمل الاستبدال", "أُعيد ربط المراجع المدعومة وبقي الأصل القديم محفوظًا.");
    } catch (replacementError) {
      announce("danger", "لم يكتمل الاستبدال", `${replacementError instanceof Error ? replacementError.message : "خطأ غير معروف."} بقي الأصلان محفوظين.`);
      throw replacementError;
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
  const relocationRenames = confirmation?.kind === "move" && confirmation.assets.length === 1 &&
    Boolean(confirmation.targetFilename && confirmation.targetFilename !== confirmation.assets[0].objectKey.split("/").at(-1));
  const relocationMoves = confirmation?.kind === "move" && confirmation.assets.some(asset => asset.folderPath !== confirmation.targetFolder);
  const relocationLabel = relocationRenames ? (relocationMoves ? "تأكيد النقل وإعادة التسمية" : "تأكيد إعادة التسمية") : "تأكيد النقل";
  const confirmDescription = confirmation?.kind === "replace"
    ? `سيتم تحديث مواضع الاستخدام المدعومة من «${confirmation.previous.displayName}» إلى «${confirmation.next.displayName}». سيبقى الملف القديم محفوظًا.`
    : confirmation?.kind === "move"
      ? `تم تحديد ${confirmation.assets.length} صور؛ ${confirmation.previews.filter(item => (item.references?.length ?? 0) > 0).length} مستخدمة، وسيتم تحديث ${confirmation.previews.reduce((sum, item) => sum + (item.references?.length ?? 0), 0)} مراجع تلقائيًا عند المتابعة. الوجهة: ${confirmation.targetFolder}. راجع المسارات والاستخدامات لكل صورة.`
      : confirmation?.kind === "delete" && confirmation.phase === "checking" ? "جارٍ فحص الاستخدامات الحالية…"
      : "راجع الملفات ومواضع استخدامها. الحذف نهائي؛ تُحفظ بيانات الصفوف ومراجعها كأصول محذوفة لا تظهر للزوار ولا تمنع حفظ التعديلات.";

  return (
    <div
      ref={libraryRootRef}
      tabIndex={-1}
      className={`min-w-0 w-full max-w-full space-y-4 ${className}`}
      dir="rtl"
      data-media-library-mode={mode}
    >
      <AdminFeedbackChannelViewport
        channel="media-library"
        label="نتيجة إجراءات مكتبة الوسائط"
      />

      {data?.warning ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100" role="status">
          {data.warning}
        </div>
      ) : null}

      <div className="grid min-h-[640px] min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
        <aside className="order-1 min-w-0 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 xl:order-none">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-white">المجلدات</h2>
            <button type="button" disabled={loading || Boolean(busy)} onClick={() => setRefreshRevision((current) => current + 1)} className="text-xs text-[#D8B87A] disabled:opacity-40">تحديث المجلدات</button>
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
          {pickerKind ? <p className="mt-3 text-xs leading-6 text-white/50">{pickerKind === "image" ? "تظهر مجلدات الصور فقط. أنشئ مجلدات الصور داخل الصور من مكتبة الوسائط." : "تظهر مجلدات المستندات فقط."}</p> : null}
          <nav className="mt-4 space-y-1" aria-label="مجلدات الوسائط">
            {availableFolders.map((item) => (
              <button
                key={item.id}
                type="button"
                data-media-folder-path={item.path}
                disabled={Boolean(busy)}
                aria-current={folder === item.path ? "page" : undefined}
                onClick={() => openFolder(item.path)}
                style={{ paddingInlineStart: `${0.75 + Math.min(item.path.split("/").length - 1, 5) * 0.75}rem` }}
                className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${folder === item.path ? "bg-[#D8B87A]/14 text-[#D8B87A]" : "text-white/60 hover:bg-white/5"}`}
              >
                <span className="min-w-0 break-words text-start">{item.parentPath ? "⌞ " : ""}{item.displayName}</span>
                <span className="shrink-0 text-xs text-white/35">{item.totalAssetCount}</span>
              </button>
            ))}
          </nav>
          {mode === "manage" ? <><div className="my-4 h-px bg-white/8" /><h3 className="text-xs font-semibold text-white/48">عروض كل المكتبة</h3><p className="mb-2 mt-1 text-[10px] leading-5 text-white/28">تتجاهل هذه العروض المجلد الحالي وتفحص جميع الملفات.</p><div className="space-y-1">{SMART_VIEWS.map((item) => <button key={item.id} type="button" disabled={Boolean(busy)} onClick={() => openSmartView(item.id)} title={item.description} className={`w-full rounded-xl px-3 py-2 text-right text-sm ${folder === null && smartView === item.id ? "bg-white/8 text-white" : "text-white/48 hover:text-white/75"}`}>{item.label}</button>)}</div><Link href="/admin/reports/topics-without-image" className="mt-4 block rounded-xl border border-white/10 px-3 py-2 text-xs leading-5 text-white/55 hover:text-white">تقرير الموضوعات بلا صورة ←</Link></> : null}
        </aside>

        <section className="order-2 min-w-0 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 xl:order-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={Boolean(busy)} className="rounded-xl bg-[#D8B87A] px-4 py-2 text-sm font-bold text-[#05070B] disabled:opacity-50">{busy === "upload" ? `جارٍ الرفع ${uploadSummary ?? ""}` : "رفع ملفات"}</button>
              <input ref={uploadInputRef} type="file" multiple accept={pickerKind === "image" ? CMS_IMAGE_ACCEPT : pickerKind === "pdf" ? CMS_PDF_ACCEPT : `${CMS_IMAGE_ACCEPT},${CMS_PDF_ACCEPT}`} className="hidden" onChange={(event) => { void uploadFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
            </div>
            <div className="flex gap-1 rounded-xl border border-white/10 p-1">
              <button type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/45"}`}>شبكة</button>
              <button type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/45"}`}>قائمة</button>
            </div>
          </div>
          {mode === "manage" && folder?.includes("/") ? <button type="button" disabled={Boolean(busy) || !data?.readiness.safeDeleteReady} onClick={() => void previewDelete([], folder)} className="mb-3 rounded-xl border border-red-300/25 px-3 py-2 text-sm text-red-200 disabled:opacity-40">حذف المجلد</button> : null}
          <AdminEntityListFilters
            basePath="/admin/media-library"
            search={{
              value: query,
              placeholder: "ابحث بالاسم أو المسار أو الوصف البديل…",
              debounceMs: 350,
            }}
            filters={pickerKind ? [] : MEDIA_LIBRARY_FILTERS}
            values={{ kind }}
            contextOverrideActive={selectedAssets.length > 0}
            contextOverride={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-white/58">تم تحديد {selectedAssets.length}</span>
                {mode === "manage" && selectedAssets.length ? (
                  <button ref={deleteConfirmationTriggerRef} type="button" aria-describedby={!canSafelyDeleteSelectedAssets ? safeDeleteStatusId : undefined} title={!canSafelyDeleteSelectedAssets ? safeDeleteUnavailableReason : undefined} disabled={!canSafelyDeleteSelectedAssets || Boolean(busy)} onClick={() => void previewDelete(selectedAssets)} className="rounded-xl border border-red-300/25 px-3 py-2 text-sm text-red-200 disabled:opacity-40">{canSafelyDeleteSelectedAssets ? `حذف آمن (${selectedAssets.length})` : "الحذف الآمن غير جاهز"}</button>
                ) : null}
                {mode === "manage" && selectedAssets.length > 0 && selectedAssets.every(asset => asset.kind === "image") ? <button type="button" title={!canRebindSelectedAssets ? safeDeleteUnavailableReason : undefined} disabled={!canRebindSelectedAssets || Boolean(busy)} onClick={() => { setMoveFolder(selectedAssets[0].folderPath); setMoveResults([]); setShowPhysicalForm(true); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 disabled:opacity-40">{selectedAssets.length === 1 ? "نقل / إعادة تسمية" : "نقل إلى…"}</button> : null}
                <button type="button" onClick={() => setSelectedIds([])} className="ms-auto rounded-xl border border-white/10 px-3 py-2 text-sm text-white/55">مسح التحديد</button>
              </div>
            }
            onQueryPatch={(patch, behavior = "push") => {
              updateLibraryHistory(patch, behavior);
              if (Object.hasOwn(patch, "q")) setQuery(patch.q ?? "");
              if (!pickerKind && Object.hasOwn(patch, "kind")) {
                const nextKind = patch.kind;
                setKind(nextKind === "image" || nextKind === "document" ? nextKind : "all");
              }
              setPageNumber(1);
              setSelectedIds([]);
            }}
            className="mt-4"
          />

          {mode === "manage" && selectedAssets.length > 0 && !canSafelyDeleteSelectedAssets ? (
            <div id={safeDeleteStatusId} className="rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-xs leading-6 text-amber-50" role="status">
              <p className="font-semibold text-amber-100">الحذف الآمن متوقف لحماية الملفات.</p>
              <ul className="mt-1 space-y-2">
                {safeDeleteReadinessMessages.map((item) => (
                  <li key={`${item.label}:${item.action}`}>
                    <p><span className="font-semibold">السبب:</span> {item.label}</p>
                    <p>
                      <span className="font-semibold">الإجراء المطلوب:</span> {item.action}{" "}
                      {item.actionHref ? (
                        <Link href={item.actionHref} className="font-semibold text-[#D8B87A] underline decoration-[#D8B87A]/40 underline-offset-4 hover:text-[#E7CC98]">
                          فتح إعدادات الميديا
                        </Link>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {uploadRows.length ? <div className="mb-4 grid gap-2 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-2">{uploadRows.map((row, index) => <div key={`${row.name}-${index}`} className="min-w-0"><p className="truncate text-xs text-white/65">{row.name}</p><p className={`mt-1 text-[10px] ${row.state === "error" ? "text-red-200" : row.state === "complete" ? "text-emerald-300" : "text-white/35"}`}>{row.state === "pending" ? "في الانتظار" : row.state === "uploading" ? "جارٍ الرفع…" : row.state === "complete" ? "اكتمل" : row.error}</p></div>)}</div> : null}

          {folder ? <div className="mb-3 rounded-xl border border-[#D8B87A]/20 bg-[#D8B87A]/5 p-3 text-xs text-white/65" data-media-upload-destination={folder}>
            <span>المجلد الحالي ووجهة الرفع: </span><bdi dir="ltr">{folder}</bdi>
            {folder.includes("/") ? <button type="button" disabled={Boolean(busy)} onClick={() => openFolder(folder.split("/").slice(0, -1).join("/"))} className="ms-3 text-[#D8B87A]">المجلد الأعلى</button> : null}
            <p className="mt-1 text-white/40">تُعرض ملفات هذا المجلد فقط. ادخل مجلدًا فرعيًا لعرض ملفاته أو الرفع داخله.</p>
          </div> : null}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/38" aria-label="مسار المجلد">
            {folder ? folder.split("/").map((segment, index, segments) => {
              const target = segments.slice(0, index + 1).join("/");
              return <button key={target} type="button" disabled={Boolean(busy)} onClick={() => openFolder(target)} className="rounded-full border border-white/8 px-2.5 py-1 hover:text-white">{segment}</button>;
            }) : <span className="rounded-full border border-[#D8B87A]/20 bg-[#D8B87A]/8 px-2.5 py-1 text-[#D8B87A]">{activeSmartView.label}</span>}
            <span>— {data?.total ?? 0} نتيجة</span>
          </div>
          {!folder ? <p className="mb-4 text-xs leading-6 text-white/38">{activeSmartView.description}</p> : null}

          {folder && childFolders.length ? <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{childFolders.map((item) => <button key={item.id} type="button" disabled={Boolean(busy)} onClick={() => openFolder(item.path)} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-right hover:border-[#D8B87A]/30"><span className="block text-lg text-[#D8B87A]/70">▰</span><span className="mt-2 block truncate text-sm font-semibold text-white">{item.displayName}</span><span className="mt-1 block text-[10px] text-white/35">{item.totalAssetCount} أصل — {formatBytes(item.totalBytes)}</span><span className="mt-1 block text-[10px] text-white/25">{item.directAssetCount} في المستوى الحالي</span></button>)}</div> : null}

          {loading ? <div className="grid h-64 place-items-center text-sm text-white/45" role="status">جارٍ تحميل الملفات…</div> : null}
          {error ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-300/8 p-4 text-sm text-red-100"
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadPage()}
                className="rounded-xl border border-red-100/25 px-3 py-2 font-semibold text-red-50 transition hover:border-red-100/45 hover:bg-red-100/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}
              </button>
            </div>
          ) : null}
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
            <AdminTablePagination
              basePath="/admin/media-library"
              currentPage={pageNumber}
              totalPages={Math.max(1, data.totalPages)}
              totalCount={data.total}
              pageSize={String(pageSize)}
              pageSizeOptions={PAGE_SIZES.map(String)}
              emptySummaryText="لا توجد أصول مطابقة"
              className="mt-5"
              onPageChange={(nextPage) => {
                setPageNumber(nextPage);
                setSelectedIds([]);
              }}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize as PageSize);
                setPageNumber(1);
                setSelectedIds([]);
              }}
            />
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
            <section className="rounded-[24px] border border-[#D8B87A]/20 bg-[#080B10]/92 p-5"><h2 className="font-semibold text-white">تحديد متعدد</h2><p className="mt-2 text-3xl font-semibold text-[#D8B87A]">{selectedAssets.length}</p><p className="mt-1 text-sm text-white/45">الحجم الإجمالي: {formatBytes(selectedAssets.reduce((total, asset) => total + (asset.sizeBytes ?? 0), 0))}</p><p className="mt-4 text-xs leading-6 text-white/35">تُعرض استخدامات الملفات قبل التأكيد، ثم تظهر نتيجة كل ملف. لا يمنع فشل ملف إكمال بقية الدفعة.</p><button type="button" onClick={() => setSelectedIds([])} className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60">مسح التحديد</button></section>
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
                  <dl className="grid grid-cols-2 gap-2 text-xs text-white/45"><div><dt>الحجم</dt><dd className="text-white/70">{formatBytes(focusedAsset.sizeBytes)}</dd></div><div><dt>تاريخ الإضافة</dt><dd className="text-white/70">{formatAdminDateTime(focusedAsset.createdAt)}</dd></div><div><dt>النوع</dt><dd className="break-all text-white/70">{focusedAsset.extension} / {focusedAsset.mimeType ?? "غير معروف"}</dd></div><div><dt>الأبعاد الأصلية</dt><dd className="text-white/70">{focusedAsset.kind === "document" ? "مستند PDF" : focusedAsset.width && focusedAsset.height ? `${focusedAsset.width} × ${focusedAsset.height}` : "غير معروفة"}</dd></div><div><dt>أضيف بواسطة</dt><dd className="text-white/70">{focusedAsset.uploadedBy ?? "غير معروف"}</dd></div><div><dt>حالة الملف</dt><dd className="text-white/70">{assetManagementStatus(focusedAsset)}</dd></div><div><dt>الاستخدام</dt><dd className="text-white/70">{focusedAsset.referenceCount === null ? "يعرض الفحص المباشر أدناه" : `${focusedAsset.referenceCount} ارتباط مسجل`}</dd></div><div><dt>المجلد</dt><dd className="break-all text-white/70">{focusedAsset.folderPath}</dd></div></dl>
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copyPublicUrl(focusedAsset)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">نسخ الرابط</button><a href={focusedAsset.publicUrl} download target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">تنزيل</a></div>
                </div>
              </section>
              {mode === "manage" ? (
                <section className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-5">
                  <h2 className="font-semibold text-white">البيانات الوصفية</h2>
                  <form key={focusedAsset.id} onSubmit={(event) => {
                    event.preventDefault();
                    void updateMetadata(new FormData(event.currentTarget));
                  }} className="mt-4 space-y-3">
                    <input name="displayName" defaultValue={focusedAsset.displayName} aria-label="اسم العرض" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" />
                    {focusedAsset.kind === "image" ? <><input name="defaultAltText" defaultValue={focusedAsset.defaultAltText ?? ""} placeholder="النص البديل الافتراضي" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" /><input name="defaultTitle" defaultValue={focusedAsset.defaultTitle ?? ""} placeholder="العنوان الافتراضي" className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none" /><textarea name="defaultCaption" defaultValue={focusedAsset.defaultCaption ?? ""} placeholder="التعليق" className="min-h-20 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none" /></> : null}
                    <button type="submit" disabled={!isManaged(focusedAsset) || busy === "metadata"} className="w-full rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-3 py-2 text-sm font-semibold text-[#D8B87A] disabled:opacity-40">حفظ البيانات</button>
                  </form>
                  <div className="mt-4 border-t border-white/8 pt-4"><button ref={replacementConfirmationTriggerRef} type="button" disabled={!canMutate || !data?.readiness.usageResultsAuthoritative || !isManaged(focusedAsset) || Boolean(busy)} onClick={() => replacementInputRef.current?.click()} className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 disabled:opacity-40">{busy === "replace-upload" ? "جارٍ رفع بديل جديد…" : "رفع بديل ثم استبدال كل المراجع"}</button><input ref={replacementInputRef} type="file" accept={focusedAsset.kind === "image" ? CMS_IMAGE_ACCEPT : CMS_PDF_ACCEPT} className="hidden" onChange={(event) => { void stageReplacement(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} /><p className="mt-2 text-[10px] leading-5 text-white/35">يتطلب الاستبدال فحص ارتباطات مكتملًا، ويبقى الأصل القديم محفوظًا.</p></div>

                </section>
              ) : null}
              <MediaUsagePanel assetPath={focusedAsset.publicUrl} refreshToken={dataRevision} />
            </>
          )}
        </aside>
      </div>


      {showPhysicalForm && mode === "manage" && selectedAssets.length > 0 ? <form data-media-relocation-form="" key={selectedAssets.map(asset => asset.id).join(",")} onSubmit={async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const targetFilename = selectedAssets.length === 1 ? String(formData.get("targetFilename") ?? "") : undefined;
        setBusy("move-preview");
        try {
          const response = await fetch("/api/admin/media-library", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "preview_move", assetIds: selectedAssets.map(asset => asset.id), targetFolder: moveFolder, ...(targetFilename === undefined ? {} : { targetFilename }) }) });
          const payload = await response.json() as { error?: string; previews: MovePreview[] };
          if (!response.ok) throw new Error(payload.error || "تعذر فحص النقل.");
          setConfirmation({ kind: "move", assets: [...selectedAssets], targetFolder: moveFolder, targetFilename, previews: payload.previews });
        } catch (error) { announce("danger", "تعذر فحص النقل", error instanceof Error ? error.message : "أعد المحاولة."); }
        finally { setBusy(null); }
      }} className="space-y-3 rounded-2xl border border-white/10 p-4">
        <p className="font-semibold">{selectedAssets.length === 1 ? "نقل / إعادة تسمية الصورة" : "نقل الصور المحددة"}</p>
        <AdminListboxSelect value={moveFolder} onChange={setMoveFolder} ariaLabel="مجلد الوجهة" disabled={Boolean(busy)} searchable sizing="full" options={(data?.folders ?? []).filter(item => isCmsUploadFolderCompatible(item.path, "image")).map(item => ({ value: item.path, label: item.path }))} />
        {selectedAssets.length === 1 ? <input name="targetFilename" defaultValue={selectedAssets[0].objectKey.split("/").at(-1)} aria-label="اسم الملف الفعلي الجديد" disabled={Boolean(busy)} className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-white" dir="ltr" /> : null}
        <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => setShowPhysicalForm(false)}>إلغاء</button><button ref={moveConfirmationTriggerRef} type="submit" disabled={Boolean(busy)} className="rounded-xl border border-[#D8B87A]/30 px-4 py-2 text-[#D8B87A]">{busy === "move-preview" ? "جارٍ فحص الاستخدام…" : moveResults.some(result => !result.success) ? "مراجعة الفاشل فقط وإعادة المحاولة" : "مراجعة العملية"}</button></div>
      </form> : null}
      {moveResults.length > 0 ? <ul data-media-relocation-results="" aria-live="polite" className="space-y-2">{moveResults.map(result => <li key={result.id} className={result.success ? "text-emerald-200" : "text-red-200"}>{result.name}: {result.success ? "نجح النقل" : result.error}</li>)}</ul> : null}

      <AdminConfirmDialog
        open={confirmation !== null}
        title={confirmation?.kind === "replace" ? "استبدال كل المراجع المدعومة؟" : confirmation?.kind === "move" ? "مراجعة النقل وإعادة التسمية" : "حذف الأصول المحددة؟"}
        description={confirmDescription}
        confirmLabel={confirmation?.kind === "replace" ? "تأكيد الاستبدال" : confirmation?.kind === "move" ? relocationLabel : confirmation?.kind === "delete" && confirmation.phase === "failed" ? "إعادة الفحص" : confirmation?.kind === "delete" && confirmation.checks.some(check => check.state === "in_use") ? "حذف رغم الاستخدام" : "تأكيد الحذف"}
        pending={busy === "delete-preview" || busy === "delete" || busy === "replace" || busy === "move"}
        confirmDisabled={confirmation?.kind === "move" ? confirmation.previews.every(item => Boolean(item.error)) || Boolean(busy) : confirmation?.kind === "delete" && (confirmation.phase === "checking" || (confirmation.phase === "ready" && confirmation.assets.length > 0 && !confirmation.checks.some(check => check.state === "safe_to_delete" || check.state === "in_use")))}
        returnFocusRef={
          confirmation?.kind === "delete"
            ? deleteConfirmationTriggerRef
            : confirmation?.kind === "move"
              ? moveConfirmationTriggerRef
              : replacementConfirmationTriggerRef
        }
        fallbackFocusRef={libraryRootRef}
        onCancel={() => setConfirmation(null)}
        onConfirm={executeConfirmation}
      >
        {confirmation?.kind === "move" ? <div className="max-h-[40vh] overflow-y-auto space-y-3" data-media-relocation-preview="">{confirmation.previews.map(item => <div key={item.id} className="rounded-lg border border-white/10 p-3"><p>{item.asset?.displayName ?? item.id}</p><p dir="ltr" className="break-all">{item.asset?.objectKey} → {item.targetObjectKey}</p><p>{item.references?.length ?? 0} مواضع استخدام — تُحدث تلقائيًا.</p>{item.error ? <p className="text-red-200">{item.error}</p> : null}<ul>{item.references?.map(ref => <li key={ref.id}>{ref.editHref ? <Link href={ref.editHref} target="_blank" className="underline">{ref.entityLabel ?? ref.entityIdentity}</Link> : ref.entityLabel ?? ref.entityIdentity} — {ref.domainKey} / {ref.fieldKey}</li>)}</ul></div>)}</div> : null}
        {confirmation?.kind === "delete" ? <div className={`max-h-[40vh] space-y-3 overflow-y-auto ${VENESIA_SCROLLBAR_VISUAL_CLASSES}`} aria-live="polite" data-media-delete-preview="">
          {confirmation.phase === "checking" ? <p role="status">جارٍ فحص الاستخدامات…</p> : null}
          {confirmation.error ? <p role="alert" className="text-sm text-red-200">{confirmation.error}</p> : null}
          {confirmation.checks.map((check, index) => <div key={check.asset?.id ?? index} className="rounded-lg border border-white/10 p-3 text-sm">
            <p className="break-words font-semibold">{check.asset?.displayName ?? "ملف غير متاح"}</p>
            {check.state === "in_use" ? <><p className="mt-2 text-amber-200">هذه الصورة مستخدمة في {check.references.length} مواضع. حذفها سيترك هذه المراجع بدون أصل صالح.</p>
              <ul className="mt-2 space-y-1">{check.references.map((reference, i) => <li key={i}>{reference.editHref ? <Link href={reference.editHref} target="_blank" className="underline">{reference.entityLabel ?? reference.entityIdentity}</Link> : reference.entityLabel ?? reference.entityIdentity} — {reference.fieldKey}</li>)}</ul></>
              : check.state === "safe_to_delete" ? <p className="text-emerald-200">غير مستخدمة حاليًا.</p>
              : <p className="text-red-200">تعذر إثبات جاهزية هذا الأصل للحذف: {"reasons" in check ? check.reasons.map(reason => reason === "media_delete_write_lease_active" ? "عملية حفظ أخرى ما زالت نشطة؛ انتظر انتهاءها ثم أعد المحاولة." : reason === "media_delete_write_lease_unresolved" ? "تعذر حسم عملية حفظ سابقة بأمان؛ أعد الفحص للمحاولة مجددًا." : reason).join("، ") : check.state}</p>}
          </div>)}
          {confirmation.results.length ? <div data-media-delete-results=""><p data-media-delete-progress="">Completed: {confirmation.results.filter(result => result.deleted).length} / Failed: {confirmation.results.filter(result => !result.deleted).length} / Remaining: {(confirmation.total ?? confirmation.assets.length) - confirmation.results.length}</p><ul>{confirmation.results.map((result, index) => <li key={index} className={result.deleted ? "text-emerald-200" : "text-red-200"}>{result.name}: {result.deleted ? "تم الحذف" : result.error}</li>)}</ul></div> : null}
        </div> : null}
      </AdminConfirmDialog>
    </div>
  );
}
