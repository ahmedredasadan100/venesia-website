/** Reference slugs for stabilizing About / Contact / Topics — informational in admin only. */
export const PAGE_MODULE_HINTS: Record<
  string,
  Array<{ module: string; slugs: string[]; note?: string }>
> = {
  about: [
    { module: "Hero", slugs: [], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-about"], note: "slot: hero" },
    { module: "Content", slugs: ["about-intro", "vision-goals", "about-cta", "about-approach", "about-principles"], note: "slot: main" },
    { module: "Cards", slugs: ["about-documentary-beats"], note: "slot: main" },
  ],
  contact: [
    { module: "Hero", slugs: [], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-contact"], note: "slot: hero" },
    { module: "Cards", slugs: ["contact-trust-cards", "contact-reasons", "contact-departments", "contact-faq"] },
    { module: "Content", slugs: ["contact-form-office", "contact-form", "contact-map"] },
    { module: "CTA", slugs: ["contact-cta"] },
  ],
  topics: [
    { module: "Hero", slugs: [], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-topics"], note: "slot: hero" },
    { module: "Content", slugs: ["topics-intro"], note: "slot: main" },
    { module: "Feed", slugs: ["topics-feed-categories", "topics-feed-latest", "topics-feed-popular", "topics-feed-series"], note: "slot: sidebar" },
    { module: "CTA", slugs: ["topics-insight-cta"], note: "slot: sidebar" },
  ],
  home: [
    { module: "Hero", slugs: [], note: "slot: hero" },
    { module: "Content", slugs: ["home-story", "home-trust", "home-contact", "home-projects"], note: "slot: main" },
  ],
  "media-center": [
    { module: "Hero", slugs: ["hero-media-center"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center"], note: "slot: hero" },
    {
      module: "Media Hub",
      slugs: [
        "media-hub-featured",
        "media-hub-site-updates",
        "media-hub-videos",
        "media-hub-gallery",
        "media-hub-press",
      ],
      note: "slot: main",
    },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "media-center-news": [
    { module: "Hero", slugs: ["hero-media-center-news"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center-news"], note: "slot: hero" },
    { module: "Content", slugs: ["media-center-news-listing-shell"], note: "slot: main (optional shell)" },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "media-center-videos": [
    { module: "Hero", slugs: ["hero-media-center-videos"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center-videos"], note: "slot: hero" },
    { module: "Content", slugs: ["media-center-videos-listing-shell"], note: "slot: main (optional shell)" },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "media-center-gallery": [
    { module: "Hero", slugs: ["hero-media-center-gallery"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center-gallery"], note: "slot: hero" },
    { module: "Content", slugs: ["media-center-gallery-listing-shell"], note: "slot: main (optional shell)" },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "media-center-press": [
    { module: "Hero", slugs: ["hero-media-center-press"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center-press"], note: "slot: hero" },
    { module: "Content", slugs: ["media-center-press-listing-shell"], note: "slot: main (optional shell)" },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "media-center-site-updates": [
    { module: "Hero", slugs: ["hero-media-center-site-updates"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-media-center-site-updates"], note: "slot: hero" },
    { module: "Content", slugs: ["media-center-site-updates-listing-shell"], note: "slot: main (optional shell)" },
    { module: "Media Sidebar", slugs: ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"], note: "slot: sidebar" },
  ],
  "track-your-project": [
    { module: "Hero", slugs: ["hero-track-your-project"], note: "slot: hero" },
    { module: "Breadcrumb", slugs: ["breadcrumb-track-your-project"], note: "slot: hero" },
    { module: "Content", slugs: ["track-intro"], note: "slot: main" },
    { module: "CTA", slugs: ["track-contact-cta"], note: "slot: before-footer" },
  ],
};
