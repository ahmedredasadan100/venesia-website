import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageHeader from "../../../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../../../components/admin/AdminStatusBadge";
import AdminCategoryBadge from "../../../../../../components/admin/content/AdminCategoryBadge";
import {
  resolveYouTubeEmbedUrl,
  type MediaTopicPayload,
} from "../../../../../../lib/admin/media-topic-payload";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import { getContentTypeLabel, isContentType } from "../../../../../../lib/admin/content/content-types";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UnifiedContentPreviewPage(props: PageProps) {
  await requireAdminSession();
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();

  const { data: topic } = await getSupabaseAdmin()
    .from("admin_content_topics")
    .select("id,title,slug,excerpt,content,image,image_alt,category_name,category_color_token,content_type,status,media_payload")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!topic || !isContentType(topic.content_type)) notFound();
  const payload = (topic.media_payload ?? null) as MediaTopicPayload | null;

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="INTERNAL CONTENT PREVIEW"
        title={topic.title || "معاينة المحتوى"}
        description="معاينة إدارية موحدة لا تسجل مشاهدة عامة ولا تغيّر حالة المحتوى."
        actions={
          <>
            <AdminStatusBadge status={topic.status === "published" ? "published" : "unpublished"} />
            <Link
              href={`/admin/content/topics/${topic.id}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              رجوع للتحرير
            </Link>
          </>
        }
      />

      <div className="rounded-[20px] border border-amber-400/20 bg-amber-500/8 px-5 py-4 text-sm text-amber-100">
        هذه معاينة داخلية فقط؛ لا تزيد عداد المشاهدات.
      </div>

      <article className="overflow-hidden rounded-[34px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        {topic.image ? (
          <div className="relative h-[320px] overflow-hidden bg-black/30">
            <Image
              src={topic.image}
              alt={topic.image_alt || topic.title || ""}
              fill
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-transparent" />
          </div>
        ) : null}

        <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <AdminCategoryBadge name={topic.category_name} colorToken={topic.category_color_token} />
            <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/45">
              {getContentTypeLabel(topic.content_type)}
            </span>
          </div>
          {topic.excerpt ? <p className="mb-8 text-lg leading-9 text-white/58">{topic.excerpt}</p> : null}

          {topic.content_type === "video" && payload?.kind === "video" ? (
            <VideoPreview url={payload.video_url} />
          ) : topic.content_type === "gallery" && payload?.kind === "gallery" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {payload.images.map((image, index) => (
                <figure key={`${image.url}-${index}`} className="overflow-hidden rounded-[20px] border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt || ""} className="h-64 w-full object-cover" />
                  {image.caption ? <figcaption className="px-4 py-3 text-sm text-white/55">{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : (
            <div className="space-y-4">{renderMarkdown(topic.content || "")}</div>
          )}
        </div>
      </article>
    </main>
  );
}

function renderMarkdown(content: string) {
  return content.split("\n").map((line, index) => {
    const key = `${index}-${line.slice(0, 20)}`;
    if (!line.trim()) return <div key={key} className="h-3" />;
    if (line.startsWith("# ")) return <h1 key={key} className="text-4xl font-semibold text-white">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={key} className="mt-8 text-2xl font-semibold text-[#D8B87A]">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={key} className="mt-6 text-xl font-semibold text-white">{line.slice(4)}</h3>;
    if (line.startsWith("- ")) return <li key={key} className="mr-6 list-disc leading-8 text-white/68">{line.slice(2)}</li>;
    return <p key={key} className="leading-9 text-white/68">{line}</p>;
  });
}

function VideoPreview({ url }: { url: string }) {
  const embedUrl = resolveYouTubeEmbedUrl(url);
  return embedUrl ? (
    <div className="aspect-video overflow-hidden rounded-[24px] border border-white/10">
      <iframe
        src={embedUrl}
        title="معاينة الفيديو"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  ) : (
    <p className="rounded-[18px] border border-white/10 p-5 text-sm text-white/45">رابط الفيديو غير صالح للمعاينة.</p>
  );
}
