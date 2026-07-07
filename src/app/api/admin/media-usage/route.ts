import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import { scanMediaAssetUsage } from "../../../../lib/admin/media-intelligence/scan-media-usage";

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const asset = String(searchParams.get("asset") || "").trim();
    if (!asset) {
      return NextResponse.json({ error: "أدخل مسار الملف أو رابطه." }, { status: 400 });
    }

    const hits = await scanMediaAssetUsage(asset);
    return NextResponse.json({ asset, hits, count: hits.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر فحص استخدام الملف." },
      { status: 400 },
    );
  }
}
