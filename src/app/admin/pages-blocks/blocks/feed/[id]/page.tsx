export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { parseFeedModuleConfig } from "../../../../../../lib/feed-modules/parse-feed-config";
import { TOPICS_FEED_TYPES, type TopicsFeedType } from "../../../../../../lib/feed-modules/types";
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

  if (error) throw new Error(`Feed template read failed: ${error.message}`);
  if (!block) notFound();

  const feedType = TOPICS_FEED_TYPES.includes(block.feed_type as TopicsFeedType)
    ? (block.feed_type as TopicsFeedType)
    : null;
  if (!feedType) notFound();

  const persistedConfig =
    block.config && typeof block.config === "object" && !Array.isArray(block.config)
      ? block.config
      : null;
  const config = parseFeedModuleConfig(persistedConfig, feedType);

  return (
    <FeedModuleEditClient
      block={{ ...block, feed_type: feedType }}
      config={config}
      filterOptions={filterOptions}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateFeedModule}
    />
  );
}
