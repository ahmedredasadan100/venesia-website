export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { parseFeedModuleConfig } from "../../../../../../lib/feed-modules/parse-feed-config";
import { loadTopicFilterOptionsForAdmin } from "../../../../../../lib/feed-modules/load-topic-filter-options";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import FeedModuleEditClient from "../../../../../../components/admin/page-blocks/FeedModuleEditClient";
import { updateFeedModule } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function FeedModuleEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext, filterOptions] = await Promise.all([
    getSupabaseAdmin().from("feed_module_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("feed", id),
    loadTopicFilterOptionsForAdmin(),
  ]);

  if (error || !block) notFound();

  const config = parseFeedModuleConfig(block.config);

  return (
    <FeedModuleEditClient
      block={block}
      config={config}
      filterOptions={filterOptions}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateFeedModule}
    />
  );
}
