import type { AdminLinkValue, LinkedResourceType } from "./types";
import { deserializeAdminLink, emptyAdminLink } from "./serialize";

export type MenuItemLinkRow = {
  item_type: string;
  href: string | null;
  linked_type: string | null;
  linked_id: number | null;
  anchor: string | null;
  target: string;
};

export type MenuItemLinkColumns = {
  itemType: string;
  href: string;
  linkedType: string | null;
  linkedId: number | null;
  anchor: string | null;
  target: "_self" | "_blank";
};

const INTERNAL_ITEM_TYPES: Record<LinkedResourceType, string> = {
  pages: "page",
  projects: "project",
  topics: "topic",
  topic_categories: "topic_category",
  topic_series: "custom",
  media_items: "custom",
  static_routes: "page",
};

export function menuItemToAdminLink(item?: MenuItemLinkRow | null): AdminLinkValue {
  if (!item || item.item_type === "parent") return emptyAdminLink();

  if (item.linked_type && item.linked_id) {
    return deserializeAdminLink({
      link_kind: "internal",
      linked_type: item.linked_type,
      linked_id: item.linked_id,
      href: item.href,
      anchor: item.anchor,
      target: item.target,
    });
  }

  if (item.item_type === "external") {
    return {
      link_kind: "external",
      href: item.href,
      anchor: item.anchor,
      target: item.target === "_blank" ? "_blank" : "_self",
    };
  }

  if (item.item_type === "anchor") {
    return {
      link_kind: "anchor",
      href: item.href ?? (item.anchor ? `#${item.anchor}` : "#"),
      anchor: item.anchor,
      target: "_self",
    };
  }

  if (item.item_type === "page") {
    return deserializeAdminLink({
      href: item.href,
      anchor: item.anchor,
      target: item.target,
    });
  }

  if (item.href) {
    return deserializeAdminLink({
      href: item.href,
      anchor: item.anchor,
      target: item.target,
    });
  }

  return emptyAdminLink();
}

export function adminLinkToMenuItemColumns(
  link: AdminLinkValue,
  resolvedHrefWithoutAnchor: string,
): MenuItemLinkColumns {
  const target = link.target ?? "_self";
  const anchor = link.anchor?.trim().replace(/^#/, "") || null;

  if (link.link_kind === "internal" && link.linked_type && link.linked_id) {
    return {
      itemType: INTERNAL_ITEM_TYPES[link.linked_type] ?? "custom",
      href: resolvedHrefWithoutAnchor,
      linkedType: link.linked_type,
      linkedId: link.linked_id,
      anchor,
      target,
    };
  }

  if (link.link_kind === "static_route") {
    return {
      itemType: "page",
      href: resolvedHrefWithoutAnchor,
      linkedType: "static_routes",
      linkedId: null,
      anchor,
      target,
    };
  }

  if (link.link_kind === "external") {
    return {
      itemType: "external",
      href: link.href?.trim() || resolvedHrefWithoutAnchor,
      linkedType: null,
      linkedId: null,
      anchor: null,
      target,
    };
  }

  if (link.link_kind === "anchor") {
    return {
      itemType: "anchor",
      href: link.href?.trim() || "#",
      linkedType: null,
      linkedId: null,
      anchor,
      target: "_self",
    };
  }

  return {
    itemType: "custom",
    href: resolvedHrefWithoutAnchor || link.href?.trim() || "#",
    linkedType: null,
    linkedId: null,
    anchor: link.link_kind === "legacy" ? anchor : null,
    target,
  };
}

export function parentOnlyMenuItemColumns(): MenuItemLinkColumns {
  return {
    itemType: "parent",
    href: "#",
    linkedType: null,
    linkedId: null,
    anchor: null,
    target: "_self",
  };
}
