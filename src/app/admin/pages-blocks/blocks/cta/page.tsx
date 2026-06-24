export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkCtaBlocks,
  createCtaBlock,
  deleteCtaBlock,
  duplicateCtaBlock,
  toggleCtaBlockStatus,
} from "./actions";

export default async function CtaBlocksPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة بلوكات CTA: {error.message}
      </div>
    );
  }

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
    />
  );
}
