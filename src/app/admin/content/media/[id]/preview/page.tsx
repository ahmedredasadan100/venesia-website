import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminPageHeader from "../../../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../../../components/admin/AdminStatusBadge";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_SECTION_OPTIONS,
} from "../../media-content-config";
import type { MediaTopicPayload } from "../../../../../../lib/admin/media-topic-payload";

export const dynamic = "force-dynamic";

function getAdminStatus(status?: string | null) {
  if (status === "unpublished") return "hidden";
  return status || "draft";
}

function renderMarkdown(content: string) {
  return content
    .split("\n")
    .map((line, index) => {
      const key = `${index}-${line.slice(0, 20)}`;
      if (!line.trim()) return <div key={key} className="h-4" />;
      if (line.startsWith("### "))
        return (
          <h3 key={key} className="mt-8 text-xl font-semibold text-[#D8B87A]">
            {line.replace(/^###\s+/, "")}
          </h3>
        );
      if (line.startsWith("## "))
        return (
          <h2 key={key} className="mt-10 text-2xl font-semibold text-white">
            {line.replace(/^##\s+/, "")}
          </h2>
        );
      if (line.startsWith("# "))
        return (
          <h1 key={key} className="mb-6 text-4xl font-semibold leading-tight text-white">
            {line.replace(/^#\s+/, "")}
          </h1>
        );
      if (line.startsWith("- "))
        return (
          <li key={key} className="mr-6 list-disc text-base leading-8 text-white/68">
            {line.replace(/^-\s+/, "")}
          </li>
        );
      return (
        <p key={key} className="text-base leading-9 text-white/68">
          {line}
        </p>
      );
    });
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const id = parsed.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export default async function MediaContentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: topic } = await getSupabaseAdmin()
    .from("topics")
    .select("id, title, slug, excerpt, content, image, category, category_slug, content_type, status, media_payload")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!topic || !isMediaEditableContentType(topic.content_type)) notFound();

  const sectionLabel =
    MEDIA_SECTION_OPTIONS.find((option) => option.slug === topic.category_slug)?.label ??
    topic.category ??
    "المركز الإعلامي";

  const payload = (topic.media_payload ?? null) as MediaTopicPayload | null;

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="INTERNAL MEDIA PREVIEW"
        title={topic.title || "معاينة المحتوى الإعلامي"}
        description="معاينة داخلية للمحتوى الموحد. لا تعتمد على الموقع العام — المركز الإعلامي العام ما زال يقرأ من النظام القديم."
        actions={
          <>
            <AdminStatusBadge status={getAdminStatus(topic.status)} />
            <Link
              href={`/admin/content/media/${topic.id}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              رجوع للتحرير
            </Link>
          </>
        }
      />

      <div className="rounded-[20px] border border-amber-400/20 bg-amber-500/8 px-5 py-4 text-sm text-amber-100">
        هذه معاينة إدارية فقط. المحتوى الموحد غير منشور على `/media-center` العام حتى يتم اعتماد القطع العام لاحقًا.
      </div>

      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        {topic.image ? (
          <div className="relative h-[320px] overflow-hidden bg-black/30">
            <Image
              src={topic.image}
              alt={topic.title || "Media cover"}
              fill
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-transparent" />
          </div>
        ) : null}

        <article className="mx-auto max-w-4xl px-6 py-10 md:px-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-sm text-[#D8B87A]">
              {sectionLabel}
            </span>
            <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/45">
              {topic.content_type}
            </span>
          </div>

          {topic.excerpt ? <p className="mb-8 text-lg leading-9 text-white/58">{topic.excerpt}</p> : null}

          {topic.content_type === "video" && payload?.kind === "video" ? (
            <div className="space-y-4">
              {getYouTubeEmbedUrl(payload.video_url) ? (
                <div className="aspect-video overflow-hidden rounded-[24px] border border-white/10">
                  <iframe
                    src={getYouTubeEmbedUrl(payload.video_url) ?? undefined}
                    title={topic.title || "Video preview"}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p className="text-sm text-red-200">رابط YouTube غير صالح للمعاينة.</p>
              )}
            </div>
          ) : null}

          {topic.content_type === "gallery" && payload?.kind === "gallery" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {payload.images.map((image, index) => (
                <figure key={`${image.url}-${index}`} className="overflow-hidden rounded-[20px] border border-white/10">
                  <div className="relative aspect-[4/3] bg-black/20">
                    <Image
                      src={image.url}
                      alt={image.alt || `Gallery image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  {image.caption ? (
                    <figcaption className="px-4 py-3 text-sm text-white/55">{image.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : null}

          {["news", "press", "site_update"].includes(topic.content_type) ? (
            <div className="space-y-2">{renderMarkdown(topic.content ?? "")}</div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
