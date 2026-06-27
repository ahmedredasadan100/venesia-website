import { NextRequest, NextResponse } from "next/server";

import { AUDIT_ACTIONS } from "../../../../../lib/admin/audit/audit-actions";
import { recordAdminAuditEvent } from "../../../../../lib/admin/audit/record-admin-audit-event";
import { resolveRequestAuditContext } from "../../../../../lib/admin/audit/resolve-request-audit-context";
import { invalidateAdminSessionOnLogout, validateAdminSessionPayload } from "../../../../../lib/admin/auth/admin-users";
import { clearAdminSessionCookie } from "../../../../../lib/admin/auth/require-admin-api";
import { ADMIN_SESSION_COOKIE, getAdminAuthConfig, verifyAdminSessionToken } from "../../../../../lib/admin/auth/session";

export async function POST(request: NextRequest) {
  const auditContext = resolveRequestAuditContext(request);
  const config = getAdminAuthConfig();
  if (config.configured) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = verifyAdminSessionToken(token, config.secret);
    if (payload && (await validateAdminSessionPayload(payload))) {
      await invalidateAdminSessionOnLogout(payload.id);
      await recordAdminAuditEvent({
        actorAdminUserId: payload.id,
        actorUsername: payload.u,
        action: AUDIT_ACTIONS.authLogout,
        entityType: "session",
        entityId: payload.id,
        entityLabel: payload.u,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAdminSessionCookie(request));
  return response;
}
