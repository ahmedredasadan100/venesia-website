import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageHeader from "../../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../../components/admin/AdminStatusBadge";
import SeoPanel from "../../../../../components/admin/SeoPanel";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type FaqItem = {
  question?: string;
  answer?: string;
};

function getAdminStatus(status?: string | null) {
  if (status === "unpublished") return "hidden";
  return status || "draft";
}

function getSeoKeywords(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function getFaq(value: unknown): FaqItem[] {
  return Array.isArray(value) ? value : [];
}

function renderMarkdown(content: string) {
  return content
    .split("\n")
    .map((line, index) => {
      const key = `${index}-${line.slice(0, 20)}`;
      if (!line.trim()) return <div key={key} className="h-4" />;
      if (line.startsWith("### ")) return <h3 key={key} className="mt-8 text-xl font-semibold text-[#D8B87A]">{line.replace(/^###\s+/, "")}</h3>;
      if (line.startsWith("## ")) return <h2 key={key} className="mt-10 text-2xl font-semibold text-white">{line.replace(/^##\s+/, "")}</h2>;
      if (line.startsWith("# ")) return <h1 key={key} className="mb-6 text-4xl font-semibold leading-tight text-white">{line.replace(/^#\s+/, "")}</h1>;
      if (line.startsWith("- ")) return <li key={key} className="mr-6 list-disc text-base leading-8 text-white/68">{line.replace(/^-\s+/, "")}</li>;
      return <p key={key} className="text-base leading-9 text-white/68">{line}</p>;
    });
}

export default async function TopicPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: topic } = await getSupabaseAdmin().from("topics").select("*").eq("id", id).maybeSingle();
  if (!topic) notFound();

  const faq = getFaq(topic.faq);
  const seoKeywords = getSeoKeywords(topic.seo_keywords);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="INTERNAL PREVIEW"
        title={topic.title || "معاينة الموضوع"}
        description="معاينة داخلية لا تعتمد على حالة النشر. استخدمها لمراجعة المحتوى والسيو قبل الظهور العام."
        actions={
          <>
            <AdminStatusBadge status={getAdminStatus(topic.status)} />
            <Link
              href={`/admin/topics/${topic.id}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              رجوع للتحرير
            </Link>
            {topic.slug ? (
              <Link
                href={`/topics/${topic.slug}`}
                target="_blank"
                className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
              >
                النسخة العامة
              </Link>
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        {topic.image ? (
          <div className="relative h-[360px] overflow-hidden bg-black/30">
            <Image src={topic.image} alt={topic.image_alt || topic.title || "Topic image"} fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-transparent" />
          </div>
        ) : null}

        <article className="mx-auto max-w-4xl px-6 py-10 md:px-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            {topic.category ? <span className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-sm text-[#D8B87A]">{topic.category}</span> : null}
            {topic.series ? <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/45">{topic.series}</span> : null}
            {topic.date_label ? <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/45">{topic.date_label}</span> : null}
          </div>

          {topic.excerpt ? <p className="mb-8 text-lg leading-9 text-white/58">{topic.excerpt}</p> : null}

          <div className="space-y-2">{renderMarkdown(topic.content ?? "")}</div>
        </article>
      </section>

      {faq.length > 0 ? (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">FAQ PREVIEW</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">الأسئلة الشائعة</h2>

          <div className="mt-6 space-y-4">
            {faq.map((item, index) => (
              <div key={`${item.question}-${index}`} className="rounded-[22px] border border-white/10 bg-black/25 p-5">
                <p className="text-base font-semibold text-[#D8B87A]">{item.question}</p>
                <p className="mt-3 text-sm leading-7 text-white/58">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <SeoPanel
        title={topic.title ?? ""}
        excerpt={topic.excerpt ?? ""}
        slug={topic.slug ?? ""}
        content={topic.content ?? ""}
        image={topic.image ?? ""}
        imageAlt={topic.image_alt ?? ""}
        seoTitle={topic.seo_title ?? ""}
        seoDescription={topic.seo_description ?? ""}
        seoKeywords={seoKeywords}
        focusKeyword={topic.focus_keyword ?? ""}
        faq={faq}
      />
    </main>
  );
}
