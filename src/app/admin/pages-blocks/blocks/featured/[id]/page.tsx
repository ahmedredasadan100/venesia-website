export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import FeaturedModuleEditClient from "../../../../../../components/admin/page-blocks/FeaturedModuleEditClient";
import { parseFeaturedModuleConfig } from "../../../../../../lib/featured-modules/config";
import { loadFeaturedEditorOptions } from "../../../../../../lib/featured-modules/load-editor-options";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { updateFeaturedModule } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function FeaturedModuleEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();
  const [{ data: block, error }, assignmentContext, editorOptions] = await Promise.all([
    getSupabaseAdmin().from("featured_module_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("featured", id),
    loadFeaturedEditorOptions(),
  ]);
  if (error) throw new Error(`Featured template read failed: ${error.message}`);
  if (!block) notFound();
  return (
    <FeaturedModuleEditClient
      block={block}
      config={parseFeaturedModuleConfig(
        block.config && typeof block.config === "object" && !Array.isArray(block.config)
          ? block.config as Record<string, unknown>
          : null,
      )}
      editorOptions={editorOptions}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateFeaturedModule}
    />
  );
}
