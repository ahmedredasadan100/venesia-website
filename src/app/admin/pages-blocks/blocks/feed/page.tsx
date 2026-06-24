export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import BlockModuleManagerClient from "../../../../../components/admin/page-blocks/BlockModuleManagerClient";
import {
  bulkFeedModules,
  createFeedModule,
  deleteFeedModule,
  duplicateFeedModule,
  toggleFeedModuleStatus,
} from "./actions";

export default async function FeedModulesPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .select("id,name,slug,description,feed_type,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة Feed Modules: {error.message}
      </div>
    );
  }

  return (
    <BlockModuleManagerClient
      moduleKey="feed"
      moduleTitle="إدارة Feed Modules"
      moduleDescription="قوالب Feed Widget لموضوعات تهمك — إعدادات الاستعلام والعرض فقط. اربطها بالصفحات من Pages Manager."
      rows={(data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description ?? row.feed_type,
        variant: row.feed_type,
        status: row.status,
      }))}
      createAction={createFeedModule}
      deleteAction={deleteFeedModule}
      duplicateAction={duplicateFeedModule}
      toggleAction={toggleFeedModuleStatus}
      bulkAction={bulkFeedModules}
      defaultVariant="latest"
      variantOptions={[
        ["latest", "Latest Topics"],
        ["popular", "Popular Topics"],
        ["categories", "Categories"],
        ["series", "Series"],
      ]}
    />
  );
}
