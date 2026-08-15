import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminCategoryBadge from "../../../../../../components/admin/content/AdminCategoryBadge";
import {
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../../../components/admin/ui";
import RichTextContent from "../../../../../../components/content/RichTextContent";
import {
  parseMediaTopicPayload,
  resolveYouTubeEmbedUrl,
} from "../../../../../../lib/admin/media-topic-payload";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import { getContentTypeLabel, isContentType } from "../../../../../../lib/admin/content/content-types";
import { getContentStatusMetadata } from "../../../../../../lib/admin/content/content-status-metadata";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UnifiedContentPreviewPage(props: PageProps) {
  await requireAdminSession();
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();
  const topicId = Number(id);
  if (!Number.isSafeInteger(topicId) || topicId <= 0) notFound();

  const { data: topic } = await getSupabaseAdmin()
    .from("admin_content_topics")
    .select("id,title,slug,excerpt,content,image,image_alt,category_name,category_color_token,content_type,status,media_payload")
    .eq("id", topicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!topic || !isContentType(topic.content_type)) notFound();
  const payload = parseMediaTopicPayload(topic.media_payload);
  const publication = getContentStatusMetadata(topic.status);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="INTERNAL CONTENT PREVIEW"
        title={topic.title || "معاينة المحتوى"}
        description="معاينة إدارية موحدة لا تسجل مشاهدة عامة ولا تغيّر حالة المحتوى."
        actions={
          <>
            <AdminStatusPill tone={publication.tone}>
              {publication.label}
            </AdminStatusPill>
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
            <RichTextContent
              value={topic.content}
              mode="markdown"
              className="article-rich-text article-rich-text--admin-preview"
            />
          )}
        </div>
      </article>
    </main>
  );
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
