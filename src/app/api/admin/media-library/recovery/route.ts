import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../../lib/admin/auth/require-admin-api";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import {
  executeMediaRecoveryAction,
  listMediaRecoveryQueue,
  MediaRecoveryError,
} from "../../../../../lib/admin/media-catalog/recovery";
import {
  isMediaRecoveryAction,
  type MediaRecoveryTargetKind,
} from "../../../../../lib/admin/media-catalog/recovery-contract";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
};
const TARGET_KINDS = new Set<MediaRecoveryTargetKind>([
  "delete_reservation",
  "asset",
  "write_lease",
]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET() {
  const authError = await requireAdminApi();
  if (authError) return authError;
  try {
    return json(await listMediaRecoveryQueue());
  } catch (error) {
    const recoveryError = error instanceof MediaRecoveryError ? error : null;
    return json(
      {
        error: recoveryError?.message ?? "تعذر تحميل حالات الميديا التي تحتاج مراجعة.",
        code: recoveryError?.code ?? "media_recovery_queue_failed",
      },
      recoveryError?.status ?? 503,
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;
  const actor = await requireAdminSession();
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ error: "بيانات الإجراء غير صالحة.", code: "invalid_media_recovery_request" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "بيانات الإجراء غير صالحة.", code: "invalid_media_recovery_request" }, 400);
  }
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "action" && key !== "target")) {
    return json({ error: "يحتوي الطلب على حقول غير مدعومة.", code: "invalid_media_recovery_request" }, 400);
  }
  const target = body.target;
  if (
    !isMediaRecoveryAction(body.action)
    || !target
    || typeof target !== "object"
    || Array.isArray(target)
  ) {
    return json({ error: "الإجراء أو الهدف غير صالح.", code: "invalid_media_recovery_request" }, 400);
  }
  const targetRecord = target as Record<string, unknown>;
  if (
    Object.keys(targetRecord).some(
      (key) => key !== "kind" && key !== "id" && key !== "expectedUpdatedAt",
    )
    || typeof targetRecord.kind !== "string"
    || !TARGET_KINDS.has(targetRecord.kind as MediaRecoveryTargetKind)
    || typeof targetRecord.id !== "string"
    || !targetRecord.id.trim()
    || (
      targetRecord.expectedUpdatedAt !== undefined
      && typeof targetRecord.expectedUpdatedAt !== "string"
    )
  ) {
    return json({ error: "هدف الإجراء غير صالح.", code: "invalid_media_recovery_target" }, 400);
  }

  const safeTarget = {
    kind: targetRecord.kind as MediaRecoveryTargetKind,
    id: targetRecord.id.trim(),
    expectedUpdatedAt:
      typeof targetRecord.expectedUpdatedAt === "string"
        ? targetRecord.expectedUpdatedAt
        : undefined,
  };

  const audit = async (outcome: "requested" | "mutated" | "verified" | "blocked", metadata: Record<string, unknown> = {}) =>
    recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("media_asset", "update"),
        entityType: "media_asset",
        entityLabel: "Media recovery",
        metadata: {
          operation: body.action,
          targetKind: safeTarget.kind,
          targetId: safeTarget.id,
          outcome,
          ...metadata,
        },
      },
      actor,
    );

  try {
    await audit("requested");
  } catch {
    return json(
      {
        error: "تعذر تسجيل طلب التعافي في سجل التدقيق؛ لم يتم تنفيذ أي تغيير.",
        code: "media_recovery_audit_unavailable",
      },
      503,
    );
  }

  try {
    const result = await executeMediaRecoveryAction({
      action: body.action,
      target: safeTarget,
    });
    let auditWarning: string | null = null;
    try {
      await audit(result.mutated ? "mutated" : "verified", {
        state: result.state,
        storageState: result.verification?.storageState ?? null,
        persistedReferenceCount: result.verification?.persistedReferenceCount ?? null,
        liveReferenceCount: result.verification?.liveReferenceCount ?? null,
      });
    } catch {
      auditWarning = "تم تسجيل طلب الإجراء وتنفيذه، لكن تعذر تسجيل نتيجته النهائية في سجل التدقيق.";
      console.error("Media recovery outcome audit failed after an audited request", {
        operation: body.action,
        targetKind: safeTarget.kind,
        targetId: safeTarget.id,
      });
    }
    return json({ ok: true, ...result, auditWarning });
  } catch (error) {
    const recoveryError = error instanceof MediaRecoveryError ? error : null;
    let auditWarning: string | null = null;
    try {
      await audit("blocked", {
        failureCode: recoveryError?.code ?? "media_recovery_failed",
      });
    } catch {
      auditWarning = "تم تسجيل طلب الإجراء، لكن تعذر تسجيل نتيجة المنع النهائية في سجل التدقيق.";
      console.error("Media recovery blocked-outcome audit failed after an audited request", {
        operation: body.action,
        targetKind: safeTarget.kind,
        targetId: safeTarget.id,
      });
    }
    return json(
      {
        error: recoveryError?.message ?? "تعذر تنفيذ إجراء التعافي بأمان.",
        code: recoveryError?.code ?? "media_recovery_failed",
        auditWarning,
      },
      recoveryError?.status ?? 503,
    );
  }
}
