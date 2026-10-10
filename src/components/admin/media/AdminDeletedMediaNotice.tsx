"use client";
import { useEffect, useState } from "react";

/** Shared field feedback; deletion truth comes from Catalog, not image loading. */
export default function AdminDeletedMediaNotice({ values }: { values: readonly string[] }) {
  const key = JSON.stringify([...new Set(values.filter(Boolean))]);
  const [result, setResult] = useState<{ key: string; count: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const assets: string[] = JSON.parse(key);
    if (!assets.length) return;
    async function read() {
      try {
        let count = 0;
        for (let offset = 0; offset < assets.length; offset += 100) {
          const response = await fetch("/api/admin/media-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "reference_state", assets: assets.slice(offset, offset + 100) }),
            signal: controller.signal,
          });
          if (!response.ok) return;
          const body: { deleted?: unknown } = await response.json();
          if (!Array.isArray(body.deleted) || !body.deleted.every(value => typeof value === "string")) return;
          count += body.deleted.length;
        }
        if (!controller.signal.aborted) setResult({ key, count });
      } catch { /* A failed status read never changes a field or grants save permission. */ }
    }
    void read();
    const refresh = () => { void read(); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [key]);
  if (result?.key !== key || !result.count) return null;
  return <p role="status" data-admin-deleted-media-count={result.count} className="text-xs leading-6 text-amber-500">
    يوجد {result.count} أصل محذوف. بياناته محفوظة هنا، لكنه لا يظهر للزوار. المراجع المحفوظة مسبقًا لا تمنع حفظ التعديلات؛ يمكنك اختيار بديل دون إزالة بيانات الصف.
  </p>;
}
