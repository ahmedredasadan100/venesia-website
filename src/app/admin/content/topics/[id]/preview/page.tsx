import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import ArticlePreviewPage from "../../../../topics/[id]/preview/page";
import MediaPreviewPage from "../../../media/[id]/preview/page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UnifiedContentPreviewPage(props: PageProps) {
  await requireAdminSession();
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();

  const { data: topic } = await getSupabaseAdmin()
    .from("topics")
    .select("content_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ content_type: string }>();

  if (!topic) notFound();

  if (topic.content_type === "article") return ArticlePreviewPage(props);
  if (["news", "press", "site_update", "video", "gallery"].includes(topic.content_type)) {
    return MediaPreviewPage(props);
  }

  notFound();
}
