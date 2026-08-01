export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
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
  const { data, error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

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
      variantOptions={[["glass", "Glass"], ["bordered", "Bordered"], ["compact", "Compact"]]}
      loadError={error ? `حدث خطأ أثناء قراءة بلوكات الكروت: ${error.message}` : null}
      mediaSynchronizationWarning={query.notice === "saved_with_media_sync_warning"}
    />
  );
}
