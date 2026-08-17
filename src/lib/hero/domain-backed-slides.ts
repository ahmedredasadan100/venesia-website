/** Runtime-only slide content resolved from a domain owner through an adapter. */
export type HeroDomainSlide = {
  id: string;
  desktopImage: string;
  mobileImage?: string;
  imageAlt?: string;
  eyebrow?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
  description?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};
