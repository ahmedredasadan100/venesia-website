"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation,
  type MediaReferenceSynchronizationResult,
} from "../../../../../lib/admin/media-catalog/synchronization";
import { parseAdminLinkFromFormData } from "../../../../../lib/admin/links/form-fields";
import { serializeAdminLink } from "../../../../../lib/admin/links/serialize";
import { isAdminLinkEmpty } from "../../../../../lib/admin/links/validate";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateHeroCache } from "../../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { parseFormStatus } from "../../../../../lib/page-blocks/admin-utils";
import { revalidateMediaCenterPublicPaths } from "../../../../../lib/media-center/revalidate-public-paths";
import {
  normalizeHeroElementOrder,
  parseHeroDescriptionAlignment,
  parseHeroTextAlignment,
  parseOptionalBool,
} from "../../../../../lib/hero/hero-content-controls";
import { normalizeRichTextContent } from "../../../../../lib/rich-text/html-utils";
import { mutatePageComposition } from "../../pages/page-actions/helpers";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function formBool(formData: FormData, key: string, fallback = true) {
  return parseOptionalBool(formData.get(key)) ?? fallback;
}

function splitImages(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildHeroConfig(formData: FormData) {
  const primaryCtaLabel = cleanText(formData.get("primary_cta_label"));
  const secondaryCtaLabel = cleanText(formData.get("secondary_cta_label"));
  const primaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "primary_cta"));
  const secondaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "secondary_cta"));
  const hasCtaContent =
    Boolean(primaryCtaLabel && primaryCtaLink && !isAdminLinkEmpty(primaryCtaLink)) ||
    Boolean(secondaryCtaLabel && secondaryCtaLink && !isAdminLinkEmpty(secondaryCtaLink));

  const hasInternalContentControls =
    formData.has("hero_element_order") || formData.has("show_eyebrow");

  const showCtaFromContent = parseOptionalBool(formData.get("show_cta_element"));
  const showCtaFromCheckbox = formData.get("show_cta") === "on";
  const showCta = hasInternalContentControls
    ? (showCtaFromContent ?? true)
    : showCtaFromCheckbox || hasCtaContent;

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = hasInternalContentControls
    ? descriptionRaw
      ? normalizeRichTextContent(descriptionRaw)
      : ""
    : cleanText(formData.get("description"));

  const base = {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    highlight: cleanText(formData.get("highlight")),
    subtitle: cleanText(formData.get("subtitle")),
    description,
    images: splitImages(formData.get("images")),
    mobileImages: splitImages(formData.get("mobile_images")),
    primaryCtaLabel,
    primaryCtaLink,
    secondaryCtaLabel,
    secondaryCtaLink,
    showCta,
    imagePositionClassName: cleanText(formData.get("image_position_class")),
  };

  if (!hasInternalContentControls) {
    return base;
  }

  return {
    ...base,
    showEyebrow: formBool(formData, "show_eyebrow"),
    eyebrowBold: formBool(formData, "eyebrow_bold", false),
    eyebrowAlignment: parseHeroTextAlignment(formData.get("eyebrow_alignment"), "right"),

    showTitle: formBool(formData, "show_title"),
    titleBold: formBool(formData, "title_bold", true),
    titleAlignment: parseHeroTextAlignment(formData.get("title_alignment"), "right"),

    showHighlight: formBool(formData, "show_highlight"),
    highlightBold: formBool(formData, "highlight_bold", false),
    highlightAlignment: parseHeroTextAlignment(formData.get("highlight_alignment"), "right"),

    showSubtitle: formBool(formData, "show_subtitle"),
    subtitleBold: formBool(formData, "subtitle_bold", false),
    subtitleAlignment: parseHeroTextAlignment(formData.get("subtitle_alignment"), "right"),

    showDescription: formBool(formData, "show_description"),
    descriptionAlignment: parseHeroDescriptionAlignment(formData.get("description_alignment"), "right"),

    showBreadcrumb: formBool(formData, "show_breadcrumb"),
    breadcrumbBold: formBool(formData, "breadcrumb_bold", false),
    breadcrumbAlignment: parseHeroTextAlignment(formData.get("breadcrumb_alignment"), "right"),
    breadcrumbCurrentLabel: cleanText(formData.get("breadcrumb_current_label")),

    ctaAlignment: parseHeroTextAlignment(formData.get("cta_alignment"), "right"),

    heroElementOrder: normalizeHeroElementOrder(formData.get("hero_element_order")),
  };
}

