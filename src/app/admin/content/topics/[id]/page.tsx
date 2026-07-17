import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import ArticleEditorPage from "../../../topics/[id]/page";
import MediaEditorPage from "../../media/[id]/page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function UnifiedContentEditorPage(props: PageProps) {
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

  if (topic.content_type === "article") {
    return ArticleEditorPage(props);
  }

  if (["news", "press", "site_update", "video", "gallery"].includes(topic.content_type)) {
    return MediaEditorPage(props);
  }

  notFound();
}
