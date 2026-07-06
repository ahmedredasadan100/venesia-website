import MediaPageShell from "../../../../components/media-center/MediaPageShell";
import MediaCenterShellLayout from "../../../../components/media-center/MediaCenterShellLayout";
import MediaListingContent from "../../../../components/media-center/MediaListingContent";
import { getMediaItems } from "../../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/media-center/videos" });

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
    getMediaItems("video"),
    loadMediaCenterSidebarProps("media-center-videos"),
  ]);

  return (
    <MediaCenterShellLayout cmsPageSlug="media-center-videos">
      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
        <MediaListingContent
          items={items}
          currentPage={currentPage}
          sort={sort}
          basePath="/media-center/videos"
          title="فيديوهات فينيسيا"
          eyebrow="Venesia Videos"
          description="توثيق مرئي من أرض التنفيذ، جولات ميدانية، ولقطات تشرح مراحل العمل كما تحدث على الواقع."
          emptyTitle="لا توجد فيديوهات متاحة حاليًا"
          emptyDescription="عند إضافة فيديوهات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي."
          actionLabel="مشاهدة الفيديو"
          itemsLabel="فيديوهات"
        />
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
