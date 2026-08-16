export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import MediaHubModuleEditClient from "../../../../../../components/admin/page-blocks/MediaHubModuleEditClient";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getMediaHubModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { updateMediaHubModule } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function MediaHubModuleEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("media_hub_module_templates").select("*").eq("id", id).maybeSingle(),
    getMediaHubModuleAssignmentContext(id),
  ]);

  if (error || !block) notFound();

  return (
    <MediaHubModuleEditClient
      block={block}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateMediaHubModule}
    />
  );
}
