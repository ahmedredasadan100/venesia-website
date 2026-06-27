/**
 * Default footer.slots layout — mirrors src/lib/footer/build-slots-from-legacy.ts
 * Used by seed/migration scripts only (keep in sync with app defaults).
 */

export const DEFAULT_FOOTER_BRAND = {
  title: "Venesia Developments",
  tagline: "Building trust before concrete.",
  contactHeading: "تواصل معنا",
  mediaHeading: "المركز الإعلامي",
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function withFooterBrandDefaults(brand = {}) {
  return {
    title: cleanText(brand.title) || DEFAULT_FOOTER_BRAND.title,
    tagline: cleanText(brand.tagline) || DEFAULT_FOOTER_BRAND.tagline,
    contactHeading: cleanText(brand.contactHeading) || DEFAULT_FOOTER_BRAND.contactHeading,
    mediaHeading: cleanText(brand.mediaHeading) || DEFAULT_FOOTER_BRAND.mediaHeading,
  };
}

/** Default column order: Text | Contact | Menu | Media */
export function buildFooterSlotsFromBrand(brandInput = {}) {
  const brand = withFooterBrandDefaults(brandInput);

  return {
    version: 1,
    slots: [
      {
        index: 1,
        enabled: true,
        type: "text",
        heading: null,
        config: {
          title: brand.title,
          body: brand.tagline,
          showBrandIcon: true,
          cta: { enabled: false, label: "", href: "", target: "_self" },
        },
      },
      {
        index: 2,
        enabled: true,
        type: "contact",
        heading: brand.contactHeading,
        config: { source: "global", items: [] },
      },
      {
        index: 3,
        enabled: true,
        type: "menu",
        heading: null,
        config: {
          source: "location",
          menuId: null,
          location: "footer",
          fallbackLocation: "main",
          maxItems: null,
          showOnlyTopLevel: true,
        },
      },
      {
        index: 4,
        enabled: true,
        type: "media",
        heading: brand.mediaHeading,
        config: {
          source: "main_submenu",
          parentHref: "/media-center",
          menuId: null,
          manualLinks: [],
          maxItems: null,
        },
      },
    ],
  };
}

export const FOOTER_SLOTS_SETTING_KEY = "footer.slots";

export const DEFAULT_FOOTER_SLOT_TYPES = ["text", "contact", "menu", "media"];
