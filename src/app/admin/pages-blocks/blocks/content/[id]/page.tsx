export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import ContentModuleEditClient from "../../../../../../components/admin/page-blocks/ContentModuleEditClient";
import { updateContentBlock } from "../actions";
import { isRetiredContentBlockTemplateSlug } from "../../../../../../lib/page-blocks/deprecated-block-modules";
import {
  getContentModuleEditorKey,
  resolveContentModuleEditorConfig,
} from "../../../../../../lib/page-blocks/module-edit-registry";
import { withModuleEditorReturnPageId } from "../../../../../../lib/page-blocks/admin-utils";
import { loadTopicFilterOptionsForAdmin } from "../../../../../../lib/feed-modules/load-topic-filter-options";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?:
    | Promise<{ saved?: string; returnPageId?: string }>
    | { saved?: string; returnPageId?: string };
};

export default async function ContentBlockEditPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("content_block_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("content", id),
  ]);

  if (error) throw new Error(`Content template read failed: ${error.message}`);
  if (!block || isRetiredContentBlockTemplateSlug(block.slug)) notFound();

  const config = resolveContentModuleEditorConfig({
    slug: block.slug,
    variant: block.variant,
    config: block.config,
  });
  const topicCategoryOptions =
    getContentModuleEditorKey(block.slug, block.variant) === "topics-listing"
      ? (await loadTopicFilterOptionsForAdmin()).categories
      : [];
  let projectDetailHeroEditorLinks: {
    root: string;
    buttons: string;
  } | null = null;
  if (getContentModuleEditorKey(block.slug, block.variant) === "projects-hub-hero") {
    const { data: projectDetailHero, error: projectDetailHeroError } =
      await getSupabaseAdmin()
        .from("hero_templates")
        .select("id")
        .eq("variant", "project-detail")
        .maybeSingle();

    if (projectDetailHeroError) {
      throw new Error(
        `Project Detail Hero read failed: ${projectDetailHeroError.message}`,
      );
    }
    if (!projectDetailHero) {
      throw new Error("Project Detail Hero owner is missing.");
    }

    projectDetailHeroEditorLinks = {
      root: withModuleEditorReturnPageId(
        `/admin/pages-blocks/blocks/hero/${projectDetailHero.id}`,
        resolvedSearch.returnPageId,
      ),
      buttons: withModuleEditorReturnPageId(
        `/admin/pages-blocks/blocks/hero/${projectDetailHero.id}?tab=buttons`,
        resolvedSearch.returnPageId,
      ),
    };
  }

  return (
    <ContentModuleEditClient
      block={{
        id: block.id,
        name: block.name,
        slug: block.slug,
        description: block.description,
        variant: block.variant,
        style_preset: block.style_preset,
        status: block.status,
        updated_at: block.updated_at,
      }}
      config={config}
      assignmentContext={assignmentContext}
      projectDetailHeroEditorLinks={projectDetailHeroEditorLinks}
      topicCategoryOptions={topicCategoryOptions}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateContentBlock}
    />
  );
}
