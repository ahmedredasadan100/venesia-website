import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listMediaCatalogSnapshot,
} from "../../../../lib/admin/media-catalog/catalog";
import {
  buildMediaCatalogReadiness,
  getMediaReadinessReasonLabel,
} from "../../../../lib/admin/media-catalog/readiness";
import {
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanMediaUsageByPublicValue,
} from "../../../../lib/admin/media-catalog/reference-providers";
import {
  listPublicMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../../../../lib/admin/media-library";

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
    const unknownQueryKey = [...searchParams.keys()].find((key) => key !== "asset");
    if (unknownQueryKey) {
      return NextResponse.json(
        { error: `معامل البحث غير مدعوم: ${unknownQueryKey}`, code: "invalid_media_usage_query" },
        { status: 400, headers },
      );
    }
    const assetValue = String(searchParams.get("asset") || "").trim();
    if (!assetValue) {
      return NextResponse.json({ error: "أدخل مسار الملف أو رابطه." }, { status: 400, headers });
    }
    if (assetValue.length > 2_048) {
      return NextResponse.json(
        { error: "مسار الملف أطول من الحد المسموح.", code: "invalid_media_asset_value" },
        { status: 400, headers },
      );
    }
    const context = resolveMediaStorageRuntimeContext();
    const [asset, state, live, catalog, inventory] = await Promise.all([
      getCatalogAssetByPublicValue(assetValue).catch(() => null),
      getMediaCatalogRuntimeState().catch(() => null),
      scanMediaUsageByPublicValue(assetValue),
      listMediaCatalogSnapshot(),
      listPublicMediaInventory(),
    ]);
    const readiness = buildMediaCatalogReadiness(
      catalog,
      inventory,
      state,
      context,
      MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    );
    const catalogRegistered = Boolean(
      asset &&
        asset.catalogRegistered &&
        asset.provider === context.provider &&
        asset.reconciliationState === "synced" &&
        !asset.missingObject,
    );
    const scanComplete = live.uncertainties.length === 0;
    const unusedAuthoritative =
      catalogRegistered &&
      scanComplete &&
      readiness.usageResultsAuthoritative;
    const warning = !scanComplete
      ? "تعذر فحص بعض مواضع الاستخدام. النتائج الظاهرة صحيحة، لكن قد توجد استخدامات أخرى."
      : !catalogRegistered
        ? "يمكن عرض الارتباطات المكتشفة، لكن لا يمكن إعلان هذا الملف غير مستخدم لأنه غير جاهز داخل مكتبة الوسائط."
      : !unusedAuthoritative
        ? getMediaReadinessReasonLabel(readiness.reasons[0] ?? "provider_scan_uncertain")
        : null;
    return NextResponse.json(
      {
        asset,
        catalogRegistered,
        hits: live.references.map((reference) => ({
          domainKey: reference.domainKey,
          entityType: reference.entityType,
          entityIdentity: reference.entityIdentity,
          entityLabel: reference.entityLabel ?? `${reference.entityType} #${reference.entityIdentity}`,
          field: reference.fieldKey,
          publicValue: reference.publicValue,
          editHref: reference.editHref,
          referenceState: reference.referenceState,
        })),
        count: live.references.length,
        authoritative: scanComplete && readiness.usageResultsAuthoritative,
        scanComplete,
        unusedAuthoritative,
        readiness,
        warning,
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
