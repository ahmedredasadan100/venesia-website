export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import MediaSidebarModuleEditClient from "../../../../../../components/admin/page-blocks/MediaSidebarModuleEditClient";
import { loadTopicFilterOptionsForAdmin } from "../../../../../../lib/feed-modules/load-topic-filter-options";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getMediaSidebarModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { updateMediaSidebarModule } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function MediaSidebarModuleEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext, filterOptions] = await Promise.all([
    getSupabaseAdmin().from("media_sidebar_module_templates").select("*").eq("id", id).maybeSingle(),
    getMediaSidebarModuleAssignmentContext(id),
    loadTopicFilterOptionsForAdmin(),
  ]);

  if (error) throw new Error(`Media Sidebar template read failed: ${error.message}`);
  if (!block) notFound();

  return (
    <MediaSidebarModuleEditClient
      block={block}
      categories={filterOptions.categories}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateMediaSidebarModule}
    />
  );
}
