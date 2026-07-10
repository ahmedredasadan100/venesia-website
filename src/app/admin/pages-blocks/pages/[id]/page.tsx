import { notFound } from "next/navigation";
import { getPageModuleAssignmentsForAdmin } from "../../../../../lib/page-blocks/admin-queries";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import PageBlocksClient from "./PageBlocksClient";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?:
    | Promise<{ seo_notice?: string; seo_error?: string; tab?: string }>
    | { seo_notice?: string; seo_error?: string; tab?: string };
};

function resolveInitialTabId(tab: string | undefined, hasSeoFeedback: boolean) {
  if (tab === "seo" || tab === "map" || tab === "modules") return tab;
  if (hasSeoFeedback) return "seo";
  return "modules";
}

export default async function PageBlocksDetailsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageId = Number(resolvedParams.id);

  if (!pageId || Number.isNaN(pageId)) {
    notFound();
  }

  const { data: page, error: pageError } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status,seo_title,seo_description,seo_keywords")
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

  const seoNotice = resolvedSearchParams?.seo_notice ?? null;
  const seoError = resolvedSearchParams?.seo_error
    ? decodeURIComponent(resolvedSearchParams.seo_error)
    : null;

  return (
    <PageBlocksClient
      page={page}
      assignments={assignmentsData.assignments}
      templates={assignmentsData.templates}
      seo={{
        seoTitle: page.seo_title ?? "",
        seoDescription: page.seo_description ?? "",
        seoKeywords: Array.isArray(page.seo_keywords) ? page.seo_keywords : [],
        notice: seoNotice,
        error: seoError,
      }}
      initialTabId={resolveInitialTabId(resolvedSearchParams?.tab, Boolean(seoNotice || seoError))}
    />
  );
}
