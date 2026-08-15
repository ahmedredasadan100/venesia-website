import "server-only";

import { parseMediaTopicPayload } from "../media-topic-payload";
import type { Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { parseTopicFaq } from "./topic-publish-validation";
import {
  buildContentReviewReport,
  type ContentReviewReport,
  type ContentReviewReportRow,
} from "./content-review-report";

const REVIEW_PAGE_SIZE = 500;
const REVIEW_SELECT =
  "id,title,slug,status,content_type,excerpt,content,image,image_alt,category_slug,seo_title,seo_description,focus_keyword,canonical_url,og_image,og_image_alt,faq,media_payload";

type ContentReviewDatabaseRow = Pick<
  Tables<"topics">,
  | "id"
  | "title"
  | "slug"
  | "status"
  | "content_type"
  | "excerpt"
  | "content"
  | "image"
  | "image_alt"
  | "category_slug"
  | "seo_title"
  | "seo_description"
  | "focus_keyword"
  | "canonical_url"
  | "og_image"
  | "og_image_alt"
  | "faq"
  | "media_payload"
>;

function text(value: string | null | undefined) {
  return value == null ? "" : String(value);
}

function mapRow(row: ContentReviewDatabaseRow): ContentReviewReportRow {
  const faq = parseTopicFaq(row.faq);
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
    faq: faq ?? [],
    faqContractValid: faq !== null,
    mediaPayload: parseMediaTopicPayload(row.media_payload),
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

    const batch = (data ?? []).map(mapRow);
    rows.push(...batch);
    if (batch.length < REVIEW_PAGE_SIZE) break;
    from += REVIEW_PAGE_SIZE;
  }

  return buildContentReviewReport(rows);
}
