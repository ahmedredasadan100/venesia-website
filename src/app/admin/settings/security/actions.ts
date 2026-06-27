"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { AUDIT_ACTIONS } from "../../../../lib/admin/audit/audit-actions";
import { recordAdminAuditEvent } from "../../../../lib/admin/audit/record-admin-audit-event";
import { resolveServerActionAuditContext } from "../../../../lib/admin/audit/resolve-server-action-audit-context";
import {
  revokeAllAdminUserSessions,
  updateAdminUserEmail,
  updateAdminUserFullName,
  updateAdminUserPassword,
  verifyAdminUserPassword,
} from "../../../../lib/admin/auth/admin-users";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { createAdminSessionCookie, clearAdminSessionCookie } from "../../../../lib/admin/auth/require-admin-api";
import {
  AdminSelfAccountValidationError,
  hasAdminSelfAccountFieldErrors,
  normalizeAdminEmail,
  normalizeAdminFullName,
  validateAdminSelfAccountForm,
  type AdminSelfAccountFieldErrors,
} from "../../../../lib/admin/users/admin-users-validation";

export type UpdateAdminSelfAccountResult =
  | { success: true; email: string; fullName: string | null }
  | { success: false; fieldErrors: AdminSelfAccountFieldErrors };

async function verifyCurrentPassword(userId: number, currentPassword: string) {
  const valid = await verifyAdminUserPassword(userId, currentPassword);
  if (!valid) {
    throw new Error("كلمة المرور الحالية غير صحيحة.");
  }
}

export async function changeAdminPasswordAction(currentPassword: string, newPassword: string) {
  const user = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  await verifyCurrentPassword(user.id, currentPassword);

  if (newPassword.length < 6) {
    throw new Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
  }

  await updateAdminUserPassword(user.id, newPassword);

  await recordAdminAuditEvent({
    actorAdminUserId: user.id,
    actorUsername: user.username,
    action: AUDIT_ACTIONS.authPasswordChanged,
    entityType: "admin_user",
    entityId: user.id,
    entityLabel: user.username,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    createAdminSessionCookie({
      id: user.id,
      username: user.username,
      sessionVersion: user.session_version + 1,
    }),
  );

  revalidatePath("/admin/settings/security");
}

export async function updateAdminSelfAccountAction(input: {
  full_name: string;
  email: string;
  currentPassword: string;
}): Promise<UpdateAdminSelfAccountResult> {
  const user = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();

  const fieldErrors = validateAdminSelfAccountForm({
    ...input,
    originalEmail: user.email,
  });
  if (hasAdminSelfAccountFieldErrors(fieldErrors)) {
    return { success: false, fieldErrors };
  }

  const normalizedFullName = normalizeAdminFullName(input.full_name);
  const normalizedEmail = normalizeAdminEmail(input.email);
  const emailChanged = normalizedEmail !== normalizeAdminEmail(user.email);
  const fullNameChanged = (normalizedFullName ?? "") !== (user.full_name ?? "");

  if (!emailChanged && !fullNameChanged) {
    return { success: true, email: user.email, fullName: user.full_name };
  }

  try {
    if (emailChanged) {
      const valid = await verifyAdminUserPassword(user.id, input.currentPassword);
      if (!valid) {
        return { success: false, fieldErrors: { currentPassword: "كلمة المرور الحالية غير صحيحة" } };
      }
    }

    if (fullNameChanged) {
      await updateAdminUserFullName(user.id, normalizedFullName);
    }

    if (emailChanged) {
      const previousEmail = user.email;
      await updateAdminUserEmail(user.id, normalizedEmail);

      await recordAdminAuditEvent({
        actorAdminUserId: user.id,
        actorUsername: user.username,
        action: AUDIT_ACTIONS.authEmailChanged,
        entityType: "admin_user",
        entityId: user.id,
        entityLabel: user.username,
        metadata: { email: { from: previousEmail, to: normalizedEmail } },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      });
    } else if (fullNameChanged) {
      await recordAdminAuditEvent({
        actorAdminUserId: user.id,
        actorUsername: user.username,
        action: AUDIT_ACTIONS.adminUserUpdated,
        entityType: "admin_user",
        entityId: user.id,
        entityLabel: user.username,
        metadata: { full_name: { from: user.full_name, to: normalizedFullName } },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      });
    }

    revalidatePath("/admin/settings/security");
    return {
      success: true,
      email: emailChanged ? normalizedEmail : user.email,
      fullName: fullNameChanged ? normalizedFullName : user.full_name,
    };
  } catch (error) {
    if (error instanceof AdminSelfAccountValidationError) {
      return { success: false, fieldErrors: error.fieldErrors };
    }
    throw error;
  }
}

export async function changeAdminEmailAction(currentPassword: string, newEmail: string) {
  const user = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  await verifyCurrentPassword(user.id, currentPassword);

  const normalized = newEmail.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("أدخل بريدًا إلكترونيًا صالحًا.");
  }

  const previousEmail = user.email;
  await updateAdminUserEmail(user.id, normalized);

  await recordAdminAuditEvent({
    actorAdminUserId: user.id,
    actorUsername: user.username,
    action: AUDIT_ACTIONS.authEmailChanged,
    entityType: "admin_user",
    entityId: user.id,
    entityLabel: user.username,
    metadata: { email: { from: previousEmail, to: normalized } },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  revalidatePath("/admin/settings/security");
}

export async function revokeAllAdminSessionsAction(currentPassword: string) {
  const user = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  await verifyCurrentPassword(user.id, currentPassword);

  await revokeAllAdminUserSessions(user.id);

  await recordAdminAuditEvent({
    actorAdminUserId: user.id,
    actorUsername: user.username,
    action: AUDIT_ACTIONS.authSessionsRevoked,
    entityType: "session",
    entityId: user.id,
    entityLabel: user.username,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(clearAdminSessionCookie());
}
