import "server-only";

import { legacyHrefFromConfig, resolveAdminLink } from "./index";
import type { AdminLinkValue } from "./types";
import type {
  AboutCtaModuleConfig,
  BreadcrumbBlockConfig,
  CardsBlockConfig,
  CtaBlockConfig,
} from "../../page-blocks/configs";

async function resolveNestedLink(
  container: Record<string, unknown> | undefined,
  linkKey: string,
  hrefKey: string,
) {
  if (!container) return container;
  const link = legacyHrefFromConfig(container, linkKey, hrefKey);
  if (link.link_kind === "none") return container;

  const href = await resolveAdminLink(link);
  return {
    ...container,
    [linkKey]: link,
    [hrefKey]: href,
    target: link.target ?? container.target ?? "_self",
  };
}

export async function resolveCtaBlockConfigLinks(config: CtaBlockConfig): Promise<CtaBlockConfig> {
  const raw = config as unknown as Record<string, unknown>;
  const primaryCta = await resolveNestedLink(
    config.primaryCta as Record<string, unknown> | undefined,
    "link",
    "href",
  );
  const secondaryCta = await resolveNestedLink(
    config.secondaryCta as Record<string, unknown> | undefined,
    "link",
    "href",
  );

  return {
    ...config,
    primaryCta: primaryCta as CtaBlockConfig["primaryCta"],
    secondaryCta: secondaryCta as CtaBlockConfig["secondaryCta"],
    ...(raw.primaryCtaLink ? { primaryCtaLink: raw.primaryCtaLink } : {}),
    ...(raw.secondaryCtaLink ? { secondaryCtaLink: raw.secondaryCtaLink } : {}),
  };
}

export async function resolveAboutIntroConfigLinks<T extends Record<string, unknown>>(config: T): Promise<T> {
  if (!config.button || typeof config.button !== "object") return config;
  const button = await resolveNestedLink(config.button as Record<string, unknown>, "link", "href");
  return { ...config, button };
}

export async function resolveAboutCtaConfigLinks(config: AboutCtaModuleConfig): Promise<AboutCtaModuleConfig> {
  const button = config.button
    ? ((await resolveNestedLink(config.button as Record<string, unknown>, "link", "href")) as AboutCtaModuleConfig["button"])
    : config.button;

  const contacts = config.contacts
    ? await Promise.all(
        config.contacts.map(async (contact) => {
          if (!contact) return contact;
          return (await resolveNestedLink(contact as Record<string, unknown>, "link", "href")) as typeof contact;
        }),
      )
    : config.contacts;

  return { ...config, button, contacts };
}

export async function resolveCardsBlockConfigLinks(config: CardsBlockConfig): Promise<CardsBlockConfig> {
  if (!config.items?.length) return config;

  const items = await Promise.all(
    config.items.map(async (item) => {
      if (!item) return item;
      return (await resolveNestedLink(item as Record<string, unknown>, "link", "href")) as typeof item;
    }),
  );

  return { ...config, items };
}

export async function resolveBreadcrumbBlockConfigLinks(config: BreadcrumbBlockConfig): Promise<BreadcrumbBlockConfig> {
  if (!config.manualItems?.length) return config;

  const manualItems = await Promise.all(
    config.manualItems.map(async (item) => {
      if (!item) return item;
      return (await resolveNestedLink(item as Record<string, unknown>, "link", "href")) as typeof item;
    }),
  );

  return { ...config, manualItems };
}

export async function resolveContentBlockConfigLinks(
  config: Record<string, unknown>,
  slug: string,
  variant?: string | null,
): Promise<Record<string, unknown>> {
  const { usesAboutIntroConfigSchema, usesAboutCtaConfigSchema, isVisionGoalsTemplate } = await import(
    "../../page-blocks/configs"
  );

  if (usesAboutIntroConfigSchema(slug, variant)) {
    return resolveAboutIntroConfigLinks(config);
  }
  if (usesAboutCtaConfigSchema(slug, variant)) {
    const resolved = await resolveAboutCtaConfigLinks(config as AboutCtaModuleConfig);
    return resolved as unknown as Record<string, unknown>;
  }
  if (isVisionGoalsTemplate(slug, variant)) {
    return config;
  }

  return config;
}

export async function resolveFooterLinkValue(link: AdminLinkValue | null | undefined, hrefFallback?: string | null) {
  const value = link ?? { link_kind: "none" as const };
  if (value.link_kind === "none") return hrefFallback?.trim() || "";
  return resolveAdminLink(value);
}

export async function resolveFooterSettingsLinks<T extends { slots: { slots: Array<{ type: string; config: Record<string, unknown> }> } }>(
  settings: T,
): Promise<T> {
  const slots = await Promise.all(
    settings.slots.slots.map(async (slot) => {
      const config = { ...slot.config };

      if (slot.type === "text" && config.cta && typeof config.cta === "object") {
        config.cta = await resolveNestedLink(config.cta as Record<string, unknown>, "link", "href");
      }

      if (slot.type === "media") {
        if (config.parentLink || config.parentHref) {
          const parent = await resolveNestedLink(config as Record<string, unknown>, "parentLink", "parentHref");
          Object.assign(config, parent);
        }

        if (Array.isArray(config.manualLinks)) {
          config.manualLinks = await Promise.all(
            config.manualLinks.map(async (item) =>
              item && typeof item === "object"
                ? resolveNestedLink(item as Record<string, unknown>, "link", "href")
                : item,
            ),
          );
        }
      }

      if (slot.type === "custom_links" && Array.isArray(config.links)) {
        config.links = await Promise.all(
          config.links.map(async (item) =>
            item && typeof item === "object"
              ? resolveNestedLink(item as Record<string, unknown>, "link", "href")
              : item,
          ),
        );
      }

      return { ...slot, config };
    }),
  );

  return {
    ...settings,
    slots: {
      ...settings.slots,
      slots,
    },
  };
}
