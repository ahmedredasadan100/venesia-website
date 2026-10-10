"use client";
import { useEffect, useState } from "react";

/** Shared field feedback; deletion truth comes from Catalog, not image loading. */
export default function AdminDeletedMediaNotice({ values, showOriginalDimensions = false }: { values: readonly string[]; showOriginalDimensions?: boolean }) {
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
  if (!values.some(Boolean)) return null;
  const current = result?.key === key ? result : null;
  return <div>
    {showOriginalDimensions ? [...new Set(values.filter(Boolean))].map((value, index) => {
      const original = current?.originals.find(item => item.value === value);
      return <p key={value} data-media-original={value} className="text-xs leading-6 text-slate-500">
        {values.length > 1 ? `الصورة ${index + 1} — ` : ""}الأبعاد الأصلية: {original?.width && original.height ? <bdi>{original.width} × {original.height} px</bdi> : current ? "غير معروفة" : "جارٍ قراءة أبعاد الأصل…"}
      </p>;
    }) : null}
    {current?.count ? <p role="status" data-admin-deleted-media-count={current.count} className="text-xs leading-6 text-amber-500">
    يوجد {current.count} أصل محذوف. بياناته محفوظة هنا، لكنه لا يظهر للزوار. المراجع المحفوظة مسبقًا لا تمنع حفظ التعديلات؛ يمكنك اختيار بديل دون إزالة بيانات الصف.
  </p> : null}
  </div>;
}
