import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageHeader from "../../../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../../../components/admin/AdminStatusBadge";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getMediaAdminPath, getPublicMediaPath, isMediaAdminType, type MediaAdminType } from "../../../_components/media-admin-config";

export const dynamic = "force-dynamic";

type MediaRow = {
  id: number;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  content: string[] | string | null;
  image: string | null;
  image_alt: string | null;
  type: MediaAdminType | string | null;
  category: string | null;
  project: string | null;
  duration: string | null;
  date_label: string | null;
  published_at: string | null;
  status: string | null;
};

function getAdminStatus(status?: string | null) {
  if (status === "unpublished") return "hidden";
  return status || "draft";
}

function getContentBlocks(value: MediaRow["content"]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/\n{2,}/g).map((item) => item.trim()).filter(Boolean);
  return [];
}

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export default async function MediaPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getSupabaseAdmin().from("media_items").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();

  const item = data as MediaRow;
  const type: MediaAdminType = isMediaAdminType(item.type) ? item.type : "news";
  const content = getContentBlocks(item.content);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="MEDIA PREVIEW"
        title={item.title || "معاينة عنصر إعلامي"}
        description="معاينة داخلية للعنصر كما هو محفوظ في قاعدة البيانات، بغض النظر عن حالة النشر."
        actions={
          <>
            <AdminStatusBadge status={getAdminStatus(item.status)} />
            <Link href={`/admin/media-center/items/${item.id}`} className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">تعديل</Link>
            <Link href={getMediaAdminPath(type)} className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-white/30 hover:text-white">رجوع للقائمة</Link>
            {item.slug ? <Link href={getPublicMediaPath(type, item.slug)} target="_blank" className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10">النسخة العامة</Link> : null}
          </>
        }
      />

      <article className="overflow-hidden rounded-[32px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
        <div className="relative h-[420px]">
          <Image src={item.image || "/images/venesia-5.png"} alt={item.image_alt || item.title || "Venesia Media"} fill priority sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">{item.category || "المركز الإعلامي"}</span>
              <span className="text-sm text-white/55">{item.date_label || formatDate(item.published_at)}</span>
              {item.project ? <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs text-white/60">{item.project}</span> : null}
              {item.duration ? <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs text-white/60">{item.duration}</span> : null}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">{item.title}</h1>
            <p className="mt-5 max-w-3xl leading-8 text-white/65">{item.excerpt}</p>
          </div>
        </div>

        <div className="space-y-6 p-7 md:p-10">
          {content.length > 0 ? content.map((paragraph) => <p key={paragraph} className="text-[15px] leading-9 text-white/68 md:text-base">{paragraph}</p>) : <p className="text-[15px] leading-9 text-white/45">لا يوجد محتوى تفصيلي بعد.</p>}
        </div>
      </article>
    </main>
  );
}
