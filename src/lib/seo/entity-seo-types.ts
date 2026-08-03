import type { SeoOpenGraphType, SeoRobotsDirective } from "../../config/seo/seo-types";

export const ENTITY_SEO_FIELD_NAMES = {
  seoTitle: "seo_title",
  seoDescription: "seo_description",
  focusKeyword: "focus_keyword",
  seoKeywords: "seo_keywords",
  canonicalUrl: "canonical_url",
  robotsIndex: "robots_index",
  robotsFollow: "robots_follow",
  ogImage: "og_image",
  ogImageAlt: "og_image_alt",
} as const;

export const ENTITY_SEO_LIMITS = {
  title: { min: 45, max: 60 },
  description: { min: 120, max: 160 },
} as const;

export const ENTITY_SEO_SELECT = Object.values(ENTITY_SEO_FIELD_NAMES).join(",");

export type EntitySeoValues = {
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  seoKeywords: string[];
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogImage: string;
  ogImageAlt: string;
};

export type EntitySeoPersistenceRecord = {
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  seo_keywords: string[];
  canonical_url: string | null;
  robots_index: boolean | null;
  robots_follow: boolean | null;
  og_image: string | null;
  og_image_alt: string;
};

export type EntitySeoPersistenceRow = {
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  seo_keywords?: string[] | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
};

export type EntitySeoValidationIssue = {
  field: (typeof ENTITY_SEO_FIELD_NAMES)[keyof typeof ENTITY_SEO_FIELD_NAMES];
  message: string;
};

export type EntitySeoData = {
  title?: string | null;
  description?: string | null;
  focusKeyword?: string | null;
  keywords?: string[] | null;
  image?: string | null;
  imageAlt?: string | null;
  ogImage?: string | null;
  ogImageAlt?: string | null;
  canonical?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
};

