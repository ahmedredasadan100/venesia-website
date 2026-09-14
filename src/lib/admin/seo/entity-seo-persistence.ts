import "server-only";

import { createHash } from "node:crypto";
import {
  analyzeEntitySeo,
  resolveEntitySeoScoreInput,
  ENTITY_SEO_SCORE_VERSION,
  type SeoScoreInput,
} from "../seo-score";
import {
  isPersistedEntitySeoScore,
  type PersistedEntitySeoScore,
  type PersistedEntitySeoScoreSource,
} from "../../seo/entity-seo-types";
import type { Json } from "../../database.types";
import { parseTopicFaq } from "../content-workflow/topic-publish-validation";
import { getContentEditorAdapter, isContentType } from "../content/content-types";

export { PERSISTED_ENTITY_SEO_FIELDS } from "../../seo/entity-seo-types";
export { ENTITY_SEO_SCORE_VERSION } from "../seo-score";
export type { PersistedEntitySeoScore, PersistedEntitySeoScoreSource } from "../../seo/entity-seo-types";

export const TOPIC_SEO_SOURCE_COLUMNS = [
  "content_type", "title", "excerpt", "slug", "content", "image", "image_alt",
  "og_image", "og_image_alt", "seo_title", "seo_description", "seo_keywords",
  "focus_keyword", "faq",
] as const;

export const PROJECT_SEO_SOURCE_COLUMNS = [
  "arabic_name", "general_description", "overview_body", "slug", "hero_image",
  "hero_image_alt", "og_image", "og_image_alt", "seo_title", "seo_description",
  "seo_keywords", "focus_keyword",
] as const;

type SeoMetadataSource = {
  slug?: string | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[] | null;
  focus_keyword?: string | null;
};

export type TopicSeoSource = SeoMetadataSource & {
  content_type: string;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  faq?: Json | null;
};

export type ProjectSeoSource = SeoMetadataSource & {
  arabic_name?: string | null;
  general_description?: string | null;
  overview_body?: string | null;
  hero_image?: string | null;
  hero_image_alt?: string | null;
};

function text(value: string | null | undefined): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("Invalid Entity SEO text input.");
  return value;
}

function metadata(row: SeoMetadataSource) {
  if (row.seo_keywords != null && (!Array.isArray(row.seo_keywords)
    || row.seo_keywords.some((word) => typeof word !== "string"))) {
    throw new Error("Invalid Entity SEO keywords input.");
  }
  return {
    slug: text(row.slug),
    ogImage: text(row.og_image),
    ogImageAlt: text(row.og_image_alt),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    seoKeywords: row.seo_keywords ?? [],
    focusKeyword: text(row.focus_keyword),
  };
}

/** Topic and Media inputs follow their existing shared editor declarations. */
export function toTopicSeoScoreInput(row: TopicSeoSource): SeoScoreInput {
  if (!isContentType(row.content_type)) {
    throw new Error("Invalid Topic Entity SEO profile.");
  }
  const adapter = getContentEditorAdapter(row.content_type);
  const faq = !adapter.supportsFaq || row.faq == null ? [] : parseTopicFaq(row.faq);
  if (!faq) throw new Error("Invalid Topic Entity SEO FAQ input.");
  return resolveEntitySeoScoreInput({
    profile: row.content_type === "article" ? "article" : "entity",
    title: text(row.title), description: text(row.excerpt),
    content: adapter.body === "markdown" ? text(row.content) : "",
    image: text(row.image), imageAlt: text(row.image_alt),
    ...metadata(row), faq,
  });
}

/** Projects retain the shared editor's base-field fallbacks and entity profile. */
export function toProjectSeoScoreInput(row: ProjectSeoSource): SeoScoreInput {
  return resolveEntitySeoScoreInput({
    profile: "entity", title: text(row.arabic_name),
    description: text(row.general_description), content: text(row.overview_body),
    image: text(row.hero_image), imageAlt: text(row.hero_image_alt),
    ...metadata(row),
    faq: [],
  });
}

export function entitySeoInputHash(input: SeoScoreInput): string {
  // Fixed projection excludes incidental caller fields and object key order.
  // Fingerprint the canonical resolved inputs shared with the editor. Original
  // entity fields remain the source from which these inputs are reconstructed.
  const values = [
    input.profile, input.title, input.description, input.slug, input.content,
    input.image, input.imageAlt, input.ogImage, input.ogImageAlt,
    input.seoTitle, input.seoDescription, String(input.seoKeywords.length),
    ...input.seoKeywords, input.focusKeyword, String(input.faq.length),
    ...input.faq.flatMap((item) => [item.question ?? "", item.answer ?? ""]),
  ];
  const framed = values.map((value) => `${Buffer.byteLength(value, "utf8")}:${value}`).join("");
  return createHash("sha256").update(framed, "utf8").digest("hex");
}

/** Calculate before entering the existing entity write transaction. */
export function deriveEntitySeoScore(
  input: SeoScoreInput,
  previous?: PersistedEntitySeoScoreSource | null,
): PersistedEntitySeoScore {
  const hash = entitySeoInputHash(input);
  if (isPersistedEntitySeoScore(previous)
    && previous.seo_score_version === ENTITY_SEO_SCORE_VERSION
    && previous.seo_score_input_hash === hash) {
    return {
      seo_score: previous.seo_score,
      seo_score_version: previous.seo_score_version,
      seo_score_input_hash: previous.seo_score_input_hash,
    };
  }
  const analysis = analyzeEntitySeo(input);
  const result = {
    seo_score: analysis.score, seo_score_version: ENTITY_SEO_SCORE_VERSION,
    seo_score_input_hash: hash,
  };
  if (!isPersistedEntitySeoScore(result)) throw new Error("Invalid Entity SEO analysis result.");
  return result;
}
