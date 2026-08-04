"use server";


import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import type { AdminFormActionState } from "../../../../lib/admin/form-runtime";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import { revalidateGlobalSeoCaches } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { validateGlobalSeoSettingsInput } from "../../../../lib/seo/parse-global-seo";
import { GLOBAL_SEO_SETTING_KEY, type GlobalSeoSettingsInput } from "../../../../lib/seo/global-seo-types";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function optionalString(formData: FormData, key: string) {
  return readString(formData, key) || undefined;
}

function readStringList(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return undefined;
  return [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

function readSocialLinks(formData: FormData) {
  const labels = formData.getAll("social_label").map((value) => String(value).trim());
  const hrefs = formData.getAll("social_href").map((value) => String(value).trim());

  const links = labels
    .map((label, index) => ({
      label,
      href: hrefs[index] ?? "",
    }))
    .filter((item) => item.label && item.href);
  return links.length ? links : undefined;
}

function buildSettingsFromForm(formData: FormData): GlobalSeoSettingsInput {
  return {
    siteName: optionalString(formData, "site_name"),
    defaultTitle: optionalString(formData, "default_title"),
    defaultDescription: optionalString(formData, "default_description"),
    defaultOgImage: optionalString(formData, "default_og_image"),
    defaultOgImageAlt: optionalString(formData, "default_og_image_alt"),
    defaultTwitterImage: optionalString(formData, "default_twitter_image"),
    defaultRobotsIndex: readBoolean(formData, "default_robots_index"),
    defaultRobotsFollow: readBoolean(formData, "default_robots_follow"),
    siteUrl: optionalString(formData, "site_url"),
    canonicalBaseUrl: optionalString(formData, "canonical_base_url"),
    organizationName: optionalString(formData, "organization_name"),
    organizationAlternateName: optionalString(formData, "organization_alternate_name"),
    organizationLegalName: optionalString(formData, "organization_legal_name"),
    organizationTagline: optionalString(formData, "organization_tagline"),
    organizationDescription: optionalString(formData, "organization_description"),
    organizationLogo: optionalString(formData, "organization_logo"),
    organizationPhone: optionalString(formData, "organization_phone"),
    organizationEmail: optionalString(formData, "organization_email"),
    organizationAddress: optionalString(formData, "organization_address"),
    organizationAddressLocality: optionalString(formData, "organization_address_locality"),
    organizationAddressRegion: optionalString(formData, "organization_address_region"),
    organizationPostalCode: optionalString(formData, "organization_postal_code"),
    organizationAddressCountry: optionalString(formData, "organization_address_country"),
    organizationAreaServed: optionalString(formData, "organization_area_served"),
    organizationKnowsAbout: readStringList(formData, "organization_knows_about"),
    organizationSocialLinks: readSocialLinks(formData),
    twitterHandle: optionalString(formData, "twitter_handle"),
    googleSiteVerification: optionalString(formData, "google_site_verification"),
    bingSiteVerification: optionalString(formData, "bing_site_verification"),
    robotsTxtAllow: readStringList(formData, "robots_txt_allow"),
    robotsTxtDisallow: readStringList(formData, "robots_txt_disallow"),
  };
}

export type GlobalSeoFormActionState = AdminFormActionState<GlobalSeoSettingsInput>;

export async function saveGlobalSeoSettingsAction(
  previousState: GlobalSeoFormActionState,
  formData: FormData,
): Promise<GlobalSeoFormActionState> {
  const adminUser = await requireAdminSession();
  const revision = previousState.revision + 1;
  const payload = buildSettingsFromForm(formData);
  const issues = validateGlobalSeoSettingsInput(payload);
  if (issues.length) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = String(issue.field);
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return {
      status: "error",
      mode: "edit",
      revision,
      title: "تعذر حفظ إعدادات SEO",
      message: "راجع الحقول المحددة ثم حاول مرة أخرى.",
      fieldErrors,
      focusTarget: String(issues[0]?.field ?? "siteName"),
    };
  }
  const now = new Date().toISOString();

  let coordinated: Awaited<ReturnType<typeof coordinateMediaReferenceEntityMutation<GlobalSeoSettingsInput>>>;
  try {
    coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceEntityMutation({
        domainKey: "site_settings",
        leaseEntityIdentity: GLOBAL_SEO_SETTING_KEY,
        intendedRow: { key: GLOBAL_SEO_SETTING_KEY, value: payload },
        actorId: adminUser.id,
        requestIdentity: `site_settings:${GLOBAL_SEO_SETTING_KEY}:update:${crypto.randomUUID()}`,
        mutate: async () => {
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
          if (error) throw new Error(error.message);
          return payload;
        },
        resolveEntityIdentity: () => GLOBAL_SEO_SETTING_KEY,
      });
    } catch (error) {
      if (error instanceof MediaReferenceWriteLeaseError) {
        throw new Error(getMediaReferenceWriteLeaseUserMessage(error.code));
      }
      throw error;
    }
    })();
  } catch (error) {
    return {
      status: "error",
      mode: "edit",
      revision,
      title: "تعذر حفظ إعدادات SEO",
      message: error instanceof Error ? error.message : "تعذر إتمام الحفظ بأمان.",
    };
  }

  revalidateGlobalSeoCaches();

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("site_settings", "update"),
    entityType: "site_settings",
    entityLabel: GLOBAL_SEO_SETTING_KEY,
    metadata: { keys: Object.keys(payload) },
  });

  const warning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";
  return {
    status: warning ? "warning" : "success",
    mode: "edit",
    revision,
    title: warning ? "تم الحفظ مع تحذير" : "تم حفظ إعدادات SEO",
    message: warning
      ? "تم حفظ الإعدادات، لكن مزامنة مراجع الميديا تحتاج مراجعة."
      : "تم حفظ عقد Global SEO وإبطال كل المستهلكات العامة المرتبطة.",
    entityId: undefined,
    savedRevision: now,
    result: payload,
  };
}
