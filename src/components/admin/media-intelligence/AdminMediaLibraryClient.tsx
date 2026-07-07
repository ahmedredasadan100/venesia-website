"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MediaAssetItem, PublicMediaFolderListing } from "../../../lib/admin/media-library-paths";
import MediaUsagePanel from "./MediaUsagePanel";

function formatBytes(sizeBytes: number | null) {
  if (sizeBytes == null) return "غير معروف";
  if (sizeBytes < 1024) return `${sizeBytes} بايت`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} ك.ب`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

type ViewMode = "grid" | "list";

export default function AdminMediaLibraryClient() {
  const [folder, setFolder] = useState("images");
  const [listing, setListing] = useState<PublicMediaFolderListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "image" | "document">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const loadFolder = useCallback(async (targetFolder: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media-library?folder=${encodeURIComponent(targetFolder)}`);
      const payload = (await response.json()) as PublicMediaFolderListing & { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل المكتبة.");
      setListing(payload);
      setFolder(payload.folder);
      setSelectedPath(null);
    } catch (err) {
      setListing(null);
      setError(err instanceof Error ? err.message : "تعذر تحميل المكتبة.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFolder("images");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFolder]);

  const items = useMemo(() => {
    const source = listing?.items ?? [];
    const normalizedQuery = query.trim().toLowerCase();

    return source.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (!normalizedQuery) return true;
      return (
        item.filename.toLowerCase().includes(normalizedQuery) ||
        item.path.toLowerCase().includes(normalizedQuery) ||
        item.extension.includes(normalizedQuery)
      );
    });
  }, [listing?.items, query, kindFilter]);

  async function copyPath(pathValue: string) {
    try {
      await navigator.clipboard.writeText(pathValue);
      setCopiedPath(pathValue);
      window.setTimeout(() => setCopiedPath((current) => (current === pathValue ? null : current)), 1800);
    } catch {
      setError("تعذر نسخ الرابط — انسخه يدويًا.");
    }
  }

  const breadcrumbs = folder.split("/").filter(Boolean);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5 rounded-[28px] border border-white/10 bg-[#080B10]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">MEDIA LIBRARY</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">مكتبة الأصول الحالية</h2>
            <p className="mt-2 text-sm text-white/45">
              تصفح الملفات المتاحة فعليًا في التخزين الحالي — بدون جدول media_assets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm ${viewMode === "grid" ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55"}`}
            >
              شبكة
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full px-4 py-2 text-sm ${viewMode === "list" ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55"}`}
            >
              قائمة
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-y border-white/10 py-3 text-sm">
          {listing?.parentFolder ? (
            <button
              type="button"
              onClick={() => void loadFolder(listing.parentFolder!)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-white/65 hover:text-white"
            >
              ← رجوع
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void loadFolder("images")}
            className={`rounded-full px-3 py-1.5 ${folder === "images" ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55"}`}
          >
            images
          </button>
          <button
            type="button"
            onClick={() => void loadFolder("files")}
            className={`rounded-full px-3 py-1.5 ${folder === "files" ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55"}`}
          >
            files
          </button>
          {breadcrumbs.map((segment, index) => {
            if ((segment === "images" || segment === "files") && index === 0) return null;
            const target = breadcrumbs.slice(0, index + 1).join("/");
            return (
              <button
                key={target}
                type="button"
                onClick={() => void loadFolder(target)}
                className={`rounded-full px-3 py-1.5 ${folder === target ? "bg-[#D8B87A]/15 text-[#D8B87A]" : "text-white/55"}`}
              >
                {segment}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="بحث بالاسم أو المسار أو الامتداد…"
            className="h-11 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#D8B87A]/35"
          />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.currentTarget.value as typeof kindFilter)}
            className="h-11 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#D8B87A]/35"
          >
            <option value="all">كل الأنواع</option>
            <option value="image">صور</option>
            <option value="document">مستندات</option>
          </select>
        </div>

        {listing?.subfolders.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/40">المجلدات</p>
            <div className="flex flex-wrap gap-2">
              {listing.subfolders.map((subfolder) => (
                <button
                  key={subfolder}
                  type="button"
                  onClick={() => void loadFolder(`${folder}/${subfolder}`)}
                  className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-2 text-sm text-white/70 hover:border-[#D8B87A]/30"
                >
                  {subfolder}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? <p className="text-sm text-white/45">جاري التحميل…</p> : null}
        {error ? <p className="text-sm text-red-200">{error}</p> : null}

        {!loading && !items.length ? (
          <p className="text-sm text-white/45">لا توجد ملفات مطابقة في هذا المجلد.</p>
        ) : null}

        {viewMode === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <AssetCard
                key={item.path}
                item={item}
                selected={selectedPath === item.path}
                copied={copiedPath === item.path}
                onSelect={() => setSelectedPath(item.path)}
                onCopy={() => void copyPath(item.path)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <AssetRow
                key={item.path}
                item={item}
                selected={selectedPath === item.path}
                copied={copiedPath === item.path}
                onSelect={() => setSelectedPath(item.path)}
                onCopy={() => void copyPath(item.path)}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="space-y-5">
        <MediaUsagePanel assetPath={selectedPath} />

        <section className="rounded-[24px] border border-white/10 bg-[#080B10]/88 p-5 text-sm text-white/48">
          <p className="font-semibold text-white">ملاحظات الاستبدال</p>
          <ul className="mt-3 space-y-2 text-xs leading-6">
            <li>الاستبدال الآمن يعمل عند اختيار «استبدال» من حقول الصور مع replacePath.</li>
            <li>على Supabase وعلى الملفات المحلية يُكتب فوق نفس المسار عند توافق المجلد.</li>
            <li>الرفع بدون استبدال ينشئ ملفًا جديدًا — قد تبقى نسخ قديمة يتيمة.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function AssetMeta({ item }: { item: MediaAssetItem }) {
  return (
    <div className="space-y-1 text-xs text-white/45">
      <p>
        النوع: {item.kind === "image" ? "صورة" : "مستند"} — {item.extension}
      </p>
      <p>الحجم: {formatBytes(item.sizeBytes)}</p>
    </div>
  );
}

function AssetCard({
  item,
  selected,
  copied,
  onSelect,
  onCopy,
}: {
  item: MediaAssetItem;
  selected: boolean;
  copied: boolean;
  onSelect: () => void;
  onCopy: () => void;
}) {
  return (
    <article
      className={[
        "overflow-hidden rounded-2xl border bg-black/25 transition",
        selected ? "border-[#D8B87A]/40" : "border-white/10 hover:border-[#D8B87A]/25",
      ].join(" ")}
    >
      <button type="button" onClick={onSelect} className="block w-full text-right">
        <div className="relative h-32 bg-[#05070B]">
          {item.kind === "image" ? (
            <Image src={item.path} alt="" fill className="object-cover" sizes="240px" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-bold text-[#D8B87A]">PDF</div>
          )}
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="truncate text-sm font-semibold text-white">{item.filename}</p>
          <AssetMeta item={item} />
          <p className="truncate font-mono text-[11px] text-white/40" dir="ltr">
            {item.path}
          </p>
        </div>
      </button>
      <div className="border-t border-white/8 px-3 py-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-[#D8B87A]/30 px-3 py-1.5 text-xs font-semibold text-[#D8B87A]"
        >
          {copied ? "تم النسخ" : "نسخ الرابط"}
        </button>
      </div>
    </article>
  );
}

function AssetRow({
  item,
  selected,
  copied,
  onSelect,
  onCopy,
}: {
  item: MediaAssetItem;
  selected: boolean;
  copied: boolean;
  onSelect: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={[
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3",
        selected ? "border-[#D8B87A]/35 bg-[#D8B87A]/5" : "border-white/10 bg-black/20",
      ].join(" ")}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-right">
        <p className="truncate text-sm font-semibold text-white">{item.filename}</p>
        <AssetMeta item={item} />
        <p className="truncate font-mono text-[11px] text-white/40" dir="ltr">
          {item.path}
        </p>
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-full border border-[#D8B87A]/30 px-3 py-1.5 text-xs font-semibold text-[#D8B87A]"
      >
        {copied ? "تم النسخ" : "نسخ الرابط"}
      </button>
    </div>
  );
}
