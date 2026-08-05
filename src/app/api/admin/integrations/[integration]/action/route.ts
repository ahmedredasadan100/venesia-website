import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "../../../../../../lib/admin/auth/require-admin-api";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import {
  diagnoseIntegration,
  disconnectIntegration,
  discoverIntegrationAssets,
  selectTestAndSyncIntegration,
  syncIntegrationNow,
  testExistingIntegration,
} from "../../../../../../lib/admin/integrations/connection-service";
import { isLiveIntegrationKey } from "../../../../../../lib/admin/integrations/integrations-contract";

export const dynamic = "force-dynamic";

const ActionSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("discover"), connectionId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("select_test_sync"), connectionId: z.string().uuid(), assetIds: z.array(z.string().uuid()).min(1).max(16) }).strict(),
  z.object({ operation: z.literal("test"), connectionId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("sync"), connectionId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("disconnect"), connectionId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("diagnose") }).strict(),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { integration } = await context.params;
  if (!isLiveIntegrationKey(integration)) {
    return NextResponse.json({ error: "integration_not_supported" }, { status: 404 });
  }
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "integration_action_invalid" }, { status: 400 });
  }
  try {
    const user = await requireAdminSession();
    const action = parsed.data;
    let result: unknown;
    if (action.operation === "discover") result = await discoverIntegrationAssets(action.connectionId, integration, user);
    else if (action.operation === "select_test_sync") result = await selectTestAndSyncIntegration({ connectionId: action.connectionId, routeIntegration: integration, assetIds: action.assetIds, user });
    else if (action.operation === "test") result = await testExistingIntegration(action.connectionId, integration, user);
    else if (action.operation === "sync") result = await syncIntegrationNow(action.connectionId, integration, user);
    else if (action.operation === "disconnect") result = await disconnectIntegration(action.connectionId, integration, user);
    else result = await diagnoseIntegration(integration, user);
    return NextResponse.json({ ok: true, result }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "integration_action_failed";
    return NextResponse.json({ ok: false, error: code }, { status: 422, headers: { "cache-control": "private, no-store" } });
  }
}
