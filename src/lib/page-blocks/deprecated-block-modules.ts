/**
 * Deprecated block modules — catalog metadata ONLY.
 *
 * Slider Block was a pre-launch placeholder in the Blocks library UI. It was
 * fully replaced by Hero Module. There is:
 * - no entry in PAGE_BLOCK_TYPES / PAGE_MODULE_KINDS
 * - no Supabase template or assignment table
 * - no public renderer or seed that creates slider assignments
 *
 * Do NOT add these keys to assignment pickers, module registries, or seeds.
 * Admin may show them only under the Deprecated section on /admin/pages-blocks/blocks.
 */
export const DEPRECATED_BLOCK_MODULE_KEYS = ["slider"] as const;

/** Historical authored shells retained only as inert migration provenance. */
export const RETIRED_MEDIA_CENTER_LISTING_SHELL_TEMPLATE_SLUGS = [
  "media-center-news-listing-shell",
  "media-center-videos-listing-shell",
  "media-center-gallery-listing-shell",
  "media-center-press-listing-shell",
  "media-center-site-updates-listing-shell",
] as const;

const RETIRED_CONTENT_BLOCK_TEMPLATE_SLUGS = new Set<string>(
  RETIRED_MEDIA_CENTER_LISTING_SHELL_TEMPLATE_SLUGS,
);

export function isRetiredContentBlockTemplateSlug(slug: string | null | undefined) {
  return Boolean(slug && RETIRED_CONTENT_BLOCK_TEMPLATE_SLUGS.has(slug));
}

export type DeprecatedBlockModuleKey = (typeof DEPRECATED_BLOCK_MODULE_KEYS)[number];

export const DEPRECATED_BLOCK_MODULE_CATALOG: Array<{
  key: DeprecatedBlockModuleKey;
  title: string;
  titleAr: string;
  description: string;
  replacedBy: string;
}> = [
  {
    key: "slider",
    title: "Slider Module",
    titleAr: "السلايدر",
    description:
      "Placeholder قديم — لا backend. استُبدل بالكامل بنظام Hero Module ولا يُستخدم بعد الآن.",
    replacedBy: "Hero Module",
  },
];
