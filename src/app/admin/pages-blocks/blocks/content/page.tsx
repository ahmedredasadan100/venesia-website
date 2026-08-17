export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import ContentBlocksTableClient from "./ContentBlocksTableClient";
import type { ContentBlockRow } from "./actions";
import { isRetiredContentBlockTemplateSlug } from "../../../../../lib/page-blocks/deprecated-block-modules";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function ContentBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("content_block_templates")
      .select("id,name,slug,description,variant,status,updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("contentTemplates").viewKey,
    ),
  ]);
  const { data, error } = templatesResult;

  const rows: ContentBlockRow[] = (data ?? [])
    .filter((row) => !isRetiredContentBlockTemplateSlug(row.slug))
    .map((row) => ({
      ...row,
      description: row.description ?? null,
    }));

  return (
    <ContentBlocksTableClient
      rows={rows}
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات المحتوى: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
