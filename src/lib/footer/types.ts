export type FooterBrand = {
  title: string;
  tagline: string;
  contactHeading: string;
  mediaHeading: string;
};

export type FooterContactItem = {
  icon?: string;
  label: string;
  value: string;
  href?: string;
  visible?: boolean;
};

export type FooterSocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "whatsapp"
  | "location";

export type FooterSocialLink = {
  platform: FooterSocialPlatform;
  label: string;
  href: string;
  visible?: boolean;
};

export type FooterLegal = {
  copyright: string;
  tagline: string;
};

export type FooterSettings = {
  brand: FooterBrand;
  contactItems: FooterContactItem[];
  socialLinks: FooterSocialLink[];
  legal: FooterLegal;
  usesFallback: boolean;
};

export const FOOTER_SETTING_KEYS = [
  "footer.brand",
  "footer.contact_items",
  "footer.social_links",
  "footer.legal",
] as const;

export type FooterSettingKey = (typeof FOOTER_SETTING_KEYS)[number];
