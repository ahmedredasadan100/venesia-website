import "server-only";

import { z } from "zod";

import type {
  AdminCompanyIdentity,
  ResolvedAdminCompanyConfig,
} from "./contracts";
import { getSupabaseAdmin } from "../../supabase-admin";

export const ADMIN_COMPANY_SETTING_KEY = "admin.company";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const companyIdentitySchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  adminLabel: z.string().trim().min(1).max(80),
  cmsLabel: z.string().trim().min(1).max(80),
  logoUrl: z.string().trim().max(500),
  compactLogoUrl: z.string().trim().max(500),
  publicWebsiteUrl: z.string().trim().min(1).max(500),
  accentColor: hexColor,
  accentStrongColor: hexColor,
  surfaceColor: hexColor,
});

const SAFE_FALLBACK: AdminCompanyIdentity = {
  key: "admin",
  name: "Company",
  adminLabel: "Admin Panel",
  cmsLabel: "CMS",
  logoUrl: "",
  compactLogoUrl: "",
  publicWebsiteUrl: "/",
  accentColor: "#D8B87A",
  accentStrongColor: "#F4D99A",
  surfaceColor: "#05070B",
};

export function parseAdminCompanyIdentity(value: unknown) {
  return companyIdentitySchema.safeParse(value);
}

export async function loadAdminCompanyConfig(
  companyDefault: AdminCompanyIdentity,
): Promise<ResolvedAdminCompanyConfig> {
  const parsedDefault = companyIdentitySchema.safeParse(companyDefault);
  const fallback = parsedDefault.success ? parsedDefault.data : SAFE_FALLBACK;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("site_settings")
      .select("value")
      .eq("key", ADMIN_COMPANY_SETTING_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const parsed = companyIdentitySchema.safeParse(data?.value);
    if (parsed.success) return { ...parsed.data, source: "database" };
  } catch {
    // A company default keeps the admin operational if optional settings fail.
  }

  return {
    ...fallback,
    source: parsedDefault.success ? "company-default" : "safe-fallback",
  };
}

export async function saveAdminCompanyConfig(value: AdminCompanyIdentity) {
  const parsed = companyIdentitySchema.parse(value);
  const { error } = await getSupabaseAdmin().from("site_settings").upsert(
    {
      key: ADMIN_COMPANY_SETTING_KEY,
      value: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return parsed;
}
