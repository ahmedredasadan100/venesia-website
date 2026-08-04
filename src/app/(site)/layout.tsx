import JsonLd from "../../components/seo/JsonLd";
import AppChrome from "../../components/AppChrome";
import { FooterSettingsProvider } from "../../components/FooterSettingsProvider";
import { PublicBrandProvider } from "../../components/PublicBrandProvider";
import { PublicNavigationProvider } from "../../components/PublicNavigationProvider";
import { loadFooterSettings } from "../../lib/footer/load-footer-settings";
import { resolveFooterComposition } from "../../lib/footer/resolve-footer-composition";
import { getPublicNavigationItems } from "../../lib/navigation/get-public-navigation";
import { logError } from "../../lib/logging";
import {
  buildOrganizationSchema,
  buildWebsiteSchema,
} from "../../lib/seo/build-jsonld";
import { loadResolvedGlobalSeo } from "../../lib/seo/generate-public-metadata";
import { resolveGlobalOrganizationIdentity } from "../../lib/seo/resolve-global-organization-identity";

/** DB-backed public layout. Footer outages fail safe without publishing code-owned composition. */
export const revalidate = 300;

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let navigationItems: Awaited<ReturnType<typeof getPublicNavigationItems>> = [];
  let footerNavItems: Awaited<ReturnType<typeof getPublicNavigationItems>> = [];
  let footerSettings = await loadFooterSettings().catch(() => null);
  const globalSeo = await loadResolvedGlobalSeo();
  const organizationIdentity = resolveGlobalOrganizationIdentity(globalSeo);

  try {
    [navigationItems, footerNavItems] = await Promise.all([
      getPublicNavigationItems("main"),
      getPublicNavigationItems("footer"),
    ]);
  } catch (error) {
    logError("Failed to preload public navigation in site layout", error, {
      location: "main/footer",
      resource: "layout:navigation",
    });
  }

  if (!footerSettings) {
    const { EMPTY_FOOTER_SETTINGS } = await import("../../lib/footer/defaults");
    footerSettings = structuredClone(EMPTY_FOOTER_SETTINGS);
  }

  const footerComposition = await resolveFooterComposition(footerSettings, {
    mainNavItems: navigationItems,
    footerNavItems,
  });

  const organizationSchema = buildOrganizationSchema(globalSeo);
  const websiteSchema = buildWebsiteSchema(globalSeo);

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <PublicNavigationProvider items={navigationItems}>
        <PublicBrandProvider identity={organizationIdentity}>
          <FooterSettingsProvider
            settings={footerSettings}
            footerNavItems={footerNavItems}
            footerComposition={footerComposition}
          >
            <AppChrome>{children}</AppChrome>
          </FooterSettingsProvider>
        </PublicBrandProvider>
      </PublicNavigationProvider>
    </>
  );
}
