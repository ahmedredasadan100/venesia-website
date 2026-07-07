"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MediaUsageHit = {
  entityType: string;
  entityLabel: string;
  field: string;
  editHref: string | null;
};

type MediaUsagePanelProps = {
  assetPath: string | null;
};

export default function MediaUsagePanel({ assetPath }: MediaUsagePanelProps) {
  const [hits, setHits] = useState<MediaUsageHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetPath) {
      setHits([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/media-usage?asset=${encodeURIComponent(assetPath)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { hits?: MediaUsageHit[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "تعذر فحص الاستخدام.");
        return payload.hits ?? [];
      })
      .then((nextHits) => {
        if (!cancelled) setHits(nextHits);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setHits([]);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetPath]);

  if (!assetPath) {
    return (
      <section className="rounded-[24px] border border-white/10 bg-[#080B10]/88 p-5">
        <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">USAGE SCAN</p>
        <h3 className="mt-2 text-lg font-semibold text-white">أين يُستخدم هذا الملف؟</h3>
        <p className="mt-2 text-sm text-white/45">اختر ملفًا من المكتبة لعرض مراجعه الحالية — للقراءة فقط.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/92 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">USAGE SCAN</p>
      <h3 className="mt-2 text-lg font-semibold text-white">أين يُستخدم هذا الملف؟</h3>
      <p className="mt-2 break-all font-mono text-xs text-white/42" dir="ltr">
        {assetPath}
      </p>

      {loading ? <p className="mt-4 text-sm text-white/45">جاري فحص المراجع…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}

      {!loading && !error && hits.length === 0 ? (
        <p className="mt-4 text-sm text-white/48">لا توجد مراجع واضحة في البيانات الحالية.</p>
      ) : null}

      {!loading && hits.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {hits.map((hit) => (
            <li
              key={`${hit.entityType}-${hit.entityLabel}-${hit.field}-${hit.editHref}`}
              className="rounded-[16px] border border-white/10 bg-black/20 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{hit.entityLabel}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {hit.entityType} — الحقل: <span className="font-en">{hit.field}</span>
                  </p>
                </div>
                {hit.editHref ? (
                  <Link
                    href={hit.editHref}
                    className="rounded-full border border-[#D8B87A]/30 px-3 py-1.5 text-xs font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10"
                  >
                    فتح التحرير
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs leading-6 text-white/35">
        فحص للقراءة فقط — لا يمنع الحذف ولا يغطي كل السياقات المحتملة خارج الجداول المفحوصة.
      </p>
    </section>
  );
}
