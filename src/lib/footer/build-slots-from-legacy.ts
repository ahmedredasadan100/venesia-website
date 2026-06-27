import type { FooterSlotsConfig } from "./footer-slot-types";
import { FOOTER_SLOTS_CONFIG_VERSION } from "./footer-slot-types";
import type { FooterLegacyBrandInput } from "./footer-slot-types";

const LEGACY_BRAND_DEFAULTS: FooterLegacyBrandInput = {
  title: "Venesia Developments",
  tagline: "Building trust before concrete.",
  contactHeading: "تواصل معنا",
  mediaHeading: "المركز الإعلامي",
};

function withBrandDefaults(brand: Partial<FooterLegacyBrandInput>): FooterLegacyBrandInput {
  return {
    title: brand.title?.trim() || LEGACY_BRAND_DEFAULTS.title,
    tagline: brand.tagline?.trim() || LEGACY_BRAND_DEFAULTS.tagline,
    contactHeading: brand.contactHeading?.trim() || LEGACY_BRAND_DEFAULTS.contactHeading,
    mediaHeading: brand.mediaHeading?.trim() || LEGACY_BRAND_DEFAULTS.mediaHeading,
  };
}

/**
 * Builds the default 4-slot layout from legacy footer.brand values.
 * Matches current SiteFooter column roles 1:1.
 */
export function buildSlotsFromLegacy(brandInput: Partial<FooterLegacyBrandInput> = {}): FooterSlotsConfig {
  const brand = withBrandDefaults(brandInput);

  return {
    version: FOOTER_SLOTS_CONFIG_VERSION,
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
