import { notFound } from "next/navigation";
import { getStatus } from "../../../../../../lib/page-blocks/admin-utils";
import { getHeroModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import HeroEditClient from "./HeroEditClient";
import { HERO_TEMPLATE_VARIANT_OPTIONS_AR } from "../../../../../../lib/hero/hero-content-controls";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string; notice?: string; tab?: string }> | { saved?: string; notice?: string; tab?: string };
};

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

  if (error) throw new Error(`Hero template read failed: ${error.message}`);
  if (!hero) notFound();

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
        status: getStatus(hero.status),
      }}
      config={config}
      imagesText={imagesToTextarea(config)}
      mobileImagesText={mobileImagesToTextarea(config)}
      variantOptions={HERO_TEMPLATE_VARIANT_OPTIONS_AR}
      saved={Boolean(resolvedSearch.saved)}
      mediaSynchronizationWarning={
        resolvedSearch.notice === "saved_with_media_sync_warning"
      }
      assignmentContext={assignmentContext}
      initialTabId={resolvedSearch.tab === "buttons" ? "buttons" : undefined}
    />
  );
}
