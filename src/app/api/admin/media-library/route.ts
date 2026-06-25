import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import {
  listPublicMediaFolder,
  normalizeMediaFolder,
  savePublicDocumentUpload,
  savePublicMediaUpload,
} from "../../../../lib/admin/media-library";

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const folder = normalizeMediaFolder(searchParams.get("folder") || "images");
    const listing = await listPublicMediaFolder(folder);
    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load media folder." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = normalizeMediaFolder(String(formData.get("folder") || "images"));

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const kind = String(formData.get("kind") || "image");
    const saved =
      kind === "pdf" ? await savePublicDocumentUpload(folder, file) : await savePublicMediaUpload(folder, file);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
