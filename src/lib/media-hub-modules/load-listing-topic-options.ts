import "server-only";

import type { MediaContentType } from "../media-center/types";
import { getSupabaseAdmin } from "../supabase-admin";
import type { MediaHubListingTopicOption } from "./types";

export async function loadMediaHubListingTopicOptions(
  mediaType: MediaContentType,
): Promise<MediaHubListingTopicOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,title")
    .eq("content_type", mediaType)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "like", "e2e-test%")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`Unable to load Media Hub topic options: ${error.message}`);

  return (data ?? []).map((topic) => ({ id: topic.id, title: topic.title }));
}
