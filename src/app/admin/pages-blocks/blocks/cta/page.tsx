export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkCtaBlocks,
  createCtaBlock,
  deleteCtaBlock,
  duplicateCtaBlock,
  toggleCtaBlockStatus,
} from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function CtaBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("cta_block_templates")
      .select("id,name,slug,description,variant,status,updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("ctaTemplates").viewKey,
    ),
  ]);
  const { data, error } = templatesResult;

  return (
    <BlockModuleManagerClient
      moduleKey="cta"
      moduleTitle="إدارة بلوكات CTA"
      moduleDescription="قوالب الدعوة للإجراء — أزرار، عناوين، وخلفيات قابلة لإعادة الاستخدام."
      rows={(data ?? []).map((row) => ({ ...row, description: row.description ?? null }))}
      createAction={createCtaBlock}
      deleteAction={deleteCtaBlock}
      duplicateAction={duplicateCtaBlock}
      toggleAction={toggleCtaBlockStatus}
      bulkAction={bulkCtaBlocks}
      defaultVariant="band"
      variantOptions={[["band", "Band"], ["split-image", "Split Image"], ["minimal", "Minimal"]]}
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات CTA: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
