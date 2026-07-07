import MediaPageShell from "../../../../components/media-center/MediaPageShell";
import FeaturedNews from "../../../../components/media-center/FeaturedNews";
import MediaCenterShellLayout from "../../../../components/media-center/MediaCenterShellLayout";
import MediaListingContent from "../../../../components/media-center/MediaListingContent";
import { getMediaItems } from "../../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";

export const revalidate = 300;
export const metadata = buildMetadata({ path: "/media-center/news" });

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
    getMediaItems("news"),
    loadMediaCenterSidebarProps("media-center-news"),
  ]);
  const featuredNews = items.find((item) => item.featured) ?? items[0] ?? null;
  const regularItems = featuredNews ? items.filter((item) => item.slug !== featuredNews.slug) : items;

  return (
    <MediaCenterShellLayout cmsPageSlug="media-center-news">
      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
        <MediaListingContent
          items={regularItems}
          currentPage={currentPage}
          sort={sort}
          basePath="/media-center/news"
          title="أخبار فينيسيا"
          eyebrow="Latest Update"
          description="متابعة مستمرة لأحدث أخبار الشركة ومراحل التنفيذ والتطورات المرتبطة بمشروعات فينيسيا."
          emptyTitle="لا توجد أخبار متاحة حاليًا"
          emptyDescription="عند إضافة أخبار جديدة، ستظهر هنا تلقائيًا بنفس تنسيق المركز الإعلامي."
          actionLabel="قراءة الخبر"
          itemsLabel="أخبار"
        >
          {featuredNews ? <FeaturedNews item={featuredNews} /> : null}
        </MediaListingContent>
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
