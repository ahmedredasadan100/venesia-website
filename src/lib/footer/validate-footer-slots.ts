import {
  FOOTER_SLOT_INDICES,
  FOOTER_SLOTS_CONFIG_VERSION,
  type FooterBlockType,
  type FooterContactSlotConfig,
  type FooterCustomLinksSlotConfig,
  type FooterMediaSlotConfig,
  type FooterMenuSlotConfig,
  type FooterSlot,
  type FooterSlotsConfig,
  type FooterTextSlotConfig,
} from "./footer-slot-types";
import { isRegisteredFooterBlockType } from "./footer-block-registry";

const UNSAFE_HREF_PATTERN = /^\s*javascript:/i;

export type FooterSlotsValidationResult =
  | { ok: true; value: FooterSlotsConfig }
  | { ok: false; errors: string[] };

function pushHrefError(errors: string[], path: string, href: string) {
  if (!href) return;
  if (UNSAFE_HREF_PATTERN.test(href)) {
    errors.push(`${path}: رابط غير مسموح.`);
  }
}

function footerLinkIsSet(href: string, link?: Record<string, unknown> | null) {
  if (href.trim()) return true;
  if (!link || typeof link !== "object") return false;
  const kind = link.link_kind;
  return typeof kind === "string" && kind !== "none";
}

function validateTextConfig(config: FooterTextSlotConfig, path: string, errors: string[]) {
  if (!config.title.trim()) {
    errors.push(`${path}: عنوان النص مطلوب.`);
  }
  if (config.cta.enabled) {
    if (!config.cta.label.trim()) errors.push(`${path}: تسمية CTA مطلوبة عند التفعيل.`);
    if (!footerLinkIsSet(config.cta.href, config.cta.link)) {
      errors.push(`${path}: اختر رابط CTA من النظام.`);
    }
    pushHrefError(errors, `${path}.cta.href`, config.cta.href);
  }
}

function validateMenuConfig(config: FooterMenuSlotConfig, path: string, errors: string[]) {
  if (config.source === "menu_id" && !config.menuId) {
    errors.push(`${path}: menuId مطلوب عند اختيار قائمة محددة.`);
  }
}

function validateContactConfig(config: FooterContactSlotConfig, path: string, errors: string[]) {
  if (config.source === "custom" && !config.items.length) {
    errors.push(`${path}: أضف عنصر تواصل واحدًا على الأقل للوضع المخصص.`);
  }

  config.items.forEach((item, index) => {
    if (!item.label.trim() || !item.value.trim()) {
      errors.push(`${path}.items[${index}]: التسمية والقيمة مطلوبتان.`);
    }
    if (item.href) pushHrefError(errors, `${path}.items[${index}].href`, item.href);
  });
}

function validateMediaConfig(config: FooterMediaSlotConfig, path: string, errors: string[]) {
  if (config.source === "menu_id" && !config.menuId) {
    errors.push(`${path}: menuId مطلوب لمصدر القائمة.`);
  }
  if (config.source === "main_submenu" && !footerLinkIsSet(config.parentHref, config.parentLink)) {
    errors.push(`${path}: اختر عنصر القائمة الأب من النظام.`);
  }
  if (config.source === "manual" && !config.manualLinks.length) {
    errors.push(`${path}: أضف رابطًا واحدًا على الأقل للوضع اليدوي.`);
  }

  config.manualLinks.forEach((link, index) => {
    if (!link.label.trim() || !footerLinkIsSet(link.href, link.link)) {
      errors.push(`${path}.manualLinks[${index}]: التسمية والرابط مطلوبان.`);
    }
    pushHrefError(errors, `${path}.manualLinks[${index}].href`, link.href);
  });
}

function validateCustomLinksConfig(config: FooterCustomLinksSlotConfig, path: string, errors: string[]) {
  if (!config.links.length) {
    errors.push(`${path}: أضف رابطًا واحدًا على الأقل.`);
  }

  config.links.forEach((link, index) => {
    if (!link.label.trim() || !footerLinkIsSet(link.href, link.link)) {
      errors.push(`${path}.links[${index}]: التسمية والرابط مطلوبان.`);
    }
    pushHrefError(errors, `${path}.links[${index}].href`, link.href);
  });
}

function validateSlot(slot: FooterSlot, errors: string[]) {
  const path = `slots[${slot.index}]`;

  if (!FOOTER_SLOT_INDICES.includes(slot.index)) {
    errors.push(`${path}: index غير صالح.`);
    return;
  }

  if (!isRegisteredFooterBlockType(slot.type)) {
    errors.push(`${path}: نوع البلوك غير معروف.`);
    return;
  }

  if (!slot.enabled) {
    return;
  }

  const configPath = `${path}.config`;
  const type = slot.type as FooterBlockType;

  if (type === "text") {
    validateTextConfig(slot.config as FooterTextSlotConfig, configPath, errors);
  } else if (type === "menu") {
    validateMenuConfig(slot.config as FooterMenuSlotConfig, configPath, errors);
  } else if (type === "contact") {
    validateContactConfig(slot.config as FooterContactSlotConfig, configPath, errors);
  } else if (type === "media") {
    validateMediaConfig(slot.config as FooterMediaSlotConfig, configPath, errors);
  } else if (type === "custom_links") {
    validateCustomLinksConfig(slot.config as FooterCustomLinksSlotConfig, configPath, errors);
  }
}

export function validateFooterSlots(config: FooterSlotsConfig): FooterSlotsValidationResult {
  const errors: string[] = [];

  if (config.version !== FOOTER_SLOTS_CONFIG_VERSION) {
    errors.push(`إصدار footer.slots غير مدعوم: ${String(config.version)}`);
  }

  if (!Array.isArray(config.slots) || config.slots.length !== FOOTER_SLOT_INDICES.length) {
    errors.push("يجب أن يحتوي footer.slots على 4 أعمدة بالضبط.");
    return { ok: false, errors };
  }

  const indices = config.slots.map((slot) => slot.index).sort((a, b) => a - b);
  const expected = [...FOOTER_SLOT_INDICES];
  if (indices.some((index, position) => index !== expected[position])) {
    errors.push("يجب أن تكون indices للأعمدة 1 و 2 و 3 و 4 بدون تكرار.");
  }

  for (const slot of config.slots) {
    validateSlot(slot, errors);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, value: config };
}

export function assertValidFooterSlots(config: FooterSlotsConfig): FooterSlotsConfig {
  const result = validateFooterSlots(config);
  if (!result.ok) {
    throw new Error(result.errors.join(" "));
  }
  return result.value;
}
