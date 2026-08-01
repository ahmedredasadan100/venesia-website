export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import ContentBlocksTableClient from "./ContentBlocksTableClient";
import type { ContentBlockRow } from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function ContentBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const { data, error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const rows: ContentBlockRow[] = (data ?? []).map((row) => ({
    ...row,
    description: row.description ?? null,
  }));

  return (
    <ContentBlocksTableClient
      rows={rows}
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات المحتوى: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
    />
  );
}
