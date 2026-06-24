import MediaItemsAdminPage, { type MediaAdminSearchParams } from "./_components/MediaItemsAdminPage";

export const dynamic = "force-dynamic";

export default async function AdminMediaCenterPage({
  searchParams,
}: {
  searchParams?: Promise<MediaAdminSearchParams>;
}) {
  const params = await searchParams;
  return <MediaItemsAdminPage searchParams={params} />;
}
