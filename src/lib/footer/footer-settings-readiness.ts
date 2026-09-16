import { EMPTY_FOOTER_SETTINGS, isSocialPlatform } from "./defaults";
import { parseFooterContactItems, parseFooterSocialLinks } from "./parse-footer-settings";
import { validateFooterSlots } from "./validate-footer-slots";
import type { FooterReadiness, FooterSettings } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const optionalText = (value: unknown) => value === undefined || typeof value === "string";
const visibility = (value: unknown) => value === undefined || typeof value === "boolean"
  || value === "true" || value === "false" || value === 0 || value === 1 || value === "0" || value === "1";

/** Derives validity and publication readiness from values, never a stored status flag. */
export function evaluateFooterReadiness(input: unknown): FooterReadiness {
  if (!isRecord(input)) return { systemValid: false, publicationReady: false, issues: ["Footer settings are not an object."] };
  const slots = validateFooterSlots(input.slots);
  const contactShape = Array.isArray(input.contactItems) && input.contactItems.every((item) =>
    isRecord(item) && optionalText(item.label) && optionalText(item.value) && optionalText(item.icon)
    && optionalText(item.href) && visibility(item.visible));
  const socialShape = Array.isArray(input.socialLinks) && input.socialLinks.every((item) =>
    isRecord(item) && typeof item.platform === "string" && isSocialPlatform(item.platform)
    && typeof item.label === "string" && typeof item.href === "string" && visibility(item.visible));
  const legalShape = isRecord(input.legal) && typeof input.legal.copyright === "string" && typeof input.legal.tagline === "string";
  if (!slots.ok || !contactShape || !socialShape || !legalShape) {
    return { systemValid: false, publicationReady: false, issues: [
      ...(!slots.ok ? slots.errors : []),
      ...(!contactShape ? ["footer.contact_items has an invalid structure."] : []),
      ...(!socialShape ? ["footer.social_links has an invalid structure."] : []),
      ...(!legalShape ? ["footer.legal has an invalid structure."] : []),
    ] };
  }

  const contacts = parseFooterContactItems(input.contactItems, []);
  const socials = parseFooterSocialLinks(input.socialLinks, []);
  if (contacts.length !== (input.contactItems as unknown[]).length || socials.length !== (input.socialLinks as unknown[]).length) {
    return { systemValid: false, publicationReady: false, issues: ["Footer contains invalid contact or social entries."] };
  }
  const legal = input.legal as { copyright: string; tagline: string };
  const issues = [
    ...(contacts.length === 0 ? ["footer.contact_items is not ready for publication."] : []),
    ...(socials.length === 0 ? ["footer.social_links is not ready for publication."] : []),
    ...(!legal.copyright.trim() || !legal.tagline.trim() ? ["footer.legal is not ready for publication."] : []),
  ];
  return { systemValid: true, publicationReady: issues.length === 0, issues };
}

/** Public projection never turns valid but unfinished Admin structure into content. */
export function projectFooterSettingsForPublic(settings: FooterSettings): FooterSettings {
  if (settings.sourceStatus !== "database") return settings;
  const readiness = evaluateFooterReadiness(settings);
  if (readiness.publicationReady) return { ...settings, readiness };
  return {
    ...structuredClone(EMPTY_FOOTER_SETTINGS),
    sourceStatus: readiness.systemValid ? "database" : "invalid",
    sourceIssues: readiness.issues,
    readiness,
  };
}
