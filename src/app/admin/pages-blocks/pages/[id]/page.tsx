import { notFound } from "next/navigation";
import { AdminFeedbackRegion } from "../../../../../components/admin/AdminFeedbackProvider";
import { AdminPageContextHeader, AdminPageExperience } from "../../../../../components/admin/ui";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { getPageModuleAssignmentsForAdmin } from "../../../../../lib/page-blocks/admin-queries";
import { getPageCompositionColumnPreferenceConfig } from "../../../../../lib/page-blocks/admin-collection-columns";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { getGlobalSeoDefaults } from "../../../../../lib/seo/global-seo-defaults";
import { loadGlobalSeoSettings } from "../../../../../lib/seo/load-global-seo-settings";
import { getSeoTitleSuffix } from "../../../../../lib/seo/seo-utils";
import { resolveSeoMetadata } from "../../../../../lib/seo/resolve-seo-metadata";
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

function PageCompositionLoadError({ title, message }: { title: string; message: string }) {
  return (
    <AdminPageExperience state="error" dir="rtl">
      <AdminPageContextHeader
        eyebrow="تكوين الصفحات"
        title={title}
        description="تعذر تحميل بيانات تكوين الصفحة. لم تُنفذ أي تغييرات."
        status="error"
      />
      <AdminFeedbackRegion
        channel="page-composition:load"
        label="خطأ تحميل تكوين الصفحة"
        feedback={{
          variant: "danger",
          title: "تعذر تحميل تكوين الصفحة",
          message,
          layout: "inline",
          dismissible: true,
          lifecycle: "persistent",
        }}
      />
    </AdminPageExperience>
  );
}

export default async function PageBlocksDetailsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageId = Number(resolvedParams.id);

  if (!pageId || Number.isNaN(pageId)) {
    notFound();
  }

  const [pageResult, preference, assignmentsResult, globalSeo] = await Promise.all([
    getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path,page_type,status,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt")
      .eq("id", pageId)
      .maybeSingle(),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("pageAssignments").viewKey,
    ),
    getPageModuleAssignmentsForAdmin(pageId)
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => ({ data: null, error })),
    loadGlobalSeoSettings().catch(() => getGlobalSeoDefaults()),
  ]);
  const { data: page, error: pageError } = pageResult;

  if (pageError) {
    return (
      <PageCompositionLoadError
        title="تكوين الصفحة"
        message={`حدث خطأ أثناء قراءة الصفحة: ${pageError.message}`}
      />
    );
  }

  if (!page) {
    notFound();
  }

  if (assignmentsResult.error || !assignmentsResult.data) {
    const message = assignmentsResult.error instanceof Error
      ? assignmentsResult.error.message
      : "خطأ غير معروف";
    return (
      <PageCompositionLoadError
        title={`تكوين ${page.title}`}
        message={`حدث خطأ أثناء قراءة بلوكات الصفحة: ${message}`}
      />
    );
  }

  const assignmentsData = assignmentsResult.data;
  const resolvedSeoFallback = resolveSeoMetadata(
    { path: page.path },
    globalSeo,
  );

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
        content: assignmentsData.seoContent,
        titleSuffix: getSeoTitleSuffix(globalSeo),
        resolvedFallback: {
          title: resolvedSeoFallback.title,
          description: resolvedSeoFallback.description,
          image: resolvedSeoFallback.image,
          imageAlt: resolvedSeoFallback.imageAlt,
        },
        seoTitle: page.seo_title ?? "",
        seoDescription: page.seo_description ?? "",
        focusKeyword: page.focus_keyword ?? "",
        seoKeywords: Array.isArray(page.seo_keywords) ? page.seo_keywords : [],
        canonicalUrl: page.canonical_url ?? "",
        robotsIndex: page.robots_index ?? null,
        robotsFollow: page.robots_follow ?? null,
        ogImage: page.og_image ?? "",
        ogImageAlt: page.og_image_alt ?? "",
        notice: seoNotice,
        error: seoError,
      }}
      initialTabId={resolveInitialTabId(resolvedSearchParams?.tab, Boolean(seoNotice || seoError))}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
