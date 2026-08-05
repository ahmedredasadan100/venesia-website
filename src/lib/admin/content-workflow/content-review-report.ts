import type { MediaTopicPayload } from "../media-topic-payload";
import {
  getMediaPublishBlockingChecks,
  mediaRowToPublishInput,
} from "./media-publish-validation";
import {
  getTopicPublishBlockingChecks,
  topicRowToPublishInput,
} from "./topic-publish-validation";
import {
  aggregateContentReviewAssessments,
  type ContentReviewReport,
} from "./content-review-report-aggregation";

export type { ContentReviewReport } from "./content-review-report-aggregation";

export type ContentReviewReportRow = {
  id: number;
  title: string;
  slug: string;
  status: string | null;
  contentType: string;
  excerpt: string;
  content: string;
  image: string;
  imageAlt: string;
  categorySlug: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogImage: string;
  ogImageAlt: string;
  faq: Array<{ question?: string; answer?: string }>;
  mediaPayload: MediaTopicPayload | null;
};

function blockingChecks(row: ContentReviewReportRow) {
  if (row.contentType === "article") {
    return getTopicPublishBlockingChecks(
      topicRowToPublishInput({
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        image: row.image,
        image_alt: row.imageAlt,
        category_slug: row.categorySlug,
        seo_title: row.seoTitle,
        seo_description: row.seoDescription,
        focus_keyword: row.focusKeyword,
        canonical_url: row.canonicalUrl,
        og_image: row.ogImage,
        og_image_alt: row.ogImageAlt,
        faq: row.faq,
      }),
    );
  }

  const input = mediaRowToPublishInput({
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    image: row.image,
    image_alt: row.imageAlt,
    category_slug: row.categorySlug,
    content_type: row.contentType,
    media_payload: row.mediaPayload,
    seo_title: row.seoTitle,
    seo_description: row.seoDescription,
    focus_keyword: row.focusKeyword,
    canonical_url: row.canonicalUrl,
    og_image: row.ogImage,
    og_image_alt: row.ogImageAlt,
  });

  if (!input) {
    return [{ id: "unsupported-content-type" }];
  }
  return getMediaPublishBlockingChecks(input);
}

export function buildContentReviewReport(
  rows: readonly ContentReviewReportRow[],
): ContentReviewReport {
  return aggregateContentReviewAssessments(rows.map((row) => {
    const blockers = blockingChecks(row);
    return {
      id: row.id,
      title: row.title,
      contentType: row.contentType,
      status: row.status,
      blockerIds: blockers.map((item) => item.id),
    };
  }));
}
