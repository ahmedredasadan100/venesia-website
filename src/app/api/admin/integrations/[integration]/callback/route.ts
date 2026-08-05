import { NextResponse } from "next/server";

import { getCurrentAdminUserFromCookies } from "../../../../../../lib/admin/auth/admin-users";
import { completeIntegrationAuthorization } from "../../../../../../lib/admin/integrations/connection-service";
import { isLiveIntegrationKey } from "../../../../../../lib/admin/integrations/integrations-contract";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  const { integration } = await context.params;
  if (!isLiveIntegrationKey(integration)) {
    return NextResponse.json({ error: "integration_not_supported" }, { status: 404 });
  }
  const destination = new URL(`/admin/settings/integrations/${integration}`, request.url);
  const user = await getCurrentAdminUserFromCookies();
  if (!user) {
    destination.searchParams.set("error", "oauth_admin_session_missing");
    return NextResponse.redirect(destination);
  }
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code") ?? url.searchParams.get("auth_code");
  const state = url.searchParams.get("state");
  if (providerError || !code || !state) {
    destination.searchParams.set("error", providerError ? "oauth_authorization_denied" : "oauth_callback_invalid");
    return NextResponse.redirect(destination);
  }
  try {
    const connectionId = await completeIntegrationAuthorization({ routeIntegration: integration, code, state, user });
    destination.searchParams.set("connection", connectionId);
    destination.searchParams.set("step", "assets");
  } catch (error) {
    const safeCode = error instanceof Error ? error.message.split(":")[0] : "oauth_callback_failed";
    destination.searchParams.set("error", safeCode);
  }
  return NextResponse.redirect(destination);
}
