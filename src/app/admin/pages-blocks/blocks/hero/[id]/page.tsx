import { notFound } from "next/navigation";
import { getStatus } from "../../../../../../lib/page-blocks/admin-utils";
import { getHeroModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import HeroEditClient from "./HeroEditClient";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string; notice?: string }> | { saved?: string; notice?: string };
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
  ["home-cinematic", "سينمائي للصفحة الرئيسية"],
  ["internal-page", "صفحة داخلية"],
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

  const [{ data: hero, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin()
      .from("hero_templates")
      .select("*")
      .eq("id", heroId)
      .maybeSingle(),
    getHeroModuleAssignmentContext(heroId),
  ]);

  if (error || !hero) notFound();

  const config =
    hero.config && typeof hero.config === "object" && !Array.isArray(hero.config)
      ? hero.config
      : {};
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
        status: getStatus(hero.status),
      }}
      config={config}
      imagesText={imagesToTextarea(config)}
      mobileImagesText={mobileImagesToTextarea(config)}
      sourceOptions={sourceOptions}
      variantOptions={variantOptions}
      saved={Boolean(resolvedSearch.saved)}
      mediaSynchronizationWarning={
        resolvedSearch.notice === "saved_with_media_sync_warning"
      }
      assignmentContext={assignmentContext}
    />
  );
}
