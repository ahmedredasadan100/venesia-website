import JsonLd from "../../components/seo/JsonLd";
import AppChrome from "../../components/AppChrome";
import { FooterSettingsProvider } from "../../components/FooterSettingsProvider";
import { PublicNavigationProvider } from "../../components/PublicNavigationProvider";
import { loadFooterSettings } from "../../lib/footer/load-footer-settings";
import { resolveFooterComposition } from "../../lib/footer/resolve-footer-composition";
import { getPublicNavigationItems } from "../../lib/navigation/get-public-navigation";
import { logError } from "../../lib/logging";
import {
  buildOrganizationSchema,
  buildWebsiteSchema,
} from "../../lib/seo/build-jsonld";
import { buildAiVisibilityJson } from "../../lib/seo/build-ai-visibility";
import { buildFaqSchema } from "../../lib/seo/build-faq-schema";
import { VENESIA_FAQS } from "../../config/seo/faq-schema";

/** DB-backed public layout: cached loaders (300s) with graceful fallbacks when Supabase is unavailable. */
export const revalidate = 300;

const organizationSchema = buildOrganizationSchema();
const websiteSchema = buildWebsiteSchema();
const aiVisibilitySchema = buildAiVisibilityJson();
const faqSchema = buildFaqSchema(VENESIA_FAQS);

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let navigationItems: Awaited<ReturnType<typeof getPublicNavigationItems>> = [];
  let footerNavItems: Awaited<ReturnType<typeof getPublicNavigationItems>> = [];
  let footerSettings = await loadFooterSettings().catch(() => null);

  try {
    [navigationItems, footerNavItems] = await Promise.all([
      getPublicNavigationItems("main"),
      getPublicNavigationItems("footer"),
    ]);
  } catch (error) {
    logError("Failed to preload public navigation in site layout", error, { location: "main/footer" });
  }

  if (!footerSettings) {
    const { DEFAULT_FOOTER_SETTINGS } = await import("../../lib/footer/defaults");
    footerSettings = DEFAULT_FOOTER_SETTINGS;
  }

  const footerComposition = await resolveFooterComposition(footerSettings, {
    mainNavItems: navigationItems,
    footerNavItems,
  });

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={aiVisibilitySchema} />
      <JsonLd data={faqSchema} />

      <PublicNavigationProvider items={navigationItems}>
        <FooterSettingsProvider
          settings={footerSettings}
          footerNavItems={footerNavItems}
          footerComposition={footerComposition}
        >
          <AppChrome>{children}</AppChrome>
        </FooterSettingsProvider>
      </PublicNavigationProvider>
    </>
  );
}
