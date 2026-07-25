"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MediaUsageHit = {
  entityType: string;
  entityLabel: string;
  field: string;
  editHref: string | null;
  referenceState?: string;
};

type MediaUsagePanelProps = {
  assetPath: string | null;
};

export default function MediaUsagePanel({ assetPath }: MediaUsagePanelProps) {
  if (!assetPath) {
    return (
      <section className="rounded-[24px] border border-white/10 bg-[#080B10]/88 p-5">
        <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">USAGE SCAN</p>
        <h3 className="mt-2 text-lg font-semibold text-white">أين يُستخدم هذا الملف؟</h3>
        <p className="mt-2 text-sm text-white/45">اختر ملفًا من المكتبة لعرض مراجعه الحالية — للقراءة فقط.</p>
      </section>
    );
  }

  return <MediaUsagePanelContent key={assetPath} assetPath={assetPath} />;
}

function MediaUsagePanelContent({ assetPath }: { assetPath: string }) {
  const [hits, setHits] = useState<MediaUsageHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authoritative, setAuthoritative] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/media-usage?asset=${encodeURIComponent(assetPath)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { hits?: MediaUsageHit[]; authoritative?: boolean; warning?: string | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "تعذر فحص الاستخدام.");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) {
          setHits(payload.hits ?? []);
          setAuthoritative(payload.authoritative === true);
          setWarning(payload.warning ?? null);
        }
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

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/92 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <p className="font-en text-[11px] tracking-[0.32em] text-[#D8B87A]/70">USAGE SCAN</p>
      <h3 className="mt-2 text-lg font-semibold text-white">أين يُستخدم هذا الملف؟</h3>
      <p className="mt-2 break-all font-mono text-xs text-white/42" dir="ltr">
        {assetPath}
      </p>

      {loading ? <p className="mt-4 text-sm text-white/45">جاري فحص المراجع…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
      {!error && warning ? <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-6 text-amber-100">{warning}</p> : null}

      {!loading && !error && hits.length === 0 ? (
        <p className="mt-4 text-sm text-white/48">{authoritative ? "لا توجد مراجع حالية مثبتة." : "لا يمكن اعتبار صفر المراجع آمنًا قبل اكتمال reconciliation."}</p>
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
                    {hit.entityType} — الحقل: <span className="font-en">{hit.field}</span>{hit.referenceState ? ` — ${hit.referenceState}` : ""}
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
        الحذف الآمن لا يعتمد على هذه اللوحة وحدها؛ يعيد فحص كل provider ويفشل مغلقًا عند أي عدم يقين.
      </p>
    </section>
  );
}
