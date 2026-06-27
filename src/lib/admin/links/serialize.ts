import { findStaticRouteByHref, findStaticRouteByKey } from "./static-routes";
import type { AdminLinkKind, AdminLinkTarget, AdminLinkValue, LinkSearchResult, LinkedResourceType } from "./types";
import { ADMIN_LINK_KINDS, LINKED_RESOURCE_TYPES } from "./types";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readTarget(value: unknown): AdminLinkTarget {
  return value === "_blank" ? "_blank" : "_self";
}

function isLinkKind(value: string): value is AdminLinkKind {
  return ADMIN_LINK_KINDS.includes(value as AdminLinkKind);
}

function isLinkedType(value: string): value is LinkedResourceType {
  return LINKED_RESOURCE_TYPES.includes(value as LinkedResourceType);
}

function legacyFromHref(href: string): AdminLinkValue {
  const trimmed = href.trim();
  if (!trimmed) return emptyAdminLink();

  if (trimmed.startsWith("mailto:")) {
    return { link_kind: "email", href: trimmed, target: "_self" };
  }

  if (trimmed.startsWith("tel:")) {
    return { link_kind: "phone", href: trimmed, target: "_self" };
  }

  if (trimmed.startsWith("#")) {
    return { link_kind: "anchor", href: trimmed, anchor: trimmed.replace(/^#/, ""), target: "_self" };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { link_kind: "external", href: trimmed, target: "_blank" };
  }

  const staticRoute = findStaticRouteByHref(trimmed.split("#")[0] ?? trimmed);
  if (staticRoute) {
    const [path, anchorPart] = trimmed.split("#");
    return {
      link_kind: "static_route",
      linked_type: "static_routes",
      href: path,
      anchor: anchorPart || null,
      target: "_self",
      meta: { route_key: staticRoute.key },
    };
  }

  return { link_kind: "legacy", href: trimmed, target: "_self" };
}

export function emptyAdminLink(): AdminLinkValue {
  return { link_kind: "none", target: "_self" };
}

export function deserializeAdminLink(raw: unknown): AdminLinkValue {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) return legacyFromHref(raw);
    return emptyAdminLink();
  }

  const record = raw as Record<string, unknown>;
  const href = readString(record.href);
  const linkKindRaw = readString(record.link_kind);

  if (!linkKindRaw && href) return legacyFromHref(href);
  if (!linkKindRaw || !isLinkKind(linkKindRaw)) {
    return href ? legacyFromHref(href) : emptyAdminLink();
  }

  const linkedTypeRaw = readString(record.linked_type);
  const linkedType = linkedTypeRaw && isLinkedType(linkedTypeRaw) ? linkedTypeRaw : null;
  const routeKey = readString(record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>).route_key : "");

  return {
    link_kind: linkKindRaw,
    linked_type: linkedType,
    linked_id: readNumber(record.linked_id),
    href: href || null,
    anchor: readString(record.anchor) || null,
    target: readTarget(record.target),
    meta: routeKey ? { route_key: routeKey } : null,
  };
}

export function serializeAdminLink(value: AdminLinkValue | null | undefined): AdminLinkValue | null {
  if (!value || value.link_kind === "none") return null;

  const next: AdminLinkValue = {
    link_kind: value.link_kind,
    linked_type: value.linked_type ?? null,
    linked_id: value.linked_id ?? null,
    href: value.href?.trim() || null,
    anchor: value.anchor?.trim() || null,
    target: value.target ?? "_self",
    meta: value.meta ?? null,
  };

  if (next.link_kind === "static_route" && next.meta?.route_key) {
    const route = findStaticRouteByKey(next.meta.route_key);
    if (route) next.href = route.href;
  }

  return next;
}

export function adminLinkFromSearchResult(result: LinkSearchResult): AdminLinkValue {
  if (result.resourceType === "external") {
    return { link_kind: "external", href: result.publicPath, target: "_blank" };
  }

  if (result.resourceType === "static_routes") {
    return {
      link_kind: "static_route",
      linked_type: "static_routes",
      href: result.publicPath,
      target: "_self",
      meta: result.meta ?? null,
    };
  }

  return {
    link_kind: "internal",
    linked_type: result.resourceType,
    linked_id: result.resourceId,
    href: result.publicPath,
    target: "_self",
  };
}

export function legacyHrefFromConfig(raw: Record<string, unknown>, linkKey: string, hrefKey: string) {
  const link = deserializeAdminLink(raw[linkKey]);
  if (link.link_kind !== "none") return link;
  const href = readString(raw[hrefKey]);
  return href ? legacyFromHref(href) : emptyAdminLink();
}
