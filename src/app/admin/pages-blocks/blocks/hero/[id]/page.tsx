import { notFound } from "next/navigation";
import { getHeroModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import HeroEditClient from "./HeroEditClient";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

const sourceOptions: [string, string][] = [
  ["manual", "يدوي"],
  ["latest_topics", "آخر مواضيع تهمك"],
  ["featured_topics", "مواضيع مميزة"],
  ["topic_category", "تصنيف من مواضيع تهمك"],
  ["latest_media", "آخر عناصر المركز الإعلامي"],
  ["featured_media", "عناصر إعلامية مميزة"],
  ["media_category", "تصنيف من المركز الإعلامي"],
];

const variantOptions: [string, string][] = [
  ["home-cinematic", "Home Cinematic"],
  ["internal-page", "Internal Page"],
];

function imagesToTextarea(config: Record<string, unknown> | null) {
  const images = config?.images;
  return Array.isArray(images) ? images.join("\n") : "";
}

function mobileImagesToTextarea(config: Record<string, unknown> | null) {
  const images = config?.mobileImages ?? config?.mobile_images;
  return Array.isArray(images) ? images.join("\n") : "";
}

export default async function HeroDetailsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const heroId = Number(resolvedParams.id);

  if (!heroId) notFound();

  const [{ data: hero, error }, { data: pages }, assignmentContext] = await Promise.all([
    getSupabaseAdmin()
      .from("hero_templates")
      .select("*,hero_assignments(id,target_type,target_id,target_slug,path,is_active)")
      .eq("id", heroId)
      .maybeSingle(),
    getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path,page_type,status")
      .order("sort_order", { ascending: true }),
    getHeroModuleAssignmentContext(heroId),
  ]);

  if (error || !hero) notFound();

  const config = (hero.config ?? {}) as Record<string, unknown>;
  const assignedPageIds = ((hero.hero_assignments ?? []) as { target_type: string; target_id: number; is_active: boolean }[])
    .filter((item) => item.target_type === "page" && item.is_active)
    .map((item) => Number(item.target_id));

  return (
    <HeroEditClient
      hero={{
        id: hero.id,
        name: hero.name,
        slug: hero.slug,
        description: hero.description,
        variant: hero.variant,
        style_preset: hero.style_preset,
        source_type: hero.source_type,
        source_slug: hero.source_slug,
        limit_count: hero.limit_count,
        is_visible: hero.is_visible,
      }}
      config={config}
      imagesText={imagesToTextarea(config)}
      mobileImagesText={mobileImagesToTextarea(config)}
      assignedPageIds={assignedPageIds}
      pages={(pages ?? []).map((page) => ({
        id: page.id,
        title: page.title,
        path: page.path,
      }))}
      sourceOptions={sourceOptions}
      variantOptions={variantOptions}
      saved={Boolean(resolvedSearch.saved)}
      assignmentContext={assignmentContext}
    />
  );
}
