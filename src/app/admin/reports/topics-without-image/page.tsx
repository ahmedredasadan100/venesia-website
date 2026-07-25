import Link from "next/link";

import MediaNoImage from "../../../../components/admin/media/MediaNoImage";
import { AdminPageContextHeader, AdminPageExperience } from "../../../../components/admin/ui";
import { listTopicsWithoutImage } from "../../../../lib/admin/media-catalog/reports";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function stringValue(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function pageHref(params: SearchParams, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string" && value) next.set(key, value);
  next.set("page", String(page));
  return `/admin/reports/topics-without-image?${next}`;
}

export default async function TopicsWithoutImageReportPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const result = await listTopicsWithoutImage({
    query: stringValue(params.q),
    status: stringValue(params.status, "all"),
    contentType: stringValue(params.type, "all"),
    page: Number(stringValue(params.page, "1")),
  });

  return (
    <AdminPageExperience className="pb-10">
      <AdminPageContextHeader
        eyebrow="MEDIA QUALITY REPORT"
        title="الموضوعات بلا صورة"
        description="تقرير قابل للتصفية للموضوعات النشطة وغير المحذوفة التي لا ترتبط بصورة. هذا تقرير جودة، وليس دليلًا على أمان حذف أي أصل."
      />
      <form method="get" className="grid gap-3 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <input name="q" defaultValue={stringValue(params.q)} placeholder="بحث بالعنوان أو slug…" className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none" />
        <select name="status" defaultValue={stringValue(params.status, "all")} className="h-11 rounded-xl border border-white/10 bg-[#080B10] px-3 text-sm text-white"><option value="all">كل الحالات</option><option value="draft">مسودة</option><option value="published">منشور</option><option value="archived">مؤرشف</option></select>
        <select name="type" defaultValue={stringValue(params.type, "all")} className="h-11 rounded-xl border border-white/10 bg-[#080B10] px-3 text-sm text-white"><option value="all">كل أنواع المحتوى</option><option value="article">مقال</option><option value="news">خبر</option><option value="event">فعالية</option><option value="video">فيديو</option><option value="podcast">بودكاست</option></select>
        <button type="submit" className="h-11 rounded-xl bg-[#D8B87A] px-5 text-sm font-bold text-[#05070B]">تطبيق</button>
      </form>

      <section className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#080B10]/92">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><h2 className="font-semibold text-white">النتائج</h2><span className="text-sm text-white/42">{result.total} موضوع</span></div>
        {!result.rows.length ? <div className="h-56"><MediaNoImage label="لا توجد موضوعات مطابقة بلا صورة" /></div> : (
          <div className="divide-y divide-white/8">
            {result.rows.map((topic) => (
              <article key={topic.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center">
                <div className="h-12 overflow-hidden rounded-xl"><MediaNoImage compact /></div>
                <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-white">{topic.title}</h3><p className="mt-1 truncate font-mono text-[11px] text-white/35" dir="ltr">/{topic.slug}</p><p className="mt-1 text-xs text-white/42">{topic.contentType} — {topic.status}{topic.categorySlug ? ` — ${topic.categorySlug}` : ""}</p></div>
                <Link href={`/admin/content/topics/${topic.id}`} className="rounded-xl border border-[#D8B87A]/30 px-3 py-2 text-center text-xs font-semibold text-[#D8B87A]">فتح التحرير</Link>
              </article>
            ))}
          </div>
        )}
        {result.totalPages > 1 ? <div className="flex items-center justify-center gap-3 border-t border-white/8 p-4"><Link aria-disabled={result.page <= 1} href={pageHref(params, Math.max(1, result.page - 1))} className={`rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 ${result.page <= 1 ? "pointer-events-none opacity-30" : ""}`}>السابق</Link><span className="text-xs text-white/40">{result.page} / {result.totalPages}</span><Link aria-disabled={result.page >= result.totalPages} href={pageHref(params, Math.min(result.totalPages, result.page + 1))} className={`rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 ${result.page >= result.totalPages ? "pointer-events-none opacity-30" : ""}`}>التالي</Link></div> : null}
      </section>
    </AdminPageExperience>
  );
}
