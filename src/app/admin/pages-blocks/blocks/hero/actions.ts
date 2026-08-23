"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
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
import type { Tables } from "../../../../../lib/database.types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  HERO_BULK_ACTIONS,
  parseFormStatus,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  withModuleEditorReturnContextFromForm,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateMediaCenterPublicPaths } from "../../../../../lib/media-center/revalidate-public-paths";
import {
  PROJECT_DETAIL_HERO_ELEMENT_KEYS,
  isDomainBackedHeroTemplateVariant,
  parseHeroTemplateVariant,
  parseHeroContentControlsFormData,
  normalizeHeroTemplateProductConfig,
  resolveHeroContentControlsForVariant,
  resolveHeroImageCompositionPreset,
  type HeroTemplateVariant,
} from "../../../../../lib/hero/hero-content-controls";
import { normalizeRichTextContent } from "../../../../../lib/rich-text/html-utils";
import { mutatePageComposition } from "../../pages/page-actions/helpers";

export type HeroTemplateRow = Pick<
  Tables<"hero_templates">,
  "id" | "name" | "slug" | "description" | "status" | "variant"
> & {
  hero_assignments: Array<
    Pick<Tables<"hero_assignments">, "id" | "path" | "is_active">
  >;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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

function buildHeroConfig(formData: FormData, variant: HeroTemplateVariant) {
  const primaryCtaLabel = cleanText(formData.get("primary_cta_label"));
  const secondaryCtaLabel = cleanText(formData.get("secondary_cta_label"));
  const primaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "primary_cta"));
  const secondaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "secondary_cta"));
  const hasCtaContent =
    Boolean(primaryCtaLabel && primaryCtaLink && !isAdminLinkEmpty(primaryCtaLink)) ||
    Boolean(secondaryCtaLabel && secondaryCtaLink && !isAdminLinkEmpty(secondaryCtaLink));

  const hasInternalContentControls =
    formData.has("hero_element_order") || formData.has("show_eyebrow");
  const controls = resolveHeroContentControlsForVariant(
    parseHeroContentControlsFormData(formData, {
      allowedElementKeys: variant === "project-detail"
        ? PROJECT_DETAIL_HERO_ELEMENT_KEYS
        : undefined,
      defaults: resolveHeroContentControlsForVariant({}, variant),
    }),
    variant,
  );
  const showCta = hasInternalContentControls
    ? controls.showCta
    : formData.get("show_cta") === "on" || hasCtaContent;

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
    imageComposition: resolveHeroImageCompositionPreset(
      formData.get("image_composition"),
    ),
  };

  if (isDomainBackedHeroTemplateVariant(variant)) {
    return {
      imageComposition: base.imageComposition,
      ...controls,
    };
  }

  if (!hasInternalContentControls) {
    return base;
  }

  return {
    ...base,
    ...controls,
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
  revalidatePath("/projects/[slug]", "page");
}

async function findDomainBackedVariantTemplate(
  variant: HeroTemplateVariant,
  excludeId?: number,
) {
  if (!isDomainBackedHeroTemplateVariant(variant)) return null;

  let query = getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("variant", variant)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
  field?: "name" | "slug" | "variant",
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

    const variant = parseHeroTemplateVariant(formData.get("variant"));
    const existingVariant = await findDomainBackedVariantTemplate(variant);
    if (existingVariant) {
      return createHeroTemplateFailure(
        revision,
        "يوجد بالفعل قالب Hero معتمد لهذا الـvariant؛ افتحه لإدارة Presentation بدل إنشاء مصدر موازٍ.",
        "variant",
      );
    }
    const nextRow = {
      name,
      slug,
      description: cleanText(formData.get("template_description")) || null,
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
      source_type: isDomainBackedHeroTemplateVariant(variant) ? "domain-backed" : "manual",
      source_id: null,
      source_slug: null,
      limit_count: 1,
      status: parseFormStatus(formData),
      config: buildHeroConfig(formData, variant),
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
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء Hero.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    createdId = coordinated.value.id;
    mediaWarning = Boolean(mediaSynchronizationNotice(coordinated.mediaSynchronization));
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("content_block_template", "create"),
      entityType: "content_block_template",
      entityId: coordinated.value.id,
      entityLabel: name,
      metadata: { blockType: "hero", slug },
    }, actor);
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
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  const nextStatus = formData.get("next_status") === "published" ? "published" : "unpublished";

  if (!id) throw new Error("Hero id is missing.");

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "content_block_template",
      nextStatus === "published" ? "publish" : "unpublish",
    ),
    entityType: "content_block_template",
    entityId: id,
    metadata: { blockType: "hero", status: nextStatus },
  }, actor);
  await revalidateHeroAdmin();
}

