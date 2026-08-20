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
  { route: "/", sourceFile: "src/app/(site)/page.tsx" },
  { route: "/about", sourceFile: "src/app/(site)/about/page.tsx" },
  { route: "/contact", sourceFile: "src/app/(site)/contact/page.tsx" },
  { route: "/projects", sourceFile: "src/app/(site)/projects/page.tsx" },
  {
    route: "/projects/[slug]",
    sourceFile: "src/app/(site)/projects/[slug]/page.tsx",
  },
  { route: "/topics", sourceFile: "src/app/(site)/topics/page.tsx" },
  {
    route: "/topics/[slug]",
    sourceFile: "src/app/(site)/topics/[slug]/page.tsx",
  },
  {
    route: "/track-your-project",
    sourceFile: "src/app/(site)/track-your-project/page.tsx",
  },
  {
    route: "/track-your-project/[slug]",
    sourceFile: "src/app/(site)/track-your-project/[slug]/page.tsx",
  },
  {
    route: "/media-center",
    sourceFile: "src/app/(site)/media-center/page.tsx",
  },
  {
    route: "/media-center/news",
    sourceFile: "src/app/(site)/media-center/news/page.tsx",
  },
  {
    route: "/media-center/news/[slug]",
    sourceFile: "src/app/(site)/media-center/news/[slug]/page.tsx",
  },
  {
    route: "/media-center/press",
    sourceFile: "src/app/(site)/media-center/press/page.tsx",
  },
  {
    route: "/media-center/press/[slug]",
    sourceFile: "src/app/(site)/media-center/press/[slug]/page.tsx",
  },
  {
    route: "/media-center/site-updates",
    sourceFile: "src/app/(site)/media-center/site-updates/page.tsx",
  },
  {
    route: "/media-center/site-updates/[slug]",
    sourceFile:
      "src/app/(site)/media-center/site-updates/[slug]/page.tsx",
  },
  {
    route: "/media-center/videos",
    sourceFile: "src/app/(site)/media-center/videos/page.tsx",
  },
  {
    route: "/media-center/videos/[slug]",
    sourceFile: "src/app/(site)/media-center/videos/[slug]/page.tsx",
  },
  {
    route: "/media-center/gallery",
    sourceFile: "src/app/(site)/media-center/gallery/page.tsx",
  },
  {
    route: "/media-center/gallery/[slug]",
    sourceFile: "src/app/(site)/media-center/gallery/[slug]/page.tsx",
  },
  { route: "/[...slug]", sourceFile: "src/app/(site)/[...slug]/page.tsx" },
] as const;

export const GLOBAL_SEO_CONSUMER_ADOPTION = {
  scope: "all_public_metadata_routes_and_global_seo_infrastructure",
  globalClosed: true,
  entitySeoDependency: {
    mode: "reuse_only",
    owner: "src/lib/seo/entity-seo-types.ts",
  },
  entityReviewDependency: "none",
  parallelRuntime: false,
  parallelCapability: false,
  parallelSourceOfTruth: false,
} as const;
