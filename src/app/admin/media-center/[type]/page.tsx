import { notFound } from "next/navigation";
import MediaItemsAdminPage, { type MediaAdminSearchParams } from "../_components/MediaItemsAdminPage";
import { getMediaTypeFromPath } from "../_components/media-admin-config";

export const dynamic = "force-dynamic";

export default async function AdminMediaTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams?: Promise<MediaAdminSearchParams>;
}) {
  const { type } = await params;
  const resolvedType = getMediaTypeFromPath(type);
  if (!resolvedType) notFound();

  const query = await searchParams;
  return <MediaItemsAdminPage activeType={resolvedType} searchParams={query} />;
}
