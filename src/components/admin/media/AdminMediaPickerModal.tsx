"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import type { PublicMediaFolderListing } from "../../../lib/admin/media-library";

type AdminMediaPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialFolder?: string;
  mode?: "image" | "pdf";
};

export default function AdminMediaPickerModal({
  open,
  onClose,
  onSelect,
  initialFolder,
  mode = "image",
}: AdminMediaPickerModalProps) {
  const isPdfMode = mode === "pdf";
  const rootFolder = isPdfMode ? "files" : "images";
  const resolvedInitialFolder = initialFolder || rootFolder;

  const [folder, setFolder] = useState(resolvedInitialFolder);
  const [listing, setListing] = useState<PublicMediaFolderListing | null>(null);
  const [listingKey, setListingKey] = useState<string | null>(null);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openListingKey = open ? resolvedInitialFolder : null;
  const loading = navigationLoading || (open && listingKey !== openListingKey);

  const loadFolder = useCallback(async (targetFolder: string) => {
    setNavigationLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media-library?folder=${encodeURIComponent(targetFolder)}`);
      const payload = (await response.json()) as PublicMediaFolderListing & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || (isPdfMode ? "تعذّر تحميل مكتبة الملفات." : "تعذّر تحميل مكتبة الصور."));
      }
      setListing(payload);
      setFolder(payload.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : isPdfMode ? "تعذّر تحميل مكتبة الملفات." : "تعذّر تحميل مكتبة الصور.");
    } finally {
      setNavigationLoading(false);
    }
  }, [isPdfMode]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    fetch(`/api/admin/media-library?folder=${encodeURIComponent(resolvedInitialFolder)}`)
      .then(async (response) => {
        const payload = (await response.json()) as PublicMediaFolderListing & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || (isPdfMode ? "تعذّر تحميل مكتبة الملفات." : "تعذّر تحميل مكتبة الصور."));
        }
        return payload;
      })
      .then((payload) => {
        if (!cancelled) {
          setListing(payload);
          setFolder(payload.folder);
          setError(null);
          setListingKey(resolvedInitialFolder);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setListing(null);
          setError(err instanceof Error ? err.message : isPdfMode ? "تعذّر تحميل مكتبة الملفات." : "تعذّر تحميل مكتبة الصور.");
          setListingKey(resolvedInitialFolder);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedInitialFolder, isPdfMode]);

  async function handleUpload(file: File | null) {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", folder);
      if (isPdfMode) {
        formData.set("kind", "pdf");
      }

      const response = await fetch("/api/admin/media-library", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !payload.path) {
        throw new Error(payload.error || (isPdfMode ? "تعذّر رفع الملف." : "تعذّر رفع الصورة."));
      }

      await loadFolder(folder);
      onSelect(payload.path);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : isPdfMode ? "تعذّر رفع الملف." : "تعذّر رفع الصورة.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  const breadcrumbs = folder.split("/").filter(Boolean);
  const listedFiles = isPdfMode ? (listing?.documents ?? []) : (listing?.images ?? []);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-[28px] border border-white/10 bg-[#080B10] shadow-[0_30px_120px_rgba(0,0,0,0.5)]"
        onMouseDown={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{isPdfMode ? "مكتبة الملفات" : "مكتبة الصور"}</h3>
            <p className="mt-1 text-sm text-white/45">
              {isPdfMode
                ? "تصفح المجلدات، ارفع ملف PDF جديد، أو اختر ملفًا موجودًا."
                : "تصفح المجلدات، ارفع صورة جديدة، أو اختر صورة موجودة."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-white/55 hover:text-white"
          >
            إغلاق
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3 text-sm">
          {listing?.parentFolder ? (
            <button
              type="button"
              onClick={() => void loadFolder(listing.parentFolder!)}
              className="cursor-pointer rounded-full border border-white/10 px-3 py-1.5 text-white/65 hover:bg-white/5 hover:text-white"
            >
              ← رجوع
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void loadFolder(rootFolder)}
            className={`cursor-pointer rounded-full px-3 py-1.5 ${
              folder === rootFolder ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55 hover:text-white"
            }`}
          >
            {rootFolder}
          </button>

          {breadcrumbs.map((segment, index) => {
            if (segment === rootFolder && index === 0) return null;
            const target = breadcrumbs.slice(0, index + 1).join("/");
            return (
              <button
                key={target}
                type="button"
                onClick={() => void loadFolder(target)}
                className={`cursor-pointer rounded-full px-3 py-1.5 ${
                  folder === target ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55 hover:text-white"
                }`}
              >
                {segment}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <p className="font-mono text-xs text-white/45" dir="ltr">
            public/{folder}
          </p>
          <label className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15">
            {uploading ? "جاري الرفع…" : isPdfMode ? "رفع PDF" : "رفع صورة"}
            <input
              type="file"
              accept={isPdfMode ? "application/pdf,.pdf" : "image/*"}
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? <p className="text-sm text-white/45">جاري التحميل…</p> : null}
          {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

          {listing?.subfolders.length ? (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">المجلدات</p>
              <div className="flex flex-wrap gap-2">
                {listing.subfolders.map((subfolder) => (
                  <button
                    key={subfolder}
                    type="button"
                    onClick={() => void loadFolder(`${folder}/${subfolder}`)}
                    className="cursor-pointer rounded-2xl border border-white/10 bg-[#05070B] px-4 py-2 text-sm text-white/70 hover:border-[#D8B87A]/30 hover:text-white"
                  >
                    {subfolder}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !listedFiles.length ? (
            <p className="text-sm text-white/45">
              {isPdfMode ? "لا توجد ملفات PDF في هذا المجلد." : "لا توجد صور في هذا المجلد."}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isPdfMode
              ? listedFiles.map((filePath) => {
                  const fileName = filePath.split("/").pop() ?? filePath;
                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => {
                        onSelect(filePath);
                        onClose();
                      }}
                      className="cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-right transition hover:border-[#D8B87A]/35"
                    >
                      <div className="flex h-32 items-center justify-center bg-[#05070B]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D8B87A]/25 bg-[#D8B87A]/10 text-sm font-bold uppercase tracking-wide text-[#D8B87A]">
                          PDF
                        </div>
                      </div>
                      <p className="truncate px-3 py-2 text-sm text-white/75">{fileName}</p>
                      <p className="truncate px-3 pb-2 font-mono text-[11px] text-white/45" dir="ltr">
                        {filePath}
                      </p>
                    </button>
                  );
                })
              : listedFiles.map((imagePath) => (
                  <button
                    key={imagePath}
                    type="button"
                    onClick={() => {
                      onSelect(imagePath);
                      onClose();
                    }}
                    className="cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-right transition hover:border-[#D8B87A]/35"
                  >
                    <div className="relative h-32">
                      <Image src={imagePath} alt="" fill className="object-cover" sizes="220px" />
                    </div>
                    <p className="truncate px-3 py-2 font-mono text-[11px] text-white/45" dir="ltr">
                      {imagePath}
                    </p>
                  </button>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
