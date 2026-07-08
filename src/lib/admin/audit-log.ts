import "server-only";

import type { AdminUserRecord } from "./auth/admin-users";
import { getCurrentAdminUserFromCookies } from "./auth/admin-users";
import type { CmsAuditAction } from "./audit/cms-audit-actions";
import { recordAdminAuditEvent } from "./audit/record-admin-audit-event";
import { resolveServerActionAuditContext } from "./audit/resolve-server-action-audit-context";

export type CmsAdminAuditInput = {
  action: CmsAuditAction;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records a CMS admin audit event after a successful mutation.
 * Non-blocking: failures are caught inside recordAdminAuditEvent.
 */
export async function recordCmsAdminAudit(
  input: CmsAdminAuditInput,
  actor?: AdminUserRecord | null,
): Promise<void> {
  const user = actor ?? (await getCurrentAdminUserFromCookies());
  if (!user) return;

  const auditContext = await resolveServerActionAuditContext();

  await recordAdminAuditEvent({
    actorAdminUserId: user.id,
    actorUsername: user.username,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    metadata: input.metadata,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });
}
