import Link from "next/link";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { AdminPageHeader } from "../../../../../components/admin/ui";

export const dynamic = "force-dynamic";

export default async function MediaSidebarModulesPage() {
  const { data: templates, error } = await getSupabaseAdmin()
    .from("media_sidebar_module_templates")
    .select("id,name,slug,widget_key,status,sort_order")
    .order("sort_order");

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <AdminPageHeader
        title="Media Sidebar Modules"
        description="قوالب لوحات الشريط الجانبي للمركز الإعلامي — تُدار الربط من صفحات Pages Blocks."
      />

      <div className="overflow-hidden rounded-[28px] border border-white/10">
        <table className="w-full text-right text-sm text-white/75">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.2em] text-white/45">
            <tr>
              <th className="px-5 py-4">الاسم</th>
              <th className="px-5 py-4">Slug</th>
              <th className="px-5 py-4">Widget</th>
              <th className="px-5 py-4">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((template) => (
              <tr key={template.id} className="border-t border-white/10">
                <td className="px-5 py-4">
                  <Link href={`/admin/pages-blocks/blocks/media-sidebar/${template.id}`} className="font-semibold text-[#D8B87A] hover:text-[#e5c98d]">
                    {template.name}
                  </Link>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-white/45" dir="ltr">{template.slug}</td>
                <td className="px-5 py-4">{template.widget_key}</td>
                <td className="px-5 py-4">{template.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
