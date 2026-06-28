import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import { listPublicImagePaths } from "../../../../lib/admin/list-public-image-paths";

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "images";

  if (folder.includes("..") || folder.startsWith("/")) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  const paths = await listPublicImagePaths(folder);
  return NextResponse.json({ paths });
}
