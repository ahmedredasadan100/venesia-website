import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import { getPublicMediaStorageError } from "../../../../lib/admin/media-library";
import { listPublicImagePaths } from "../../../../lib/admin/list-public-image-paths";

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "images";
    const paths = await listPublicImagePaths(folder);
    return NextResponse.json({ paths });
  } catch (error) {
    const publicError = getPublicMediaStorageError(
      error,
      "تعذر تحميل مكتبة الصور من التخزين الدائم.",
      500,
    );
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: publicError.status },
    );
  }
}
