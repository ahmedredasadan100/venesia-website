import { NextResponse } from "next/server";

import { AUDIT_ACTIONS } from "../audit/audit-actions";
import { recordAdminAuditEvent } from "../audit/record-admin-audit-event";
import { resolveRequestAuditContext } from "../audit/resolve-request-audit-context";
import { logError } from "../../logging";
import {
  AdminAuthDependencyError,
  authenticateAdminUser,
  getAdminUsersDependencyState,
} from "./admin-users";
import { createAdminSessionCookie } from "./require-admin-api";
import { getAdminAuthConfig } from "./session";

function adminAuthErrorResponse(
  code: string,
  error: string,
  status: 500 | 503,
) {
  return NextResponse.json({ code, error }, { status });
}

export function handleUnexpectedAdminLoginError(
  error: unknown,
  route: string,
) {
  logError("Admin login request failed", error, { route });
  return adminAuthErrorResponse(
    "admin_auth_internal_error",
    "Admin login failed.",
    500,
  );
}

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
    logError(
      "Admin login rejected because auth configuration is unavailable",
      new Error("ADMIN_SESSION_SECRET is missing or invalid."),
    );
    return adminAuthErrorResponse(
      "admin_auth_not_configured",
      "Admin authentication is unavailable.",
      503,
    );
  }

  const dependencyState = await getAdminUsersDependencyState();
  if (dependencyState.status === "unavailable") {
    logError(
      "Admin login dependency is unavailable",
      dependencyState.error,
      { operation: dependencyState.error.operation },
    );
    return adminAuthErrorResponse(
      dependencyState.error.code,
      "Admin authentication is temporarily unavailable.",
      503,
    );
  }
  if (dependencyState.status === "empty") {
    return adminAuthErrorResponse(
      "admin_auth_not_initialized",
      "Admin access has not been initialized.",
      503,
    );
  }

  let user;
  try {
    user = await authenticateAdminUser(username, password);
  } catch (error) {
    if (!(error instanceof AdminAuthDependencyError)) throw error;
    logError("Admin login dependency is unavailable", error, {
      operation: error.operation,
    });
    return adminAuthErrorResponse(
      error.code,
      "Admin authentication is temporarily unavailable.",
      503,
    );
  }
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
