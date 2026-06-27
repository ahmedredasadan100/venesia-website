import { deserializeAdminLink, emptyAdminLink } from "./serialize";
import type { AdminLinkValue } from "./types";

export function linkDefaultFromContainer(
  container: Record<string, unknown> | null | undefined,
  linkKey = "link",
  hrefKey = "href",
): AdminLinkValue {
  if (!container) return emptyAdminLink();
  const linkRaw = container[linkKey];
  if (linkRaw) return deserializeAdminLink(linkRaw);
  const href = container[hrefKey];
  if (typeof href === "string" && href.trim()) return deserializeAdminLink(href);
  return emptyAdminLink();
}

export function hasAdminLinkInContainer(
  container: Record<string, unknown> | null | undefined,
  linkKey = "link",
  hrefKey = "href",
) {
  return linkDefaultFromContainer(container, linkKey, hrefKey).link_kind !== "none";
}
