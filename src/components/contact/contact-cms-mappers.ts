import type { CardsBlockConfig, ContentBlockConfig, CtaBlockConfig } from "../../lib/page-blocks";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export const KNOWN_CONTACT_SECTION_SLUGS = new Set([
  "contact-trust-cards",
  "contact-form-office",
  "contact-form",
  "contact-map",
  "contact-reasons",
  "contact-departments",
  "contact-faq",
  "contact-cta",
]);

export type ContactTrustCard = {
  type: "phone" | "whatsapp" | "mail" | "location";
  label: string;
  value: string;
  description: string;
  href: string;
};

export type ContactOfficeContent = {
  title: string;
  description: string;
  address: string;
  workingHours: string;
  phone: string;
  whatsapp: string;
  email: string;
};

export type ContactFormContent = {
  title: string;
  description: string;
  submitLabel: string;
};

export type ContactMapContent = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  points: string[];
};

export type ContactReasonsContent = {
  title: string;
  items: Array<{ title: string; text: string }>;
};

export type ContactDepartmentItem = {
  title: string;
  text: string;
  image: string;
};

export type ContactDepartmentsContent = {
  title: string;
  items: ContactDepartmentItem[];
};

export type ContactFaqItem = {
  question: string;
  answer: string;
};

export type ContactFaqContent = {
  title: string;
  items: ContactFaqItem[];
};

export type ContactCtaContent = {
  title: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  image: string;
};

function splitLines(body?: string) {
  return (body ?? "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitPipePair(value?: string) {
  const raw = (value ?? "").trim();
  if (!raw.includes("|")) return { label: raw, href: "" };
  const [label, href] = raw.split("|", 2);
  return { label: label.trim(), href: (href ?? "").trim() };
}

function splitCardBody(body?: string) {
  const lines = splitLines(body);
  return {
    value: lines[0] ?? "",
    description: lines.slice(1).join(" "),
  };
}

function parseTrustCardType(icon?: string): ContactTrustCard["type"] {
  if (icon === "phone" || icon === "whatsapp" || icon === "mail" || icon === "location") {
    return icon;
  }
  return "phone";
}

export function mapContactTrustCardsBlock(block: ResolvedPageBlock): ContactTrustCard[] {
  const config = block.template.config as CardsBlockConfig;

  return (config.items ?? []).map((item) => {
    const { value, description } = splitCardBody(item.body);
    return {
      type: parseTrustCardType(item.icon),
      label: item.title ?? "",
      value,
      description,
      href: item.href ?? "#",
    };
  });
}

export function mapContactFormOfficeBlock(block: ResolvedPageBlock): ContactOfficeContent {
  const config = block.template.config as ContentBlockConfig;
  const lines = splitLines(config.body);

  return {
    title: config.title ?? "",
    description: config.subtitle ?? "",
    address: lines[0] ?? "",
    workingHours: lines[1] ?? "",
    phone: lines[2] ?? "",
    whatsapp: lines[3] ?? "",
    email: lines[4] ?? "",
  };
}

export function mapContactFormBlock(block: ResolvedPageBlock): ContactFormContent {
  const config = block.template.config as ContentBlockConfig;

  return {
    title: config.title ?? "",
    description: config.subtitle ?? "",
    submitLabel: config.eyebrow ?? "",
  };
}

export function mapContactMapBlock(block: ResolvedPageBlock): ContactMapContent {
  const config = block.template.config as ContentBlockConfig;
  const button = splitPipePair(config.eyebrow);

  return {
    title: config.title ?? "",
    description: config.subtitle ?? "",
    buttonLabel: button.label,
    buttonHref: button.href,
    points: splitLines(config.body),
  };
}

export function mapContactReasonsBlock(block: ResolvedPageBlock): ContactReasonsContent {
  const config = block.template.config as CardsBlockConfig;

  return {
    title: config.title ?? "",
    items: (config.items ?? []).map((item) => ({
      title: item.title ?? "",
      text: item.body ?? "",
    })),
  };
}

export function mapContactDepartmentsBlock(block: ResolvedPageBlock): ContactDepartmentsContent {
  const config = block.template.config as CardsBlockConfig;

  return {
    title: config.title ?? "",
    items: (config.items ?? []).map((item) => ({
      title: item.title ?? "",
      text: item.body ?? "",
      image: item.href ?? "/images/111.png",
    })),
  };
}

export function mapContactFaqBlock(block: ResolvedPageBlock): ContactFaqContent {
  const config = block.template.config as CardsBlockConfig;

  return {
    title: config.title ?? "",
    items: (config.items ?? []).map((item) => ({
      question: item.title ?? "",
      answer: item.body ?? "",
    })),
  };
}

export function mapContactCtaBlock(block: ResolvedPageBlock): ContactCtaContent {
  const config = block.template.config as CtaBlockConfig;

  return {
    title: config.title ?? "",
    text: config.description ?? "",
    primaryLabel: config.primaryCta?.label ?? "",
    primaryHref: config.primaryCta?.href ?? "#",
    secondaryLabel: config.secondaryCta?.label ?? "",
    secondaryHref: config.secondaryCta?.href ?? "#",
    image: config.backgroundImage ?? "/images/111.png",
  };
}

const CONTACT_STYLE_CTA_EXCLUDED_SLUGS = new Set(["topics-insight-cta", "about-projects-cta"]);

/** Band CTA blocks on internal pages share ContactCTASection + CtaBlockConfig mapping. */
export function isContactStyleCtaBlock(block: ResolvedPageBlock): boolean {
  if (block.blockType !== "cta") return false;
  if (CONTACT_STYLE_CTA_EXCLUDED_SLUGS.has(block.template.slug)) return false;
  return (block.template.variant ?? "band") === "band";
}

export function indexContactBlocksBySlug(blocks: ResolvedPageBlock[]) {
  const bySlug = new Map<string, ResolvedPageBlock>();
  for (const block of blocks) {
    bySlug.set(block.template.slug, block);
  }
  return bySlug;
}
