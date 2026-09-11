import MediaDetailPage from "../../../../../components/media-center/MediaDetailPage";
import { generateMediaDetailMetadata } from "../../../../../lib/media-center/generate-media-detail-metadata";

export const revalidate = 300;

type DetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(props: DetailsPageProps) {
  return generateMediaDetailMetadata("news", props);
}

export default async function DetailsPage({ params, searchParams }: DetailsPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  return (
    <MediaDetailPage
      configKey="news"
      slug={slug}
      searchParams={resolvedSearchParams}
    />
  );
}
