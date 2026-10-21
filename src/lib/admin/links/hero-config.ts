import { legacyHrefFromConfig, resolveAdminLink } from "./index";
import { readHeroLinkTarget } from "../../page-sections";

export async function resolveHeroConfigLinks(config: Record<string, unknown> | null | undefined) {
  const raw = config ?? {};
  const primaryLink = {
    ...legacyHrefFromConfig(raw, "primaryCtaLink", "primaryCtaHref"),
    target: readHeroLinkTarget(raw.primaryCtaLink),
  };
  const secondaryLink = {
    ...legacyHrefFromConfig(raw, "secondaryCtaLink", "secondaryCtaHref"),
    target: readHeroLinkTarget(raw.secondaryCtaLink),
  };

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
