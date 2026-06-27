import { findStaticRouteByKey } from "./static-routes";
import { ensureAdminLinkProvidersRegistered } from "./providers";
import { getAdminLinkProvider, listAdminLinkProviders } from "./registry";
import { deserializeAdminLink } from "./serialize";
import type { AdminLinkDisplay, AdminLinkValue, LinkSearchResult, LinkedResourceType } from "./types";

function appendAnchor(href: string, anchor?: string | null) {
  const cleanAnchor = anchor?.trim().replace(/^#/, "");
  if (!cleanAnchor) return href;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  if (/^https?:\/\//i.test(href)) return `${href.split("#")[0]}#${cleanAnchor}`;
  if (href === "#") return `#${cleanAnchor}`;
  return `${href.split("#")[0]}#${cleanAnchor}`;
}

const KIND_LABELS: Record<AdminLinkValue["link_kind"], string> = {
  internal: "داخلي",
  static_route: "مسار ثابت",
  external: "خارجي",
  email: "بريد",
  phone: "هاتف",
  anchor: "Anchor",
  download: "تنزيل",
  legacy: "رابط محفوظ",
  none: "بدون",
};

async function resolveInternalPath(type: LinkedResourceType, id: number, hrefFallback?: string | null) {
  ensureAdminLinkProvidersRegistered();

  if (type === "static_routes") {
    return hrefFallback?.trim() || "#";
  }

  const provider = getAdminLinkProvider(type);
  if (!provider) return hrefFallback?.trim() || "#";

  const map = await provider.resolveMany([id]);
  return map.get(id) ?? hrefFallback?.trim() ?? "#";
}

export async function resolveAdminLink(value: AdminLinkValue | null | undefined): Promise<string> {
  const link = value ? deserializeAdminLink(value) : { link_kind: "none" as const };

  if (link.link_kind === "none") return "#";

  if (link.link_kind === "internal" && link.linked_type && link.linked_id) {
    const href = await resolveInternalPath(link.linked_type, link.linked_id, link.href);
    return appendAnchor(href, link.anchor);
  }

  if (link.link_kind === "static_route") {
    const routeKey = link.meta?.route_key;
    const route = routeKey ? findStaticRouteByKey(routeKey) : null;
    const href = route?.href ?? link.href?.trim() ?? "#";
    return appendAnchor(href, link.anchor);
  }

  if (link.link_kind === "anchor") {
    const anchor = link.anchor?.trim() || link.href?.replace(/^#/, "") || "";
    return anchor ? `#${anchor}` : "#";
  }

  if (link.link_kind === "email" || link.link_kind === "phone" || link.link_kind === "external" || link.link_kind === "download") {
    return link.href?.trim() || "#";
  }

  return appendAnchor(link.href?.trim() || "#", link.anchor);
}

export async function resolveAdminLinks(values: AdminLinkValue[]) {
  return Promise.all(values.map((value) => resolveAdminLink(value)));
}

export async function enrichConfigWithResolvedLinks<T extends Record<string, unknown>>(
  config: T,
  mappings: Array<{ linkKey: string; hrefKey: string }>,
): Promise<T> {
  const next: Record<string, unknown> = { ...config };

  for (const mapping of mappings) {
    const link = deserializeAdminLink(config[mapping.linkKey] ?? config[mapping.hrefKey]);
    if (link.link_kind === "none") continue;
    next[mapping.hrefKey] = await resolveAdminLink(link);
    next[mapping.linkKey] = link;
  }

  return next as T;
}

export async function describeAdminLink(value: AdminLinkValue | null | undefined): Promise<AdminLinkDisplay> {
  const link = value ? deserializeAdminLink(value) : { link_kind: "none" as const, target: "_self" as const };
  const publicPath = await resolveAdminLink(link);

  if (link.link_kind === "internal" && link.linked_type && link.linked_id) {
    ensureAdminLinkProvidersRegistered();
    const provider = getAdminLinkProvider(link.linked_type);
    const results = provider ? await provider.search("", 300) : [];
    const match = results.find((item) => item.resourceId === link.linked_id);
    return {
      kind: link.link_kind,
      kindLabel: provider?.label ?? KIND_LABELS.internal,
      title: match?.title ?? `${link.linked_type} #${link.linked_id}`,
      publicPath,
      target: link.target ?? "_self",
    };
  }

  if (link.link_kind === "static_route") {
    const routeKey = link.meta?.route_key;
    const route = routeKey ? findStaticRouteByKey(routeKey) : null;
    return {
      kind: link.link_kind,
      kindLabel: KIND_LABELS.static_route,
      title: route?.label ?? "مسار ثابت",
      publicPath,
      target: link.target ?? "_self",
    };
  }

  return {
    kind: link.link_kind,
    kindLabel: KIND_LABELS[link.link_kind] ?? link.link_kind,
    title: link.href?.trim() || "—",
    publicPath,
    target: link.target ?? "_self",
  };
}

export async function searchAdminLinks(options: {
  query?: string;
  types?: LinkedResourceType[];
  limit?: number;
}): Promise<LinkSearchResult[]> {
  ensureAdminLinkProvidersRegistered();
  const query = options.query?.trim() ?? "";
  const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
  const providers = listAdminLinkProviders().filter((provider) =>
    options.types?.length ? options.types.includes(provider.type) : true,
  );

  const perProvider = Math.max(5, Math.ceil(limit / providers.length));
  const batches = await Promise.all(providers.map((provider) => provider.search(query, perProvider)));

  return batches
    .flat()
    .slice(0, limit)
    .sort((a, b) => a.title.localeCompare(b.title, "ar"));
}

export type { AdminLinkValue, LinkSearchResult, LinkedResourceType } from "./types";
export { deserializeAdminLink, emptyAdminLink, legacyHrefFromConfig, serializeAdminLink, adminLinkFromSearchResult } from "./serialize";
export { validateAdminLink, isAdminLinkEmpty } from "./validate";
export { ensureAdminLinkProvidersRegistered } from "./providers";
export { menuItemToAdminLink, adminLinkToMenuItemColumns, parentOnlyMenuItemColumns } from "./menu-bridge";
export type { MenuItemLinkColumns, MenuItemLinkRow } from "./menu-bridge";
export { findLinkUsages, isResourceLinked, getResourceLinkUsageCount } from "./usage";
export type { LinkUsageReference, LinkUsageQuery, LinkUsageSourceType } from "./usage";
