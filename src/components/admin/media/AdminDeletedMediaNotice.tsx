"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_MEDIA_DIMENSION_DISCLOSURE } from "../../../lib/admin/admin-ui-styles";

/** Shared field feedback; deletion truth comes from Catalog, not image loading. */
export function useAdminMediaReferenceState(values: readonly string[]) {
  const key = JSON.stringify([...new Set(values.filter(Boolean))]);
  const [result, setResult] = useState<{ key: string; count: number; deleted: string[]; missing: string[]; available: boolean; originals: { value: string; width: number | null; height: number | null }[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const assets: string[] = JSON.parse(key);
    if (!assets.length) return;
    async function read() {
      try {
        const deleted: string[] = [];
        const missing: string[] = [];
        const originals: { value: string; width: number | null; height: number | null }[] = [];
        for (let offset = 0; offset < assets.length; offset += 100) {
          const response = await fetch("/api/admin/media-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "reference_state", assets: assets.slice(offset, offset + 100) }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("media_reference_read_unavailable");
          const body: { deleted?: unknown; missing?: unknown; originals?: { value: string; width: number | null; height: number | null }[] } = await response.json();
          if (!Array.isArray(body.deleted) || !body.deleted.every(value => typeof value === "string")) return;
          deleted.push(...body.deleted);
          if (Array.isArray(body.missing) && body.missing.every(value => typeof value === "string")) missing.push(...body.missing);
          if (Array.isArray(body.originals)) originals.push(...body.originals);
        }
        if (!controller.signal.aborted) setResult({ key, count: deleted.length, deleted, missing, available: true, originals });
      } catch {
        // A failed read never changes a field or grants save permission.
        if (!controller.signal.aborted) setResult(previous => previous?.key === key ? previous : { key, count: 0, deleted: [], missing: [], available: false, originals: [] });
      }
    }
    void read();
    const refresh = () => { void read(); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [key]);
  return result?.key === key ? result : null;
}

type ReferenceState = ReturnType<typeof useAdminMediaReferenceState>;

export function AdminMediaOriginalDimensions({ value, state, className, presentation = "default" }: { value: string; state: ReferenceState; className?: string; presentation?: "default" | "disclosure" }) {
  if (presentation === "disclosure") {
    const original = state?.originals.find(item => item.value === value);
    return <details data-admin-media-dimension="original" data-media-original={value} className={ADMIN_MEDIA_DIMENSION_DISCLOSURE.root}>
      <summary className={ADMIN_MEDIA_DIMENSION_DISCLOSURE.summary}>الأبعاد الأصلية</summary>
      <p className={original?.width && original.height ? ADMIN_MEDIA_DIMENSION_DISCLOSURE.value : "px-2 pb-2 text-white/65"} title={original?.width && original.height ? "الأبعاد بوحدة البكسل (px)" : undefined} aria-label={original?.width && original.height ? `${original.width} × ${original.height} px` : undefined}>{original?.width && original.height ? <bdi>{original.width}×{original.height}<span className="hidden @min-[7rem]/media-dimension:inline"> px</span></bdi> : value && !state ? "جارٍ قراءة أبعاد الأصل…" : "غير متاحة"}</p>
    </details>;
  }
  if (!value) return null;
  const original = state?.originals.find(item => item.value === value);
  return <p data-media-original={value} className={`text-xs leading-6 text-slate-500${className ? ` ${className}` : ""}`}>
    الأبعاد الأصلية: {original?.width && original.height ? <bdi>{original.width} × {original.height} px</bdi> : state ? "غير متاحة" : "جارٍ قراءة أبعاد الأصل…"}
  </p>;
}

export function AdminDeletedMediaStatus({ state }: { state: ReferenceState }) {
  return state?.count ? <p role="status" data-admin-deleted-media-count={state.count} className="text-xs leading-6 text-amber-500">
    الأصل محذوف
  </p> : null;
}

export default function AdminDeletedMediaNotice({ values, showOriginalDimensions = false }: { values: readonly string[]; showOriginalDimensions?: boolean }) {
  const state = useAdminMediaReferenceState(values);
  if (!values.some(Boolean)) return null;
  return <div>
    {showOriginalDimensions ? [...new Set(values.filter(Boolean))].map(value => <AdminMediaOriginalDimensions key={value} value={value} state={state} />) : null}
    <AdminDeletedMediaStatus state={state} />
  </div>;
}

/** Loading/failed Catalog reads never flash a retained image before its state is known. */
export function adminMediaPresentationState(value: string, state: ReferenceState) {
  if (!value.trim()) return "empty";
  if (!state) return "loading";
  if (state.deleted.includes(value)) return "deleted";
  if (state.missing.includes(value)) return "missing";
  return state.available ? "active" : "unavailable";
}

export function AdminMediaPreview({ value, state, children, controlsOverlay = false }: { value: string; state: ReferenceState; children: ReactNode; controlsOverlay?: boolean }) {
  const presentation = adminMediaPresentationState(value, state);
  if (presentation === "active") return children;
  const text = presentation === "deleted" ? "الأصل محذوف" : presentation === "missing" ? "الأصل غير متاح" : presentation === "empty" ? "لم تُحدّد صورة" : presentation === "loading" ? "جارٍ التحقق من الأصل…" : "تعذّر التحقق من الأصل";
  return <div role={presentation === "deleted" ? "status" : undefined} data-admin-media-preview-state={presentation} data-admin-deleted-media-count={presentation === "deleted" ? 1 : undefined} className={`flex h-full flex-col items-center justify-center gap-2 px-10 text-center text-xs text-slate-500 ${controlsOverlay ? "pb-12" : ""}`}>
    <span>{text}</span>
  </div>;
}

export function AdminMediaReferenceLabel({ value, state }: { value: string; state: ReferenceState }) {
  if (!value) return null;
  const reference = <span className="block truncate font-mono text-[11px] text-slate-500" dir="ltr">{value}</span>;
  return adminMediaPresentationState(value, state) === "active" ? reference : <details className="min-w-0 text-xs text-slate-500"><summary>تفاصيل المرجع المحفوظ</summary>{reference}</details>;
}
