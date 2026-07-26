export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import MediaSynchronizationWarningNotice from "../../../../../components/admin/media/MediaSynchronizationWarningNotice";
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
    <>
    <MediaSynchronizationWarningNotice visible={query.notice === "saved_with_media_sync_warning"} />
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
    </>
  );
}
