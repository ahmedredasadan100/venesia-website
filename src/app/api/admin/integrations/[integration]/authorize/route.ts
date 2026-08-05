import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../../../lib/admin/auth/require-admin-api";
import { requireAdminSession } from "../../../../../../lib/admin/auth/require-admin-session";
import { beginIntegrationAuthorization } from "../../../../../../lib/admin/integrations/connection-service";
import { isLiveIntegrationKey } from "../../../../../../lib/admin/integrations/integrations-contract";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { integration } = await context.params;
  if (!isLiveIntegrationKey(integration)) {
    return NextResponse.json({ error: "integration_not_supported" }, { status: 404 });
  }
  try {
    const user = await requireAdminSession();
    const authorizationUrl = await beginIntegrationAuthorization(integration, user);
    return NextResponse.redirect(authorizationUrl, { status: 302 });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "integration_authorization_start_failed";
    return NextResponse.redirect(new URL(`/admin/settings/integrations/${integration}?error=${encodeURIComponent(code)}`, _request.url));
  }
}
