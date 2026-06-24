export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkContentBlocks,
  createContentBlock,
  deleteContentBlock,
  duplicateContentBlock,
  toggleContentBlockStatus,
} from "./actions";

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

  return (
    <BlockModuleManagerClient
      moduleKey="content"
      moduleTitle="إدارة بلوكات المحتوى"
      moduleDescription="قوالب المحتوى النصي القابلة لإعادة الاستخدام. اربطها بالصفحات من Pages Manager."
      rows={(data ?? []).map((row) => ({ ...row, description: row.description ?? null }))}
      createAction={createContentBlock}
      deleteAction={deleteContentBlock}
      duplicateAction={duplicateContentBlock}
      toggleAction={toggleContentBlockStatus}
      bulkAction={bulkContentBlocks}
      defaultVariant="default"
      variantOptions={[["default", "Default"], ["split-image-right", "Split Image Right"], ["quote-emphasis", "Quote Emphasis"]]}
    />
  );
}
