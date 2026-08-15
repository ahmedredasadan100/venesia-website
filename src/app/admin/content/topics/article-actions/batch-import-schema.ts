import { createHash } from "node:crypto";

import { z } from "zod";

export const ARTICLE_BATCH_IMPORT_MAX_FAQ_ITEMS = 8;

const targetIdentitySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
}).strict();

export const articleBatchImportTargetSchema = z.object({
  category: targetIdentitySchema,
  series: targetIdentitySchema,
}).strict();

const faqItemSchema = z.object({
  question: z.string().refine((value) => value.trim().length > 0, {
    message: "FAQ question must not be empty.",
  }),
  answer: z.string().refine((value) => value.trim().length > 0, {
    message: "FAQ answer must not be empty.",
  }),
}).strict();

export const articleBatchImportItemSchema = z.object({
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  content: z.string(),
  image: z.string(),
  image_alt: z.string(),
  category_id: z.number().int().positive(),
  series_id: z.number().int().positive(),
  faq: z.array(faqItemSchema).min(1).max(ARTICLE_BATCH_IMPORT_MAX_FAQ_ITEMS),
  seo_title: z.string(),
  seo_description: z.string(),
  focus_keyword: z.string(),
  seo_keywords: z.array(z.string()),
  canonical_url: z.string(),
  robots_index: z.boolean().nullable(),
  robots_follow: z.boolean().nullable(),
  og_image: z.string(),
  og_image_alt: z.string(),
  is_featured: z.boolean(),
  is_popular: z.boolean(),
  show_title_on_page: z.boolean(),
  show_image_on_page: z.boolean(),
  show_excerpt_on_page: z.boolean(),
  show_faq_on_page: z.boolean(),
  show_faq_title_on_page: z.boolean(),
}).strict();

export const articleBatchImportEnvelopeSchema = z.object({
  batch_key: z.string().min(1),
  target: articleBatchImportTargetSchema,
  articles: z.array(z.unknown()).min(1),
}).strict();

export type ArticleBatchImportTarget = z.infer<
  typeof articleBatchImportTargetSchema
>;
export type ArticleBatchImportItem = z.infer<
  typeof articleBatchImportItemSchema
>;

export type ArticleBatchImportError = {
  code: string;
  field: string | null;
  message: string;
};

export function zodIssuesToBatchErrors(
  issues: readonly z.core.$ZodIssue[],
): ArticleBatchImportError[] {
  return issues.map((issue) => ({
    code: `schema_${issue.code}`,
    field: issue.path.length ? issue.path.join(".") : null,
    message: issue.message,
  }));
}

export function findDuplicateValues(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function buildArticleBatchImportFingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}
