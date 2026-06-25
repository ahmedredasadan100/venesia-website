import { NextResponse } from "next/server";
import { exportCmsBackup } from "../../../../../lib/export/export-cms-backup";
import { requireAdminApi } from "../../../../../lib/admin/auth/require-admin-api";
import { logError } from "../../../../../lib/logging";

export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const backup = await exportCmsBackup();
    const filename = `venesia-cms-backup-${backup.exported_at.slice(0, 10)}.json`;
    const body = JSON.stringify(backup, null, 2);

    return new NextResponse(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError("CMS backup export failed", error);
    return NextResponse.json({ error: "Failed to export CMS backup" }, { status: 500 });
  }
}
