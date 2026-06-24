import { NextResponse } from "next/server";

import { listPublicImagePaths } from "../../../../lib/admin/media-library";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "images";

  if (folder.includes("..") || folder.startsWith("/")) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  const paths = await listPublicImagePaths(folder);
  return NextResponse.json({ paths });
}
