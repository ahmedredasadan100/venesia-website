"use client";
import { useEffect, useState } from "react";

/** Shared field feedback; deletion truth comes from Catalog, not image loading. */
export function useAdminMediaReferenceState(values: readonly string[]) {
  const key = JSON.stringify([...new Set(values.filter(Boolean))]);
  const [result, setResult] = useState<{ key: string; count: number; originals: { value: string; width: number | null; height: number | null }[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const assets: string[] = JSON.parse(key);
    if (!assets.length) return;
    async function read() {
      try {
        let count = 0;
        const originals: { value: string; width: number | null; height: number | null }[] = [];
        for (let offset = 0; offset < assets.length; offset += 100) {
          const response = await fetch("/api/admin/media-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "reference_state", assets: assets.slice(offset, offset + 100) }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("media_reference_read_unavailable");
          const body: { deleted?: unknown; originals?: { value: string; width: number | null; height: number | null }[] } = await response.json();
          if (!Array.isArray(body.deleted) || !body.deleted.every(value => typeof value === "string")) return;
          count += body.deleted.length;
          if (Array.isArray(body.originals)) originals.push(...body.originals);
        }
        if (!controller.signal.aborted) setResult({ key, count, originals });
      } catch {
        // A failed read never changes a field or grants save permission.
        if (!controller.signal.aborted) setResult(previous => previous?.key === key ? previous : { key, count: 0, originals: [] });
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

export function AdminMediaOriginalDimensions({ value, state }: { value: string; state: ReferenceState }) {
  if (!value) return null;
  const original = state?.originals.find(item => item.value === value);
  return <p data-media-original={value} className="text-xs leading-6 text-slate-500">
    الأبعاد الأصلية: {original?.width && original.height ? <bdi>{original.width} × {original.height} px</bdi> : state ? "غير متاحة" : "جارٍ قراءة أبعاد الأصل…"}
  </p>;
}

export function AdminDeletedMediaStatus({ state }: { state: ReferenceState }) {
  return state?.count ? <p role="status" data-admin-deleted-media-count={state.count} className="text-xs leading-6 text-amber-500">
    يوجد {state.count} أصل محذوف. بياناته محفوظة هنا، لكنه لا يظهر للزوار. المراجع المحفوظة مسبقًا لا تمنع حفظ التعديلات؛ يمكنك اختيار بديل دون إزالة بيانات الصف.
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
