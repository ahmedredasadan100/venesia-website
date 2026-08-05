import "server-only";

import type { MediaTopicPayload } from "../media-topic-payload";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  buildContentReviewReport,
  type ContentReviewReport,
  type ContentReviewReportRow,
} from "./content-review-report";

const REVIEW_PAGE_SIZE = 500;
const REVIEW_SELECT = [
  "id",
  "title",
  "slug",
  "status",
  "content_type",
  "excerpt",
  "content",
  "image",
  "image_alt",
  "category_slug",
  "seo_title",
  "seo_description",
  "focus_keyword",
  "canonical_url",
  "og_image",
  "og_image_alt",
  "faq",
  "media_payload",
].join(",");

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function mediaPayload(value: unknown): MediaTopicPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.kind === "video") {
    if (input.provider !== "youtube") return null;
    return {
      kind: "video",
      provider: "youtube",
      video_url: text(input.video_url),
      thumbnail: input.thumbnail == null ? null : text(input.thumbnail),
      duration: input.duration == null ? null : text(input.duration),
    };
  }
  if (input.kind === "gallery") {
    const images = Array.isArray(input.images) ? input.images : [];
    return {
      kind: "gallery",
      images: images.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const image = item as Record<string, unknown>;
        return [{
          url: text(image.url),
          alt: image.alt == null ? null : text(image.alt),
          caption: image.caption == null ? null : text(image.caption),
        }];
      }),
    };
  }
  return null;
}

function mapRow(row: Record<string, unknown>): ContentReviewReportRow {
  return {
    id: Number(row.id),
    title: text(row.title),
    slug: text(row.slug),
    status: row.status == null ? null : text(row.status),
    contentType: text(row.content_type),
    excerpt: text(row.excerpt),
    content: text(row.content),
    image: text(row.image),
    imageAlt: text(row.image_alt),
    categorySlug: text(row.category_slug),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    focusKeyword: text(row.focus_keyword),
    canonicalUrl: text(row.canonical_url),
    ogImage: text(row.og_image),
    ogImageAlt: text(row.og_image_alt),
    faq: Array.isArray(row.faq)
      ? row.faq.flatMap((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? [{
                question: text((item as Record<string, unknown>).question),
                answer: text((item as Record<string, unknown>).answer),
              }]
            : [],
        )
      : [],
    mediaPayload: mediaPayload(row.media_payload),
  };
}

export async function loadContentReviewReport(): Promise<ContentReviewReport> {
  const rows: ContentReviewReportRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select(REVIEW_SELECT)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + REVIEW_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []).map((row) =>
      mapRow(row as unknown as Record<string, unknown>),
    );
    rows.push(...batch);
    if (batch.length < REVIEW_PAGE_SIZE) break;
    from += REVIEW_PAGE_SIZE;
  }

  return buildContentReviewReport(rows);
}
