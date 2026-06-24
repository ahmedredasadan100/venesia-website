import { notFound } from "next/navigation";
import { getPageModuleAssignmentsForAdmin } from "../../../../../lib/page-blocks/admin-queries";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import PageBlocksClient from "./PageBlocksClient";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function PageBlocksDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const pageId = Number(resolvedParams.id);

  if (!pageId || Number.isNaN(pageId)) {
    notFound();
  }

  const { data: page, error: pageError } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة الصفحة: {pageError.message}
      </div>
    );
  }

  if (!page) {
    notFound();
  }

  let assignmentsData;
  try {
    assignmentsData = await getPageModuleAssignmentsForAdmin(pageId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة بلوكات الصفحة: {message}
      </div>
    );
  }

  return (
    <PageBlocksClient
      page={page}
      assignments={assignmentsData.assignments}
      templates={assignmentsData.templates}
    />
  );
}
