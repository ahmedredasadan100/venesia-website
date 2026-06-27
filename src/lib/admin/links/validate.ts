import type { AdminLinkValidationResult, AdminLinkValue } from "./types";

function isValidExternalHref(href: string) {
  return /^https?:\/\/.+/i.test(href);
}

function isValidEmailHref(href: string) {
  return /^mailto:.+@.+\..+/.test(href);
}

function isValidPhoneHref(href: string) {
  return /^tel:[+\d][\d\s-]{5,}$/.test(href);
}

function isValidAnchor(value: string) {
  return /^[a-zA-Z][\w-]*$/.test(value);
}

export function validateAdminLink(value: AdminLinkValue | null | undefined): AdminLinkValidationResult {
  if (!value || value.link_kind === "none") {
    return { ok: true };
  }

  switch (value.link_kind) {
    case "internal": {
      if (!value.linked_type || !value.linked_id) {
        return { ok: false, message: "اختر عنصرًا داخليًا من النظام." };
      }
      return { ok: true };
    }
    case "static_route": {
      if (!value.href?.trim() && !value.meta?.route_key) {
        return { ok: false, message: "اختر مسارًا ثابتًا." };
      }
      return { ok: true };
    }
    case "external": {
      const href = value.href?.trim() ?? "";
      if (!href || !isValidExternalHref(href)) {
        return { ok: false, message: "أدخل رابطًا خارجيًا يبدأ بـ http:// أو https://" };
      }
      return { ok: true };
    }
    case "email": {
      const href = value.href?.trim() ?? "";
      if (!href || !isValidEmailHref(href)) {
        return { ok: false, message: "أدخل بريدًا بصيغة mailto:name@example.com" };
      }
      return { ok: true };
    }
    case "phone": {
      const href = value.href?.trim() ?? "";
      if (!href || !isValidPhoneHref(href)) {
        return { ok: false, message: "أدخل رقمًا بصيغة tel:+201234567890" };
      }
      return { ok: true };
    }
    case "anchor": {
      const anchor = value.anchor?.trim() || value.href?.replace(/^#/, "") || "";
      if (!anchor || !isValidAnchor(anchor)) {
        return { ok: false, message: "أدخل Anchor صالحًا (حروف وأرقام و - فقط)." };
      }
      return { ok: true };
    }
    case "download": {
      const href = value.href?.trim() ?? "";
      if (!href) return { ok: false, message: "اختر ملفًا للتنزيل." };
      return { ok: true };
    }
    case "legacy":
    default:
      if (!value.href?.trim()) return { ok: false, message: "الرابط فارغ." };
      return { ok: true };
  }
}

export function isAdminLinkEmpty(value: AdminLinkValue | null | undefined) {
  if (!value) return true;
  if (value.link_kind === "none") return true;
  return validateAdminLink(value).ok === false && !value.href?.trim();
}