export async function deleteHeroTemplate(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  if (!id) throw new Error("Hero id is missing.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id,variant")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (isDomainBackedHeroTemplateVariant(existing?.variant)) {
    throw new Error("قالب Hero المعتمد لتفاصيل المشروع لا يُحذف؛ يمكن إخفاؤه من حالة النشر.");
  }
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "delete"),
    entityType: "content_block_template",
    entityId: cleanupIdentity,
    metadata: { blockType: "hero" },
  }, actor);
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
  if (isDomainBackedHeroTemplateVariant(hero.variant)) {
    throw new Error("هذا Hero هو Configuration معتمدة للـvariant ولا يقبل إنشاء نسخة موازية.");
  }

  const copySlug = `${hero.slug}-copy-${Date.now()}`;

  const nextRow = {
    name: `${hero.name} - نسخة`,
    slug: copySlug,
    description: hero.description,
    section_key: hero.section_key,
    variant: hero.variant,
    style_preset: hero.style_preset,
    source_type: "manual",
    source_id: null,
    source_slug: null,
    limit_count: 1,
    status: "unpublished",
    sort_order: hero.sort_order + 1,
    config: normalizeHeroTemplateProductConfig(
      hero.config && typeof hero.config === "object" && !Array.isArray(hero.config)
        ? hero.config as Record<string, unknown>
        : {},
      hero.variant,
    ),
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
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? "تعذر نسخ Hero.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "duplicate"),
    entityType: "content_block_template",
    entityId: coordinated.value.id,
    entityLabel: nextRow.name,
    metadata: { blockType: "hero", sourceId: id },
  }, actor);
  await revalidateHeroAdmin();
  const notice = mediaSynchronizationNotice(coordinated.mediaSynchronization);
  if (notice) redirect(`/admin/pages-blocks/blocks/hero?notice=${notice}`);
}

export async function bulkHeroTemplates(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    HERO_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));

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
      .select("id,variant")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);
    if ((existingRows ?? []).some((row) => isDomainBackedHeroTemplateVariant(row.variant))) {
      throw new Error("لا يمكن حذف Hero المعتمد لvariant ديناميكي ضمن إجراء جماعي.");
    }

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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "content_block_template",
      action === "delete" ? "delete" : action === "show" ? "publish" : "unpublish",
    ),
    entityType: "content_block_template",
    entityLabel: "hero_templates",
    metadata: { blockType: "hero", action, ids, count: ids.length },
  }, actor);
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

  const { data: duplicate, error: duplicateError } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .maybeSingle();

  if (duplicateError) throw new Error(duplicateError.message);

  if (duplicate) {
    throw new Error("الـ slug مستخدم بالفعل في Hero آخر.");
  }

  const variant = parseHeroTemplateVariant(formData.get("variant"));
  const existingVariant = await findDomainBackedVariantTemplate(variant, id);
  if (existingVariant) {
    throw new Error("يوجد بالفعل قالب Hero معتمد لهذا الـvariant.");
  }
  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("template_description")) || null,
    variant,
    style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
    source_type: isDomainBackedHeroTemplateVariant(variant) ? "domain-backed" : "manual",
    source_id: null,
    source_slug: null,
    limit_count: 1,
    status: parseFormStatus(formData),
    config: buildHeroConfig(formData, variant),
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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "hero", slug },
  }, actor);
  await revalidateHeroAdmin();
  revalidatePath(`/admin/pages-blocks/blocks/hero/${id}`);
  const notice = mediaSynchronizationNotice(coordinated.mediaSynchronization);
  redirect(withModuleEditorReturnContextFromForm(
    `/admin/pages-blocks/blocks/hero/${id}?saved=1${notice ? `&notice=${notice}` : ""}`,
    formData,
  ));
}

export async function getHeroTemplateRows(): Promise<HeroTemplateRow[]> {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id,name,slug,description,status,variant,hero_assignments(id,path,is_active)")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
