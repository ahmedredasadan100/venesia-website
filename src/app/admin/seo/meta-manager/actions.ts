"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { revalidatePublicCacheTags } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { mergeGlobalSeoSettings } from "../../../../lib/seo/parse-global-seo";
import { GLOBAL_SEO_SETTING_KEY, type GlobalSeoSettingsInput } from "../../../../lib/seo/global-seo-types";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readSocialLinks(formData: FormData) {
  const labels = formData.getAll("social_label").map((value) => String(value).trim());
  const hrefs = formData.getAll("social_href").map((value) => String(value).trim());

  return labels
    .map((label, index) => ({
      label,
      href: hrefs[index] ?? "",
    }))
    .filter((item) => item.label && item.href);
}

function buildSettingsFromForm(formData: FormData): GlobalSeoSettingsInput {
  return {
    siteName: readString(formData, "site_name"),
    defaultTitle: readString(formData, "default_title"),
    defaultDescription: readString(formData, "default_description"),
    defaultOgImage: readString(formData, "default_og_image"),
    defaultOgImageAlt: readString(formData, "default_og_image_alt"),
    defaultTwitterImage: readString(formData, "default_twitter_image"),
    defaultRobotsIndex: readBoolean(formData, "default_robots_index"),
    defaultRobotsFollow: readBoolean(formData, "default_robots_follow"),
    siteUrl: readString(formData, "site_url"),
    canonicalBaseUrl: readString(formData, "canonical_base_url"),
    organizationName: readString(formData, "organization_name"),
    organizationDescription: readString(formData, "organization_description"),
    organizationLogo: readString(formData, "organization_logo"),
    organizationPhone: readString(formData, "organization_phone"),
    organizationEmail: readString(formData, "organization_email"),
    organizationAddress: readString(formData, "organization_address"),
    organizationSocialLinks: readSocialLinks(formData),
    twitterHandle: readString(formData, "twitter_handle"),
    googleSiteVerification: readString(formData, "google_site_verification"),
    bingSiteVerification: readString(formData, "bing_site_verification"),
  };
}

export async function saveGlobalSeoSettingsAction(formData: FormData) {
  await requireAdminSession();

  const payload = mergeGlobalSeoSettings(buildSettingsFromForm(formData));
  const now = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert(
      {
        key: GLOBAL_SEO_SETTING_KEY,
        value: payload,
        updated_at: now,
      },
      { onConflict: "key" },
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePublicCacheTags(["seo-global", "site-settings"]);
  revalidatePath("/admin/seo/meta-manager");
  revalidatePath("/");

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("site_settings", "update"),
    entityType: "site_settings",
    entityLabel: GLOBAL_SEO_SETTING_KEY,
    metadata: { keys: Object.keys(payload) },
  });
}
