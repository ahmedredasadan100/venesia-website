import type { AboutCtaModuleConfig, CtaBlockConfig } from "../../lib/page-blocks/configs";
import {
  asAboutCtaConfig,
  resolvePageBlockTextFormattingMap,
  type PageBlockTextFormattingMap,
} from "../../lib/page-blocks/configs";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export type AboutCtaContact = {
  label: string;
  value: string;
  /** Optional second WhatsApp number (home-contact). */
  secondaryValue?: string;
  href?: string;
  icon?: string;
};

export type AboutCtaModuleContent = {
  eyebrow: string;
  title: string;
  description: string;
  formatting: PageBlockTextFormattingMap;
  button: {
    label: string;
    href: string;
    target?: "_self" | "_blank";
  };
  note: string;
  image?: string;
  imageAlt: string;
  contacts: AboutCtaContact[];
};

function normalizePublicImageSrc(path?: string | null) {
  const value = (path ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

function mapContacts(contacts?: AboutCtaModuleConfig["contacts"]): AboutCtaContact[] {
  return (contacts ?? [])
    .map((item) => ({
      label: item.label ?? "",
      value: item.value ?? "",
      ...(item.secondaryValue?.trim() ? { secondaryValue: item.secondaryValue.trim() } : {}),
      href: item.href?.trim() || undefined,
      icon: item.icon?.trim() || undefined,
    }))
    .filter((item) => item.label.trim() || item.value.trim() || Boolean(item.secondaryValue?.trim()));
}

export function mapAboutCtaBlock(block: ResolvedPageBlock): AboutCtaModuleContent {
  const config = asAboutCtaConfig(block.template.config);

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    formatting: resolvePageBlockTextFormattingMap(config, [
      { field: "eyebrow" },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    button: {
      label: config.button?.label ?? "",
      href: config.button?.href ?? "/projects",
      target: config.button?.target,
    },
    note: config.note ?? "",
    image: normalizePublicImageSrc(config.image),
    imageAlt: config.imageAlt ?? "",
    contacts: mapContacts(config.contacts),
  };
}

/** Legacy CTA block templates (cta_block_templates) → same public shape. */
export function mapLegacyProjectsCtaBlock(block: ResolvedPageBlock): AboutCtaModuleContent {
  const config = block.template.config as CtaBlockConfig;

  return {
    eyebrow: config.eyebrow ?? "",
    title: config.title ?? "",
    description: config.description ?? "",
    formatting: resolvePageBlockTextFormattingMap(config, [
      { field: "eyebrow", defaults: { bold: true } },
      { field: "title", defaults: { bold: true } },
      { field: "description" },
    ]),
    button: {
      label: config.primaryCta?.label ?? "",
      href: config.primaryCta?.href ?? "/projects",
    },
    note: "",
    image: normalizePublicImageSrc(config.backgroundImage),
    imageAlt: "",
    contacts: [],
  };
}
