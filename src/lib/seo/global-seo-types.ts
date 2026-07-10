export type GlobalSeoSocialLink = {
  label: string;
  href: string;
};

export type GlobalSeoSettings = {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: string;
  defaultOgImageAlt: string;
  defaultTwitterImage: string;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  siteUrl: string;
  canonicalBaseUrl: string;
  organizationName: string;
  organizationDescription: string;
  organizationLogo: string;
  organizationPhone: string;
  organizationEmail: string;
  organizationAddress: string;
  organizationSocialLinks: GlobalSeoSocialLink[];
  twitterHandle: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
};

export type GlobalSeoSettingsInput = Partial<GlobalSeoSettings>;

export const GLOBAL_SEO_SETTING_KEY = "seo.global" as const;
