export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import ContentBlocksTableClient from "./ContentBlocksTableClient";
import type { ContentBlockRow } from "./actions";
import MediaSynchronizationWarningNotice from "../../../../../components/admin/media/MediaSynchronizationWarningNotice";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function ContentBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const { data, error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة بلوكات المحتوى: {error.message}
      </div>
    );
  }

  const rows: ContentBlockRow[] = (data ?? []).map((row) => ({
    ...row,
    description: row.description ?? null,
  }));

  return (
    <>
      <MediaSynchronizationWarningNotice visible={query.notice === "saved_with_media_sync_warning"} />
      <ContentBlocksTableClient rows={rows} />
    </>
  );
}
