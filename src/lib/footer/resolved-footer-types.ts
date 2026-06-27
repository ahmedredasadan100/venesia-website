import type { FooterContactItem } from "./types";

export type ResolvedFooterLink = {
  label: string;
  href: string;
  target?: "_self" | "_blank";
};

export type ResolvedFooterTextSlot = {
  index: number;
  type: "text";
  heading: string | null;
  revealDelay: number;
  title: string;
  body: string;
  showBrandIcon: boolean;
  cta: {
    enabled: boolean;
    label: string;
    href: string;
    target: "_self" | "_blank";
  };
};

export type ResolvedFooterContactSlot = {
  index: number;
  type: "contact";
  heading: string | null;
  revealDelay: number;
  items: FooterContactItem[];
};

export type ResolvedFooterMenuSlot = {
  index: number;
  type: "menu";
  heading: string | null;
  revealDelay: number;
  links: ResolvedFooterLink[];
};

export type ResolvedFooterMediaSlot = {
  index: number;
  type: "media";
  heading: string | null;
  revealDelay: number;
  links: ResolvedFooterLink[];
};

export type ResolvedFooterCustomLinksSlot = {
  index: number;
  type: "custom_links";
  heading: string | null;
  revealDelay: number;
  links: ResolvedFooterLink[];
};

export type ResolvedFooterSlot =
  | ResolvedFooterTextSlot
  | ResolvedFooterContactSlot
  | ResolvedFooterMenuSlot
  | ResolvedFooterMediaSlot
  | ResolvedFooterCustomLinksSlot;

export type FooterComposition = {
  slots: ResolvedFooterSlot[];
};
