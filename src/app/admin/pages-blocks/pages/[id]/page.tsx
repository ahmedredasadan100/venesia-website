import { notFound } from "next/navigation";
import { deriveHomepageFallbackStatus } from "../../../../../lib/home/derive-homepage-fallback-status";
import { getPageModuleAssignmentsForAdmin } from "../../../../../lib/page-blocks/admin-queries";
import { loadPageCompositionBySlug } from "../../../../../lib/page-blocks/load-page-composition";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import HomepageFallbackStatusPanel from "./HomepageFallbackStatusPanel";
import PageBlocksClient from "./PageBlocksClient";
import PageSeoPanel from "./PageSeoPanel";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ seo_notice?: string; seo_error?: string }> | { seo_notice?: string; seo_error?: string };
};

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

  const homepageFallbackReport =
    page.slug === "home"
      ? deriveHomepageFallbackStatus(await loadPageCompositionBySlug("home", "stack"))
      : null;

  return (
    <div className="space-y-7">
      {homepageFallbackReport ? <HomepageFallbackStatusPanel report={homepageFallbackReport} /> : null}

      <PageSeoPanel
        pageId={page.id}
        path={page.path}
        seoTitle={page.seo_title ?? ""}
        seoDescription={page.seo_description ?? ""}
        seoKeywords={Array.isArray(page.seo_keywords) ? page.seo_keywords : []}
        notice={resolvedSearchParams?.seo_notice ?? null}
        error={resolvedSearchParams?.seo_error ? decodeURIComponent(resolvedSearchParams.seo_error) : null}
      />

      <PageBlocksClient
        page={page}
        assignments={assignmentsData.assignments}
        templates={assignmentsData.templates}
      />
    </div>
  );
}
