import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
} from "../../../../lib/admin/media-catalog/catalog";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "../../../../lib/admin/media-catalog/reference-providers";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const assetValue = String(searchParams.get("asset") || "").trim();
    if (!assetValue) {
      return NextResponse.json({ error: "أدخل مسار الملف أو رابطه." }, { status: 400, headers });
    }
    const [asset, state] = await Promise.all([
      getCatalogAssetByPublicValue(assetValue),
      getMediaCatalogRuntimeState(),
    ]);
    if (!asset) {
      return NextResponse.json(
        { error: "الأصل غير مسجل داخل Media Catalog.", code: "media_asset_missing_from_catalog" },
        { status: 409, headers },
      );
    }
    const references = await listCatalogReferences(asset.id);
    const authoritative =
      state.state === "synced" && state.providerRegistryVersion === MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION;
    return NextResponse.json(
      {
        asset,
        hits: references.map((reference) => ({
          entityType: reference.entityType,
          entityLabel: reference.entityLabel ?? `${reference.entityType} #${reference.entityIdentity}`,
          field: reference.fieldKey,
          editHref: reference.editHref,
          referenceState: reference.referenceState,
        })),
        count: references.length,
        authoritative,
        warning: authoritative ? null : "مرجع الوسائط يحتاج reconciliation؛ لا يمكن اعتبار الصفر آمنًا للحذف.",
      },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "تعذر إثبات استخدامات الملف؛ تم تصنيف الحالة كغير مؤكدة.",
        code: error instanceof Error ? error.message : "media_usage_uncertain",
      },
      { status: 503, headers },
    );
  }
}
