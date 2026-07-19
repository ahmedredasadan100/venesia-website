export type AdminCompanyIdentity = {
  key: string;
  name: string;
  adminLabel: string;
  cmsLabel: string;
  logoUrl: string;
  compactLogoUrl: string;
  publicWebsiteUrl: string;
  accentColor: string;
  accentStrongColor: string;
  surfaceColor: string;
};

export type AdminCompanyConfigSource =
  | "database"
  | "company-default"
  | "safe-fallback";

export type ResolvedAdminCompanyConfig = AdminCompanyIdentity & {
  source: AdminCompanyConfigSource;
};

export type AdminNavigationPermission = {
  capability: string;
  mode: "allow-current-admins";
};

export type AdminNavigationItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  order: number;
  enabled: boolean;
  moduleKey: string;
  badge?: string;
  permission?: AdminNavigationPermission;
  children?: AdminNavigationItem[];
};
