import MediaDetailPage from "../../../../../components/media-center/MediaDetailPage";
import { generateMediaDetailMetadata } from "../../../../../lib/media-center/generate-media-detail-metadata";

export const revalidate = 300;

type DetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateMetadata(props: DetailsPageProps) {
  return generateMediaDetailMetadata("videos", props);
}

export default async function DetailsPage({ params }: DetailsPageProps) {
  const { slug } = await params;
  return <MediaDetailPage configKey="videos" slug={slug} />;
}
