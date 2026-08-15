import "server-only";

import type { Json } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { isContentType } from "../content/content-types";
import { resolvePublicContentPath } from "../../content/public-content-path";
import { deserializeAdminLink } from "./serialize";
import type { AdminLinkValue, LinkedResourceType } from "./types";

export type LinkUsageSourceType =
  | "menu_item"
  | "hero_template"
  | "cta_block"
  | "content_block"
  | "cards_block"
  | "breadcrumb_block"
  | "footer_slot"
  | "footer_contact";

export type LinkUsageReference = {
  sourceType: LinkUsageSourceType;
  sourceId: number | string;
  sourceLabel: string;
  fieldPath: string;
  adminPath?: string;
};

export type LinkUsageQuery = {
  linkedType: LinkedResourceType;
  linkedId: number;
};

type JsonObject = { [key: string]: Json | undefined };

function jsonObject(value: Json | undefined): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function linkMatchesResource(link: AdminLinkValue, query: LinkUsageQuery) {
  if (link.link_kind !== "internal") return false;
  return link.linked_type === query.linkedType && Number(link.linked_id) === query.linkedId;
}

function hrefMatchesResourcePath(href: string | null | undefined, publicPath: string | null) {
  if (!href?.trim() || !publicPath?.trim()) return false;
  const normalizedHref = href.trim().split("#")[0] ?? href.trim();
  const normalizedPath = publicPath.trim().split("#")[0] ?? publicPath.trim();
  return normalizedHref === normalizedPath;
}

function scanAdminLinkValue(
  raw: Json | undefined,
  query: LinkUsageQuery,
  publicPath: string | null,
  meta: Omit<LinkUsageReference, "sourceType" | "sourceId" | "sourceLabel"> & {
    sourceType: LinkUsageSourceType;
    sourceId: number | string;
    sourceLabel: string;
  },
  matches: LinkUsageReference[],
) {
  const link = deserializeAdminLink(raw);
  if (linkMatchesResource(link, query) || hrefMatchesResourcePath(link.href, publicPath)) {
    matches.push({
      sourceType: meta.sourceType,
      sourceId: meta.sourceId,
      sourceLabel: meta.sourceLabel,
      fieldPath: meta.fieldPath,
      adminPath: meta.adminPath,
    });
  }
}

function scanLinkContainer(
  container: JsonObject | null | undefined,
  linkKey: string,
  hrefKey: string,
  query: LinkUsageQuery,
  publicPath: string | null,
  meta: Omit<LinkUsageReference, "sourceType" | "sourceId" | "sourceLabel"> & {
    sourceType: LinkUsageSourceType;
    sourceId: number | string;
    sourceLabel: string;
  },
  matches: LinkUsageReference[],
) {
  if (!container) return;
  scanAdminLinkValue(container[linkKey], query, publicPath, meta, matches);
  scanHrefValue(container[hrefKey], query, publicPath, meta, matches);
}

function scanHrefValue(
  href: Json | undefined,
  query: LinkUsageQuery,
  publicPath: string | null,
  meta: Omit<LinkUsageReference, "sourceType" | "sourceId" | "sourceLabel"> & {
    sourceType: LinkUsageSourceType;
    sourceId: number | string;
    sourceLabel: string;
  },
  matches: LinkUsageReference[],
) {
  if (typeof href !== "string" || !href.trim()) return;
  const link = deserializeAdminLink(href);
  if (linkMatchesResource(link, query) || hrefMatchesResourcePath(href, publicPath)) {
    matches.push({
      sourceType: meta.sourceType,
      sourceId: meta.sourceId,
      sourceLabel: meta.sourceLabel,
      fieldPath: meta.fieldPath,
      adminPath: meta.adminPath,
    });
  }
}

async function resolveResourcePublicPath(query: LinkUsageQuery) {
  const supabase = getSupabaseAdmin();

  switch (query.linkedType) {
    case "pages": {
      const { data } = await supabase.from("pages").select("path,slug").eq("id", query.linkedId).maybeSingle();
      if (!data) return null;
      const cleanPath = data.path?.trim();
      if (cleanPath) return cleanPath;
      return data.slug === "home" ? "/" : `/${data.slug}`;
    }
    case "projects": {
      const { data } = await supabase.from("projects").select("slug").eq("id", query.linkedId).maybeSingle();
      return data?.slug ? `/projects/${data.slug}` : null;
    }
    case "topics": {
      const { data } = await supabase.from("topics").select("slug,content_type").eq("id", query.linkedId).maybeSingle();
      return data?.slug && isContentType(data.content_type)
        ? resolvePublicContentPath(data.content_type, data.slug)
        : null;
    }
    case "topic_categories": {
      const { data } = await supabase.from("topic_categories").select("slug").eq("id", query.linkedId).maybeSingle();
      return data?.slug ? `/topics?category=${data.slug}` : null;
    }
    case "topic_series": {
      const { data } = await supabase.from("topic_series").select("slug").eq("id", query.linkedId).maybeSingle();
      return data?.slug ? `/topics?series=${data.slug}` : null;
    }
    default:
      return null;
  }
}

