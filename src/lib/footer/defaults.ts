import type {
  FooterBrand,
  FooterContactItem,
  FooterLegal,
  FooterSettings,
  FooterSocialLink,
  FooterSocialPlatform,
} from "./types";

const SOCIAL_PLATFORMS: FooterSocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "whatsapp",
  "location",
];

export const DEFAULT_FOOTER_BRAND: FooterBrand = {
  title: "Venesia Developments",
  tagline: "Building trust before concrete.",
  contactHeading: "تواصل معنا",
  mediaHeading: "المركز الإعلامي",
};

export const DEFAULT_FOOTER_CONTACT_ITEMS: FooterContactItem[] = [
  {
    icon: "⌖",
    label: "العنوان",
    value: "Street 12, New Cairo 1, Cairo Governorate",
    href: "https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate",
  },
  {
    icon: "✆",
    label: "الرقم المختصر",
    value: "15875",
    href: "tel:15875",
  },
  {
    icon: "✆",
    label: "موبايل",
    value: "01033766876",
    href: "tel:01033766876",
  },
  {
    icon: "✉",
    label: "البريد الإلكتروني",
    value: "info@venesia-developments.com",
    href: "mailto:info@venesia-developments.com",
  },
];

export const DEFAULT_FOOTER_SOCIAL_LINKS: FooterSocialLink[] = [
  {
    platform: "facebook",
    label: "Facebook",
    href: "https://facebook.com/venesia-developments",
  },
  {
    platform: "instagram",
    label: "Instagram",
    href: "https://instagram.com/venesia_developments",
  },
  {
    platform: "tiktok",
    label: "TikTok",
    href: "https://tiktok.com/@venesiadevelopments",
  },
  {
    platform: "youtube",
    label: "YouTube",
    href: "https://youtube.com/@venesia",
  },
  {
    platform: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/201033766876",
  },
  {
    platform: "location",
    label: "Location",
    href: "https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate",
  },
];

export const DEFAULT_FOOTER_LEGAL: FooterLegal = {
  copyright: "Venesia Developments. All rights reserved.",
  tagline: "Trust Built On Ground",
};

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  brand: DEFAULT_FOOTER_BRAND,
  contactItems: DEFAULT_FOOTER_CONTACT_ITEMS,
  socialLinks: DEFAULT_FOOTER_SOCIAL_LINKS,
  legal: DEFAULT_FOOTER_LEGAL,
  usesFallback: true,
};

export function isSocialPlatform(value: string): value is FooterSocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as FooterSocialPlatform);
}
