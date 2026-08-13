export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkCardsBlocks,
  createCardsBlock,
  deleteCardsBlock,
  duplicateCardsBlock,
  toggleCardsBlockStatus,
} from "./actions";

type PageProps = { searchParams?: Promise<{ notice?: string }> | { notice?: string } };

export default async function CardsBlocksPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const [templatesResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("cards_block_templates")
      .select("id,name,slug,description,variant,status,updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("cardsTemplates").viewKey,
    ),
  ]);
  const { data, error } = templatesResult;

  return (
    <BlockModuleManagerClient
      moduleKey="cards"
      moduleTitle="إدارة بلوكات الكروت"
      moduleDescription="شبكات الكروت للمزايا، المبادئ، وأسباب التواصل."
      rows={(data ?? []).map((row) => ({ ...row, description: row.description ?? null }))}
      createAction={createCardsBlock}
      deleteAction={deleteCardsBlock}
      duplicateAction={duplicateCardsBlock}
      toggleAction={toggleCardsBlockStatus}
      bulkAction={bulkCardsBlocks}
      defaultVariant="glass"
      variantOptions={[["glass", "زجاجي"], ["bordered", "بإطار"], ["compact", "مدمج"]]}
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات الكروت: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
