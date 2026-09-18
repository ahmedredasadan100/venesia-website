import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import {
  isSearchPlatformLauncherTemplate,
  SEARCH_PLATFORM_PUBLIC_ROUTE,
  SEARCH_PLATFORM_TEMPLATE_SLUG,
} from "../page-blocks/search-platform-config";

export type PublicPagePublicationDependencyResult =
  | {
      ok: true;
      dependency: null | {
        key: "search-platform";
        destinationPath: string;
        activeLauncherCount: number;
      };
    }
  | { ok: false; code: "dependency_read_failed" | "dependency_invariant_broken"; message: string };

type PageIdentity = {
  id: number;
  slug: string;
  path: string;
  status: string;
};

/**
 * Projects public dependency truth from the existing route, Page Composition,
 * template-publication and Page-publication owners. It persists no registry.
 */
export async function verifyPublicPagePublicationDependencies(
  page: PageIdentity,
  nextStatus: "published" | "unpublished",
): Promise<PublicPagePublicationDependencyResult> {
  if (
    page.slug !== SEARCH_PLATFORM_PUBLIC_ROUTE.cmsPageSlug ||
    page.path !== SEARCH_PLATFORM_PUBLIC_ROUTE.href
  ) {
    return { ok: true, dependency: null };
  }

  const supabase = getSupabaseAdmin();
  const { data: templates, error: templateError } = await supabase
    .from("content_block_templates")
    .select("id,slug,variant,status")
    .eq("variant", SEARCH_PLATFORM_TEMPLATE_SLUG);
  if (templateError) {
    return {
      ok: false,
      code: "dependency_read_failed",
      message: "تعذر التحقق من اعتمادات النشر العامة. لم يتم تغيير حالة الصفحة.",
    };
  }

  const templateRows = templates ?? [];
  const destinationTemplate = templateRows.find(
    (template) => template.slug === SEARCH_PLATFORM_TEMPLATE_SLUG,
  );
  const launcherTemplates = templateRows.filter((template) =>
    isSearchPlatformLauncherTemplate(template.slug, template.variant),
  );
  const templateIds = templateRows.map((template) => template.id);
  const { data: assignments, error: assignmentError } = templateIds.length
    ? await supabase
        .from("page_content_block_assignments")
        .select("page_id,template_id,is_visible")
        .in("template_id", templateIds)
    : { data: [], error: null };
  if (assignmentError) {
    return {
      ok: false,
      code: "dependency_read_failed",
      message: "تعذر التحقق من اعتمادات النشر العامة. لم يتم تغيير حالة الصفحة.",
    };
  }

  const assignmentRows = assignments ?? [];
  const launcherTemplateIds = new Set(
    launcherTemplates
      .filter((template) => template.status === "published")
      .map((template) => template.id),
  );
  const visibleLauncherAssignments = assignmentRows.filter(
    (assignment) =>
      assignment.is_visible && launcherTemplateIds.has(assignment.template_id),
  );
  const launcherPageIds = [
    ...new Set(visibleLauncherAssignments.map((assignment) => assignment.page_id)),
  ];
  const { data: launcherPages, error: launcherPageError } = launcherPageIds.length
    ? await supabase
        .from("pages")
        .select("id,status")
        .in("id", launcherPageIds)
    : { data: [], error: null };
  if (launcherPageError) {
    return {
      ok: false,
      code: "dependency_read_failed",
      message: "تعذر التحقق من اعتمادات النشر العامة. لم يتم تغيير حالة الصفحة.",
    };
  }

  const publishedLauncherPageIds = new Set(
    (launcherPages ?? [])
      .filter((launcherPage) => launcherPage.status === "published")
      .map((launcherPage) => launcherPage.id),
  );
  const activeLauncherCount = visibleLauncherAssignments.filter((assignment) =>
    publishedLauncherPageIds.has(assignment.page_id),
  ).length;

  if (activeLauncherCount === 0) {
    return {
      ok: true,
      dependency: {
        key: "search-platform",
        destinationPath: SEARCH_PLATFORM_PUBLIC_ROUTE.href,
        activeLauncherCount,
      },
    };
  }

  const destinationAssignmentVisible = Boolean(
    destinationTemplate && assignmentRows.some(
      (assignment) =>
        assignment.page_id === page.id &&
        assignment.template_id === destinationTemplate.id &&
        assignment.is_visible,
    ),
  );
  const destinationTemplatePublished =
    destinationTemplate?.status === "published";
  const destinationWillBePublished = nextStatus === "published";

  if (
    !destinationWillBePublished ||
    !destinationAssignmentVisible ||
    !destinationTemplatePublished
  ) {
    return {
      ok: false,
      code: "dependency_invariant_broken",
      message:
        "لا يمكن إلغاء نشر الصفحة لأنها مستخدمة بواسطة اعتمادات عامة منشورة ومرئية. عالج هذه الاعتمادات أولًا، أو تأكد من نشر صفحة الوجهة وتعيينها وقالبها.",
    };
  }

  return {
    ok: true,
    dependency: {
      key: "search-platform",
      destinationPath: SEARCH_PLATFORM_PUBLIC_ROUTE.href,
      activeLauncherCount,
    },
  };
}
