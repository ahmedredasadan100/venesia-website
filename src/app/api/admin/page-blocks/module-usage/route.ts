import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../../lib/admin/auth/require-admin-api";
import {
  getHeroModuleAssignmentContext,
  getMediaHubModuleAssignmentContext,
  getMediaSidebarModuleAssignmentContext,
  getModuleAssignmentContext,
} from "../../../../../lib/page-blocks/module-assignments-query";
import type { PageBlockType } from "../../../../../lib/page-blocks/types";

export async function GET(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const kind = String(searchParams.get("kind") || "").trim();
    const templateId = Number(searchParams.get("templateId"));

    if (!kind || !Number.isFinite(templateId) || templateId <= 0) {
      return NextResponse.json({ error: "معاملات غير صالحة." }, { status: 400 });
    }

    const context =
      kind === "hero"
        ? await getHeroModuleAssignmentContext(templateId)
        : kind === "media-sidebar"
          ? await getMediaSidebarModuleAssignmentContext(templateId)
          : kind === "media-hub"
            ? await getMediaHubModuleAssignmentContext(templateId)
            : await getModuleAssignmentContext(kind as PageBlockType, templateId);

    return NextResponse.json({
      kind,
      templateId,
      count: context.assignments.length,
      assignments: context.assignments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحميل استخدام الموديول." },
      { status: 400 },
    );
  }
}
