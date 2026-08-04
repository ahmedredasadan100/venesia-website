export const GLOBAL_SEO_EXISTING_OWNERS = {
  globalSettings: "src/lib/seo/load-global-seo-settings.ts",
  effectiveSource: "src/lib/seo/resolve-global-seo-effective.ts",
  publicMetadata: "src/lib/seo/resolve-seo-metadata.ts",
  organization: "src/lib/seo/resolve-global-organization-identity.ts",
  sitemap: "src/lib/seo/generate-sitemap-entries.ts",
  robots: "src/app/robots.ts",
  redirects: "src/lib/redirects/resolve-public-redirect.ts",
  cache: "src/lib/cache/revalidate-public-cache-tags.ts",
} as const;

export const GLOBAL_SEO_SPECIALIZED_OWNERS = [
  { id: "sitemap", owner: GLOBAL_SEO_EXISTING_OWNERS.sitemap },
  { id: "robots", owner: GLOBAL_SEO_EXISTING_OWNERS.robots },
  { id: "redirects", owner: GLOBAL_SEO_EXISTING_OWNERS.redirects },
] as const;

export const GLOBAL_SEO_PUBLIC_CONSUMERS = [
  "src/app/(site)/page.tsx",
  "src/app/(site)/about/page.tsx",
  "src/app/(site)/contact/page.tsx",
  "src/app/(site)/projects/page.tsx",
  "src/app/(site)/projects/[slug]/page.tsx",
  "src/app/(site)/topics/page.tsx",
  "src/app/(site)/topics/[slug]/page.tsx",
  "src/app/(site)/track-your-project/page.tsx",
  "src/app/(site)/track-your-project/[slug]/page.tsx",
  "src/app/(site)/media-center/page.tsx",
  "src/app/(site)/media-center/news/page.tsx",
  "src/app/(site)/media-center/news/[slug]/page.tsx",
  "src/app/(site)/media-center/press/page.tsx",
  "src/app/(site)/media-center/press/[slug]/page.tsx",
  "src/app/(site)/media-center/site-updates/page.tsx",
  "src/app/(site)/media-center/site-updates/[slug]/page.tsx",
  "src/app/(site)/media-center/videos/page.tsx",
  "src/app/(site)/media-center/videos/[slug]/page.tsx",
  "src/app/(site)/media-center/gallery/page.tsx",
  "src/app/(site)/media-center/gallery/[slug]/page.tsx",
  "src/app/(site)/[...slug]/page.tsx",
] as const;

export const GLOBAL_SEO_CONSUMER_ADOPTION = {
  scope: "all_public_metadata_routes_and_global_seo_infrastructure",
  expectedPublicConsumerCount: 21,
  entitySeoDependency: {
    mode: "reuse_only",
    owner: "src/lib/seo/entity-seo-types.ts",
  },
  entityReviewDependency: "none",
  parallelRuntime: false,
  parallelCapability: false,
  parallelSourceOfTruth: false,
} as const;