async function scanMenuItems(query: LinkUsageQuery, publicPath: string | null) {
  const matches: LinkUsageReference[] = [];
  const supabase = getSupabaseAdmin();

  const [{ data: typedItems }, hrefResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id,label,menu_id,href,linked_type,linked_id,menus(name)")
      .eq("linked_type", query.linkedType)
      .eq("linked_id", query.linkedId),
    publicPath
      ? supabase
          .from("menu_items")
          .select("id,label,menu_id,href,linked_type,linked_id,menus(name)")
          .eq("href", publicPath)
      : Promise.resolve({ data: [] }),
  ]);

  const combined = [...(typedItems ?? []), ...(hrefResult.data ?? [])];
  const seenIds = new Set<number>();

  combined.forEach((item) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);

    const menuName = item.menus?.name ?? "قائمة";

    matches.push({
      sourceType: "menu_item",
      sourceId: item.id,
      sourceLabel: `${menuName} — ${item.label}`,
      fieldPath: "menu_items.href",
      adminPath: `/admin/pages-blocks/menus/${item.menu_id}`,
    });
  });

  return matches;
}

async function scanHeroTemplates(query: LinkUsageQuery, publicPath: string | null) {
  const matches: LinkUsageReference[] = [];
  const { data: heroes } = await getSupabaseAdmin().from("hero_templates").select("id,name,config");

  (heroes ?? []).forEach((hero) => {
    const config = jsonObject(hero.config) ?? {};
    const base = {
      sourceType: "hero_template" as const,
      sourceId: hero.id,
      sourceLabel: hero.name,
      adminPath: `/admin/pages-blocks/blocks/hero/${hero.id}`,
    };

    scanAdminLinkValue(config.primaryCtaLink, query, publicPath, { ...base, fieldPath: "config.primaryCtaLink" }, matches);
    scanAdminLinkValue(config.secondaryCtaLink, query, publicPath, { ...base, fieldPath: "config.secondaryCtaLink" }, matches);
    scanHrefValue(config.primaryCtaHref, query, publicPath, { ...base, fieldPath: "config.primaryCtaHref" }, matches);
    scanHrefValue(config.secondaryCtaHref, query, publicPath, { ...base, fieldPath: "config.secondaryCtaHref" }, matches);
  });

  return matches;
}

async function scanBlockTemplates(
  table: "cta_block_templates" | "content_block_templates" | "cards_block_templates" | "breadcrumb_block_templates",
  sourceType: LinkUsageSourceType,
  adminBase: string,
  query: LinkUsageQuery,
  publicPath: string | null,
) {
  const matches: LinkUsageReference[] = [];
  const { data: rows } = await getSupabaseAdmin().from(table).select("id,name,config");

  (rows ?? []).forEach((row) => {
    const config = jsonObject(row.config) ?? {};
    const base = {
      sourceType,
      sourceId: row.id,
      sourceLabel: row.name,
      adminPath: `${adminBase}/${row.id}`,
    };

    if (table === "cta_block_templates") {
      const primary = jsonObject(config.primaryCta);
      const secondary = jsonObject(config.secondaryCta);
      scanLinkContainer(primary, "link", "href", query, publicPath, { ...base, fieldPath: "config.primaryCta" }, matches);
      scanLinkContainer(
        secondary,
        "link",
        "href",
        query,
        publicPath,
        { ...base, fieldPath: "config.secondaryCta" },
        matches,
      );
    }

    if (table === "content_block_templates") {
      const button = jsonObject(config.button);
      scanLinkContainer(button, "link", "href", query, publicPath, { ...base, fieldPath: "config.button" }, matches);
      if (!button && config.button_href) {
        scanHrefValue(config.button_href, query, publicPath, { ...base, fieldPath: "config.button_href" }, matches);
      }
      const contacts = Array.isArray(config.contacts) ? config.contacts : [];
      contacts.forEach((contact, index) => {
        const contactRecord = jsonObject(contact);
        if (contactRecord) {
          scanLinkContainer(
            contactRecord,
            "link",
            "href",
            query,
            publicPath,
            { ...base, fieldPath: `config.contacts[${index}]` },
            matches,
          );
        }
      });
    }

    if (table === "cards_block_templates") {
      const items = Array.isArray(config.items) ? config.items : [];
      items.forEach((item, index) => {
        const itemRecord = jsonObject(item);
        if (itemRecord) {
          scanLinkContainer(
            itemRecord,
            "link",
            "href",
            query,
            publicPath,
            { ...base, fieldPath: `config.items[${index}]` },
            matches,
          );
        }
      });
    }

    if (table === "breadcrumb_block_templates") {
      const manualItems = Array.isArray(config.manualItems)
        ? config.manualItems
        : Array.isArray(config.manual_items)
          ? config.manual_items
          : [];
      manualItems.forEach((item, index) => {
        const itemRecord = jsonObject(item);
        if (itemRecord) {
          scanLinkContainer(
            itemRecord,
            "link",
            "href",
            query,
            publicPath,
            { ...base, fieldPath: `config.manualItems[${index}]` },
            matches,
          );
        }
      });
    }
  });

  return matches;
}

