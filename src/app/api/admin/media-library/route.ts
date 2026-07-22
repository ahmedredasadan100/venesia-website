import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import {
  deletePublicMediaAsset,
  getPublicMediaStorageError,
  isManagedPublicMediaAsset,
  listPublicMediaFolder,
  normalizeMediaFolder,
  savePublicDocumentUpload,
  savePublicMediaUpload,
} from "../../../../lib/admin/media-library";
import { scanMediaAssetUsage } from "../../../../lib/admin/media-intelligence/scan-media-usage";
import {
  resolveCmsUploadKind,
  validateCmsUploadFile,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const folder = normalizeMediaFolder(searchParams.get("folder") || "images");
    const listing = await listPublicMediaFolder(folder);
    return NextResponse.json(listing);
  } catch (error) {
    const publicError = getPublicMediaStorageError(
      error,
      "تعذر تحميل مكتبة الوسائط من التخزين الدائم.",
      500,
    );
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: publicError.status },
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
      return NextResponse.json({ error: "لم يتم اختيار ملف للرفع." }, { status: 400 });
    }

    const kind = String(formData.get("kind") || "image");
    const uploadKind = resolveCmsUploadKind(file.name, file.type, kind);
    const validation = validateCmsUploadFile(file, uploadKind);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const replacePath = String(formData.get("replacePath") || "").trim() || null;
    const saved =
      uploadKind === "pdf"
        ? await savePublicDocumentUpload(folder, file, { replacePath })
        : await savePublicMediaUpload(folder, file, { replacePath });
    return NextResponse.json(saved);
  } catch (error) {
    const publicError = getPublicMediaStorageError(
      error,
      "تعذر رفع الملف إلى التخزين الدائم.",
      500,
    );
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: publicError.status },
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { asset?: unknown };
    const asset = typeof body.asset === "string" ? body.asset.trim() : "";
    if (!asset) {
      return NextResponse.json(
        { error: "حدد رابط الملف المطلوب حذفه." },
        { status: 400 },
      );
    }

    if (!(await isManagedPublicMediaAsset(asset))) {
      return NextResponse.json(
        { error: "لا يمكن حذف هذا الملف لأنه ليس أصلًا مُدارًا داخل التخزين الدائم." },
        { status: 400 },
      );
    }

    const hits = await scanMediaAssetUsage(asset);
    if (hits.length > 0) {
      return NextResponse.json(
        {
          error: "لا يمكن حذف الملف قبل إزالة استخداماته الحالية.",
          code: "media_asset_in_use",
          usageCount: hits.length,
        },
        { status: 409 },
      );
    }

    const deleted = await deletePublicMediaAsset(asset);
    return NextResponse.json({ deleted: true, ...deleted });
  } catch (error) {
    const publicError = getPublicMediaStorageError(
      error,
      "تعذر حذف الملف من التخزين الدائم.",
      500,
    );
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: publicError.status },
    );
  }
}