async function revalidateHeroAdmin() {
  revalidateHeroCache();
  revalidatePath("/admin/pages-blocks/blocks/hero");
  revalidatePath("/");
  revalidatePath("/about");
  revalidateMediaCenterPublicPaths();
  revalidatePath("/topics");
  revalidatePath("/contact");
  revalidatePath("/track-your-project");
}

function mediaSynchronizationNotice(
  synchronization: MediaReferenceSynchronizationResult,
) {
  return synchronization.status === "saved_with_media_sync_warning"
    ? "saved_with_media_sync_warning"
    : null;
}

export type CreateHeroTemplateFormActionState = AdminFormActionState;

function createHeroTemplateFailure(
  revision: number,
  message: string,
  field?: "name" | "slug",
): CreateHeroTemplateFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء الهيرو",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createHeroTemplateSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateHeroTemplateFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء الهيرو مع تنبيه" : "تم إنشاء الهيرو",
    message:
      infrastructureWarning ??
      (mediaWarning
        ? "تم إنشاء الهيرو، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء الهيرو بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/hero/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createHeroTemplate(
  previousState: CreateHeroTemplateFormActionState,
  formData: FormData,
): Promise<CreateHeroTemplateFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const rawSlug = cleanText(formData.get("slug"));
  const slug = slugify(rawSlug || name);

  if (!name) return createHeroTemplateFailure(revision, "اسم الهيرو مطلوب.", "name");
  if (!slug) return createHeroTemplateFailure(revision, "اكتب slug صالحًا للهيرو.", "slug");

  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const { data: existing, error: lookupError } = await getSupabaseAdmin()
      .from("hero_templates")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (existing) {
      return createHeroTemplateFailure(
        revision,
        "الـ slug مستخدم بالفعل في Hero آخر.",
        "slug",
      );
    }

    const nextRow = {
      name,
      slug,
      description: cleanText(formData.get("template_description")) || null,
      variant: cleanText(formData.get("variant")) || "internal-page",
      style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
      source_type: cleanText(formData.get("source_type")) || "manual",
      limit_count: parseNumber(formData.get("limit_count"), 1),
      status: parseFormStatus(formData),
      config: buildHeroConfig(formData),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "hero_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `hero-template:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("hero_templates")
          .insert(nextRow)
          .select("id")
          .single<{ id: number }>();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء Hero.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    createdId = coordinated.value.id;
    mediaWarning = Boolean(mediaSynchronizationNotice(coordinated.mediaSynchronization));
    await revalidateHeroAdmin();
    return createHeroTemplateSuccess(
      revision,
      coordinated.value.id,
      mediaWarning,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء الهيرو. حاول مرة أخرى.";
    if (createdId) {
      return createHeroTemplateSuccess(
        revision,
        createdId,
        mediaWarning,
        `تم إنشاء الهيرو، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createHeroTemplateFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function toggleHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  const nextStatus = formData.get("next_status") === "published" ? "published" : "unpublished";

  if (!id) throw new Error("Hero id is missing.");

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateHeroAdmin();
}

export async function deleteHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  if (!id) throw new Error("Hero id is missing.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: number }>();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "hero_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateHeroAdmin();
    } catch (revalidationError) {
      console.error("Hero delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/hero?notice=saved_with_media_sync_warning");
  }
  await revalidateHeroAdmin();
}

export async function duplicateHeroTemplate(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  if (!id) throw new Error("Hero id is missing.");

  const { data: hero, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !hero) throw new Error(error?.message || "Hero not found.");

  const copySlug = `${hero.slug}-copy-${Date.now()}`;

  const nextRow = {
    name: `${hero.name} - نسخة`,
    slug: copySlug,
    description: hero.description,
    section_key: hero.section_key,
    variant: hero.variant,
    style_preset: hero.style_preset,
    source_type: hero.source_type,
    source_id: hero.source_id,
    source_slug: hero.source_slug,
    limit_count: hero.limit_count,
    status: "unpublished",
    sort_order: hero.sort_order + 1,
    config: hero.config,
  };
  const provisionalIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "hero_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `hero-template:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("hero_templates")
        .insert(nextRow)
        .select("id")
        .single<{ id: number }>();
      if (insertError || !data) throw new Error(insertError?.message ?? "تعذر نسخ Hero.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await revalidateHeroAdmin();
  const notice = mediaSynchronizationNotice(coordinated.mediaSynchronization);
  if (notice) redirect(`/admin/pages-blocks/blocks/hero?notice=${notice}`);
}

export async function bulkHeroTemplates(formData: FormData) {
  const actor = await requireAdminSession();
  const action = cleanText(formData.get("bulk_action"));
  const rawIds = formData.getAll("ids");
  const ids = (rawIds.length > 1 ? rawIds : String(formData.get("ids") ?? "").split(","))
    .map((item) => Number(item))
    .filter(Boolean);

  if (!ids.length) return;

  if (action === "show" || action === "hide") {
    const { error } = await getSupabaseAdmin()
      .from("hero_templates")
      .update({ status: action === "show" ? "published" : "unpublished", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("hero_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { data: anchorPage, error: pageError } = await getSupabaseAdmin()
      .from("pages").select("id").order("id").limit(1).maybeSingle();
    if (pageError || !anchorPage) throw new Error(pageError?.message ?? "Page Composition anchor is missing.");
    await mutatePageComposition(Number(anchorPage.id), "delete_hero_templates", { hero_ids: cleanupIds }, actor);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "hero_templates",
        entityIdentity: cleanupId,
      })),
    );
  }

  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateHeroAdmin();
    } catch (revalidationError) {
      console.error("Hero bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/hero?notice=saved_with_media_sync_warning");
  }
  await revalidateHeroAdmin();
}

export async function updateHeroTemplateDetails(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  const name = cleanText(formData.get("name"));
  const rawSlug = cleanText(formData.get("slug"));
  const slug = slugify(rawSlug || name);

  if (!id || !name || !slug) {
    throw new Error("Hero id, name and slug are required.");
  }

  const { data: duplicate } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .maybeSingle();

  if (duplicate) {
    throw new Error("الـ slug مستخدم بالفعل في Hero آخر.");
  }

  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("template_description")) || null,
    variant: cleanText(formData.get("variant")) || "internal-page",
    style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
    source_type: cleanText(formData.get("source_type")) || "manual",
    source_slug: cleanText(formData.get("source_slug")) || null,
    limit_count: parseNumber(formData.get("limit_count"), 1),
    status: parseFormStatus(formData),
    config: buildHeroConfig(formData),
    updated_at: new Date().toISOString(),
  };
  const pageIds = [...new Set(formData.getAll("page_ids").map((value) => Number(value)).filter(Boolean))];
  const { data: anchorPage, error: anchorError } = pageIds.length
    ? { data: { id: pageIds[0] }, error: null }
    : await getSupabaseAdmin().from("pages").select("id").order("id").limit(1).maybeSingle();
  if (anchorError || !anchorPage) throw new Error(anchorError?.message ?? "Page Composition anchor is missing.");
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "hero_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `hero-template:update:${id}`,
    mutate: async () => {
      await mutatePageComposition(Number(anchorPage.id), "replace_hero_template", {
        hero_id: id,
        template: nextRow,
        page_ids: pageIds,
      }, actor);
      return { id };
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await revalidateHeroAdmin();
  revalidatePath(`/admin/pages-blocks/blocks/hero/${id}`);
  const notice = mediaSynchronizationNotice(coordinated.mediaSynchronization);
  redirect(
    `/admin/pages-blocks/blocks/hero/${id}?saved=1${notice ? `&notice=${notice}` : ""}`,
  );
}
