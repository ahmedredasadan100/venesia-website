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

export default async function CardsBlocksPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة بلوكات الكروت: {error.message}
      </div>
    );
  }

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
    />
  );
}
