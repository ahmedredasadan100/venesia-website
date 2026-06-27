import { legacyHrefFromConfig, resolveAdminLink } from "./index";

export async function resolveHeroConfigLinks(config: Record<string, unknown> | null | undefined) {
  const raw = config ?? {};
  const primaryLink = legacyHrefFromConfig(raw, "primaryCtaLink", "primaryCtaHref");
  const secondaryLink = legacyHrefFromConfig(raw, "secondaryCtaLink", "secondaryCtaHref");

  const [primaryCtaHref, secondaryCtaHref] = await Promise.all([
    primaryLink.link_kind !== "none" ? resolveAdminLink(primaryLink) : Promise.resolve(undefined),
    secondaryLink.link_kind !== "none" ? resolveAdminLink(secondaryLink) : Promise.resolve(undefined),
  ]);

  return {
    ...raw,
    ...(primaryLink.link_kind !== "none" ? { primaryCtaLink: primaryLink, primaryCtaHref } : {}),
    ...(secondaryLink.link_kind !== "none" ? { secondaryCtaLink: secondaryLink, secondaryCtaHref } : {}),
  };
}
