import { connection } from "next/server";
import type { MetadataRoute } from "next";
import { PWA_CONFIG, PWA_ICON_PATHS } from "../config/pwa";
import { loadResolvedGlobalSeo } from "../lib/seo/generate-public-metadata";
import { resolveGlobalOrganizationIdentity } from "../lib/seo/resolve-global-organization-identity";

/** Installation identity consumes the same managed brand as HTML and JSON-LD. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const identity = resolveGlobalOrganizationIdentity(await loadResolvedGlobalSeo());
  return {
    name: identity.displayName,
    short_name: identity.mobileShortName,
    description: identity.displayTagline,
    start_url: PWA_CONFIG.startUrl,
    scope: PWA_CONFIG.scope,
    display: PWA_CONFIG.display,
    background_color: PWA_CONFIG.backgroundColor,
    theme_color: PWA_CONFIG.themeColor,
    lang: PWA_CONFIG.lang,
    dir: PWA_CONFIG.dir,
    icons: [
      { src: PWA_ICON_PATHS.icon192, sizes: "192x192", type: "image/png" },
      { src: PWA_ICON_PATHS.icon512, sizes: "512x512", type: "image/png" },
    ],
  };
}
