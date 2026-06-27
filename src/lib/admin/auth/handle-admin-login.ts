import { NextResponse } from "next/server";

import { AUDIT_ACTIONS } from "../audit/audit-actions";
import { recordAdminAuditEvent } from "../audit/record-admin-audit-event";
import { resolveRequestAuditContext } from "../audit/resolve-request-audit-context";
import { authenticateAdminUser, hasAnyAdminUser } from "./admin-users";
import { createAdminSessionCookie } from "./require-admin-api";
import { getAdminAuthConfig } from "./session";

export async function handleAdminLoginRequest(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string; rememberMe?: boolean };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const rememberMe = body.rememberMe === true;
  const auditContext = resolveRequestAuditContext(request);

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const config = getAdminAuthConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error:
          "Admin auth is not configured on the server. Set ADMIN_SESSION_SECRET (16+ chars), then redeploy/restart.",
      },
      { status: 503 },
    );
  }

  if (!(await hasAnyAdminUser())) {
    return NextResponse.json(
      {
        error:
          "No admin users exist. Apply the admin_users migration/seed on Supabase before logging in.",
      },
      { status: 503 },
    );
  }

  const user = await authenticateAdminUser(username, password);
  if (!user) {
    await recordAdminAuditEvent({
      actorUsername: username,
      action: AUDIT_ACTIONS.authLoginFailed,
      entityType: "auth",
      entityLabel: username,
      metadata: { reason: "invalid_credentials" },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  await recordAdminAuditEvent({
    actorAdminUserId: user.id,
    actorUsername: user.username,
    action: AUDIT_ACTIONS.authLoginSuccess,
    entityType: "admin_user",
    entityId: user.id,
    entityLabel: user.username,
    metadata: { rememberMe },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    createAdminSessionCookie(
      {
        id: user.id,
        username: user.username,
        sessionVersion: user.session_version,
      },
      request,
      { rememberMe },
    ),
  );
  return response;
}
