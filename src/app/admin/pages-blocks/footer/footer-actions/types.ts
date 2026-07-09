export type FooterMenuOption = {
  id: number;
  name: string;
  location: string;
};

export type FooterQuickLinkInput = {
  id?: number;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
};

export type FooterBuilderSaveInput = {
  slots: import("../../../../../lib/footer/footer-slot-types").FooterSlotsConfig;
  contactItems: import("../../../../../lib/footer/types").FooterContactItem[];
  socialLinks: import("../../../../../lib/footer/types").FooterSocialLink[];
  legal: import("../../../../../lib/footer/types").FooterLegal;
};
