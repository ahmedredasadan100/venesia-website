import "server-only";

import { getPublicNavigationItems, getPublicNavigationItemsByMenuId } from "../navigation/get-public-navigation";
import type { PublicNavigationItem } from "../public-navigation";
import type {
  FooterContactSlotConfig,
  FooterCustomLinksSlotConfig,
  FooterManualLink,
  FooterMediaSlotConfig,
  FooterMenuLocation,
  FooterMenuSlotConfig,
  FooterSlot,
  FooterTextSlotConfig,
} from "./footer-slot-types";
import type {
  FooterComposition,
  ResolvedFooterContactSlot,
  ResolvedFooterCustomLinksSlot,
  ResolvedFooterLink,
  ResolvedFooterMediaSlot,
  ResolvedFooterMenuSlot,
  ResolvedFooterSlot,
  ResolvedFooterTextSlot,
} from "./resolved-footer-types";
import { isFooterContactItemPublic } from "./parse-footer-settings";
import type { FooterContactItem, FooterSettings } from "./types";

export type FooterNavigationContext = {
  mainNavItems: PublicNavigationItem[];
  footerNavItems: PublicNavigationItem[];
};

function revealDelayForIndex(index: number) {
  return (index - 1) * 80;
}

function limitItems<T>(items: T[], maxItems: number | null) {
  if (!maxItems || maxItems < 1) return items;
  return items.slice(0, maxItems);
}

function mapNavItemsToLinks(items: PublicNavigationItem[]): ResolvedFooterLink[] {
  return items.map(({ label, href, target }) => ({ label, href, target }));
}

function mapManualLinksToResolved(links: FooterManualLink[]): ResolvedFooterLink[] {
  return links
    .filter((link) => link.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(({ label, href, target }) => ({
      label,
      href,
      target: target === "_blank" ? "_blank" : "_self",
    }));
}

function resolveContactItems(
  config: FooterContactSlotConfig,
  globalItems: FooterContactItem[],
): FooterContactItem[] {
  const items = config.source === "custom"
    ? config.items
    : globalItems;
  return items.filter((item) => isFooterContactItemPublic(item));
}

function resolveTextSlot(slot: FooterSlot<"text">): ResolvedFooterTextSlot {
  const config = slot.config as FooterTextSlotConfig;

  return {
    index: slot.index,
    type: "text",
    heading: slot.heading,
    revealDelay: revealDelayForIndex(slot.index),
    title: config.title.trim(),
    body: config.body.trim(),
    showBrandIcon: config.showBrandIcon,
    cta: {
      enabled: config.cta.enabled,
      label: config.cta.label,
      href: config.cta.href,
      target: config.cta.target === "_blank" ? "_blank" : "_self",
    },
  };
}

function resolveContactSlot(
  slot: FooterSlot<"contact">,
  globalItems: FooterContactItem[],
): ResolvedFooterContactSlot {
  return {
    index: slot.index,
    type: "contact",
    heading: slot.heading,
    revealDelay: revealDelayForIndex(slot.index),
    items: resolveContactItems(slot.config, globalItems),
  };
}

function navigationForLocation(
  location: FooterMenuLocation,
  nav: FooterNavigationContext,
): PublicNavigationItem[] {
  if (location === "footer") return nav.footerNavItems;
  if (location === "main") return nav.mainNavItems;
  return [];
}

async function resolveMenuLinks(
  config: FooterMenuSlotConfig,
  nav: FooterNavigationContext,
): Promise<ResolvedFooterLink[]> {
  let items: PublicNavigationItem[] = [];

  if (config.source === "menu_id" && config.menuId) {
    items = await getPublicNavigationItemsByMenuId(config.menuId);
  } else {
    items = navigationForLocation(config.location, nav);
    if (!items.length && config.fallbackLocation) {
      items = navigationForLocation(config.fallbackLocation, nav);
    }
  }

  if (config.showOnlyTopLevel) {
    items = items.map(({ label, href, target }) => ({ label, href, target }));
  }

  return limitItems(mapNavItemsToLinks(items), config.maxItems);
}

async function resolveMenuSlot(
  slot: FooterSlot<"menu">,
  nav: FooterNavigationContext,
): Promise<ResolvedFooterMenuSlot> {
  return {
    index: slot.index,
    type: "menu",
    heading: slot.heading,
    revealDelay: revealDelayForIndex(slot.index),
    links: await resolveMenuLinks(slot.config, nav),
  };
}

async function resolveMediaLinks(
  config: FooterMediaSlotConfig,
  nav: FooterNavigationContext,
): Promise<ResolvedFooterLink[]> {
  if (config.source === "manual") {
    return limitItems(mapManualLinksToResolved(config.manualLinks), config.maxItems);
  }

  if (config.source === "menu_id" && config.menuId) {
    const items = await getPublicNavigationItemsByMenuId(config.menuId);
    return limitItems(mapNavItemsToLinks(items), config.maxItems);
  }

  const parent = nav.mainNavItems.find((item) => item.href === config.parentHref);
  const submenu = parent?.submenu ?? [];
  return limitItems(mapNavItemsToLinks(submenu), config.maxItems);
}

async function resolveMediaSlot(
  slot: FooterSlot<"media">,
  nav: FooterNavigationContext,
): Promise<ResolvedFooterMediaSlot> {
  return {
    index: slot.index,
    type: "media",
    heading: slot.heading,
    revealDelay: revealDelayForIndex(slot.index),
    links: await resolveMediaLinks(slot.config, nav),
  };
}

function resolveCustomLinksSlot(slot: FooterSlot<"custom_links">): ResolvedFooterCustomLinksSlot {
  const config = slot.config as FooterCustomLinksSlotConfig;

  return {
    index: slot.index,
    type: "custom_links",
    heading: slot.heading,
    revealDelay: revealDelayForIndex(slot.index),
    links: mapManualLinksToResolved(config.links),
  };
}

async function resolveSlot(
  slot: FooterSlot,
  settings: FooterSettings,
  nav: FooterNavigationContext,
): Promise<ResolvedFooterSlot | null> {
  if (!slot.enabled) return null;

  switch (slot.type) {
    case "text":
      return resolveTextSlot(slot as FooterSlot<"text">);
    case "contact":
      return resolveContactSlot(slot as FooterSlot<"contact">, settings.contactItems);
    case "menu":
      return resolveMenuSlot(slot as FooterSlot<"menu">, nav);
    case "media":
      return resolveMediaSlot(slot as FooterSlot<"media">, nav);
    case "custom_links":
      return resolveCustomLinksSlot(slot as FooterSlot<"custom_links">);
    default:
      return null;
  }
}

export async function resolveFooterComposition(
  settings: FooterSettings,
  nav: FooterNavigationContext,
): Promise<FooterComposition> {
  const resolved = await Promise.all(
    settings.slots.slots.map((slot) => resolveSlot(slot, settings, nav)),
  );

  return {
    slots: resolved
      .filter((slot): slot is ResolvedFooterSlot => slot != null)
      .sort((a, b) => a.index - b.index),
  };
}

// Re-export for layout/tests that need navigation without duplicating fetches.
export { getPublicNavigationItems };