export type ResolveSeoMetadataInput = {
  path: string;
  entitySeo?: EntitySeoData | null;
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  type?: SeoOpenGraphType;
  robots?: SeoRobotsDirective;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

export type ResolvedSeoMetadata = {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  canonical: string;
  metadataBase: string;
  siteName: string;
  image: string;
  imageAlt: string;
  twitterImage: string;
  type: SeoOpenGraphType;
  robots: SeoRobotsDirective;
  twitterHandle?: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableBoolean(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function parseEntitySeoKeywords(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;،؛]+/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  ];
}

export function readEntitySeoFormData(formData: FormData): EntitySeoValues {
  return {
    seoTitle: readString(formData, ENTITY_SEO_FIELD_NAMES.seoTitle),
    seoDescription: readString(formData, ENTITY_SEO_FIELD_NAMES.seoDescription),
    focusKeyword: readString(formData, ENTITY_SEO_FIELD_NAMES.focusKeyword),
    seoKeywords: parseEntitySeoKeywords(
      readString(formData, ENTITY_SEO_FIELD_NAMES.seoKeywords),
    ),
    canonicalUrl: readString(formData, ENTITY_SEO_FIELD_NAMES.canonicalUrl),
    robotsIndex: readNullableBoolean(formData, ENTITY_SEO_FIELD_NAMES.robotsIndex),
    robotsFollow: readNullableBoolean(formData, ENTITY_SEO_FIELD_NAMES.robotsFollow),
    ogImage: readString(formData, ENTITY_SEO_FIELD_NAMES.ogImage),
    ogImageAlt: readString(formData, ENTITY_SEO_FIELD_NAMES.ogImageAlt),
  };
}

export function entitySeoValuesFromPersistence(
  row: EntitySeoPersistenceRow,
): EntitySeoValues {
  return {
    seoTitle: row.seo_title?.trim() ?? "",
    seoDescription: row.seo_description?.trim() ?? "",
    focusKeyword: row.focus_keyword?.trim() ?? "",
    seoKeywords: Array.isArray(row.seo_keywords)
      ? row.seo_keywords.map(String).map((value) => value.trim()).filter(Boolean)
      : [],
    canonicalUrl: row.canonical_url?.trim() ?? "",
    robotsIndex: row.robots_index ?? null,
    robotsFollow: row.robots_follow ?? null,
    ogImage: row.og_image?.trim() ?? "",
    ogImageAlt: row.og_image_alt?.trim() ?? "",
  };
}

export function entitySeoDataFromPersistence(
  row: EntitySeoPersistenceRow,
): EntitySeoData {
  const values = entitySeoValuesFromPersistence(row);
  return {
    title: values.seoTitle,
    description: values.seoDescription,
    focusKeyword: values.focusKeyword,
    keywords: values.seoKeywords,
    canonical: values.canonicalUrl,
    robotsIndex: values.robotsIndex,
    robotsFollow: values.robotsFollow,
    ogImage: values.ogImage,
    ogImageAlt: values.ogImageAlt,
  };
}

export function toEntitySeoPersistence(
  values: EntitySeoValues,
): EntitySeoPersistenceRecord {
  return {
    seo_title: values.seoTitle.trim(),
    seo_description: values.seoDescription.trim(),
    focus_keyword: values.focusKeyword.trim(),
    seo_keywords: values.seoKeywords.map((value) => value.trim()).filter(Boolean),
    canonical_url: values.canonicalUrl.trim() || null,
    robots_index: values.robotsIndex,
    robots_follow: values.robotsFollow,
    og_image: values.ogImage.trim() || null,
    og_image_alt: values.ogImageAlt.trim(),
  };
}

export function validateEntitySeoValues(
  values: EntitySeoValues,
): EntitySeoValidationIssue[] {
  const issues: EntitySeoValidationIssue[] = [];
  if (values.seoTitle.length > ENTITY_SEO_LIMITS.title.max) {
    issues.push({
      field: ENTITY_SEO_FIELD_NAMES.seoTitle,
      message: `عنوان SEO لا يتجاوز ${ENTITY_SEO_LIMITS.title.max} حرفًا.`,
    });
  }
  if (values.seoDescription.length > ENTITY_SEO_LIMITS.description.max) {
    issues.push({
      field: ENTITY_SEO_FIELD_NAMES.seoDescription,
      message: `الوصف التعريفي لا يتجاوز ${ENTITY_SEO_LIMITS.description.max} حرفًا.`,
    });
  }
  if (values.canonicalUrl) {
    try {
      const url = new URL(values.canonicalUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      issues.push({
        field: ENTITY_SEO_FIELD_NAMES.canonicalUrl,
        message: "الرابط الأساسي يجب أن يبدأ بـ http أو https.",
      });
    }
  }
  if (values.ogImage && !values.ogImageAlt) {
    issues.push({
      field: ENTITY_SEO_FIELD_NAMES.ogImageAlt,
      message: "النص البديل لصورة المشاركة مطلوب عند اختيار الصورة.",
    });
  }
  return issues;
}

export function mergeEntitySeoData(
  primary: EntitySeoData | null | undefined,
  fallback: EntitySeoData | null | undefined,
): EntitySeoData | null {
  if (!primary && !fallback) return null;
  const pick = <T,>(value: T | null | undefined, inherited: T | null | undefined) => {
    if (typeof value === "string" && !value.trim()) return inherited;
    return value ?? inherited;
  };
  return {
    title: pick(primary?.title, fallback?.title),
    description: pick(primary?.description, fallback?.description),
    focusKeyword: pick(primary?.focusKeyword, fallback?.focusKeyword),
    keywords: primary?.keywords?.length ? primary.keywords : fallback?.keywords,
    image: pick(primary?.image, fallback?.image),
    imageAlt: pick(primary?.imageAlt, fallback?.imageAlt),
    ogImage: pick(primary?.ogImage, fallback?.ogImage),
    ogImageAlt: pick(primary?.ogImageAlt, fallback?.ogImageAlt),
    canonical: pick(primary?.canonical, fallback?.canonical),
    robotsIndex: pick(primary?.robotsIndex, fallback?.robotsIndex),
    robotsFollow: pick(primary?.robotsFollow, fallback?.robotsFollow),
  };
}
