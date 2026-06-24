import MediaPageShell from "../../../components/media-center/MediaPageShell";
import MediaCenterShellLayout from "../../../components/media-center/MediaCenterShellLayout";
import MediaListingContent from "../../../components/media-center/MediaListingContent";
import { getMediaItems } from "../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../lib/seo/build-metadata";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/media-center/press" });

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
    getMediaItems("press"),
    loadMediaCenterSidebarProps("media-center-press"),
  ]);

  return (
    <MediaCenterShellLayout cmsPageSlug="media-center-press">
      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
        <MediaListingContent
          items={items}
          currentPage={currentPage}
          sort={sort}
          basePath="/media-center/press"
          title="بيانات فينيسيا الصحفية"
          eyebrow="Press Releases"
          description="مساحة رسمية للبيانات الصحفية والتغطيات التي توثق تحركات الشركة ومراحل تطورها."
          emptyTitle="لا توجد بيانات صحفية متاحة حاليًا"
          emptyDescription="عند إضافة بيانات جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي."
          actionLabel="قراءة البيان"
          itemsLabel="بيانات"
        />
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
