import MediaPageShell from "../../../../components/media-center/MediaPageShell";
import MediaCenterShellLayout from "../../../../components/media-center/MediaCenterShellLayout";
import MediaListingContent from "../../../../components/media-center/MediaListingContent";
import { getMediaItems } from "../../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/media-center/site-updates" });

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    sort?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const rawPage = Number(params?.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const [items, sidebarProps] = await Promise.all([
    getMediaItems("site-update"),
    loadMediaCenterSidebarProps("media-center-site-updates"),
  ]);

  return (
    <MediaCenterShellLayout cmsPageSlug="media-center-site-updates">
      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
        <MediaListingContent
          items={items}
          currentPage={currentPage}
          sort={sort}
          basePath="/media-center/site-updates"
          title="تحديثات مواقع فينيسيا"
          eyebrow="Site Updates"
          description="توثيق مستمر لحركة التنفيذ على الأرض، من مراحل الخرسانة إلى التشطيبات والتسليم."
          emptyTitle="لا توجد تحديثات متاحة حاليًا"
          emptyDescription="عند إضافة تحديثات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي."
          actionLabel="عرض التحديث"
          itemsLabel="تحديثات"
        />
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
