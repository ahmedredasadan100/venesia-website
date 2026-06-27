export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import ContentBlocksTableClient from "./ContentBlocksTableClient";
import type { ContentBlockRow } from "./actions";

export default async function ContentBlocksPage() {
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

  return <ContentBlocksTableClient rows={rows} />;
}