async function scanFooterSettings(query: LinkUsageQuery, publicPath: string | null) {
  const matches: LinkUsageReference[] = [];
  const { data } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", "footer.slots")
    .maybeSingle();

  const footer = jsonObject(data?.value);
  if (!footer) return matches;
  const slots = Array.isArray(footer.slots) ? footer.slots : [];

  slots.forEach((slot, index) => {
    const record = jsonObject(slot);
    if (!record) return;
    const config = jsonObject(record.config) ?? {};
    const base = {
      sourceType: "footer_slot" as const,
      sourceId: `slot-${index + 1}`,
      sourceLabel: `Footer Slot ${index + 1}`,
      adminPath: "/admin/pages-blocks/footer",
    };

    const cta = jsonObject(config.cta);
    scanLinkContainer(cta, "link", "href", query, publicPath, { ...base, fieldPath: `slots[${index}].config.cta` }, matches);

    const manualLinks = Array.isArray(config.manualLinks) ? config.manualLinks : [];
    manualLinks.forEach((link, linkIndex) => {
      const linkRecord = jsonObject(link);
      if (linkRecord) {
        scanLinkContainer(
          linkRecord,
          "link",
          "href",
          query,
          publicPath,
          { ...base, fieldPath: `slots[${index}].config.manualLinks[${linkIndex}]` },
          matches,
        );
      }
    });

    const links = Array.isArray(config.links) ? config.links : [];
    links.forEach((link, linkIndex) => {
      const linkRecord = jsonObject(link);
      if (linkRecord) {
        scanLinkContainer(
          linkRecord,
          "link",
          "href",
          query,
          publicPath,
          { ...base, fieldPath: `slots[${index}].config.links[${linkIndex}]` },
          matches,
        );
      }
    });

    scanLinkContainer(
      config,
      "parentLink",
      "parentHref",
      query,
      publicPath,
      { ...base, fieldPath: `slots[${index}].config.parentLink` },
      matches,
    );
  });

  const { data: contactSetting } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", "footer.contact_items")
    .maybeSingle();

  const contacts = Array.isArray(contactSetting?.value) ? contactSetting.value : [];
  contacts.forEach((item, index) => {
    const itemRecord = jsonObject(item);
    if (itemRecord) {
      scanHrefValue(itemRecord.href, query, publicPath, {
        sourceType: "footer_contact",
        sourceId: `contact-${index}`,
        sourceLabel: "Footer Contact Items",
        fieldPath: `footer.contact_items[${index}].href`,
        adminPath: "/admin/pages-blocks/footer",
      }, matches);
    }
  });

  return matches;
}

export async function findLinkUsages(query: LinkUsageQuery): Promise<LinkUsageReference[]> {
  const publicPath = await resolveResourcePublicPath(query);

  const batches = await Promise.all([
    scanMenuItems(query, publicPath),
    scanHeroTemplates(query, publicPath),
    scanBlockTemplates("cta_block_templates", "cta_block", "/admin/pages-blocks/blocks/cta", query, publicPath),
    scanBlockTemplates("content_block_templates", "content_block", "/admin/pages-blocks/blocks/content", query, publicPath),
    scanBlockTemplates("cards_block_templates", "cards_block", "/admin/pages-blocks/blocks/cards", query, publicPath),
    scanBlockTemplates(
      "breadcrumb_block_templates",
      "breadcrumb_block",
      "/admin/pages-blocks/blocks/breadcrumb",
      query,
      publicPath,
    ),
    scanFooterSettings(query, publicPath),
  ]);

  const seen = new Set<string>();
  return batches.flat().filter((item) => {
    const key = `${item.sourceType}:${item.sourceId}:${item.fieldPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function isResourceLinked(query: LinkUsageQuery): Promise<boolean> {
  const usages = await findLinkUsages(query);
  return usages.length > 0;
}

export async function getResourceLinkUsageCount(query: LinkUsageQuery): Promise<number> {
  const usages = await findLinkUsages(query);
  return usages.length;
}
