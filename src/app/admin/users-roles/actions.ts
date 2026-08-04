"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS } from "../../../lib/admin/audit/audit-actions";
import { recordAdminAuditEvent } from "../../../lib/admin/audit/record-admin-audit-event";
import { resolveServerActionAuditContext } from "../../../lib/admin/audit/resolve-server-action-audit-context";
import { getAdminUserById } from "../../../lib/admin/auth/admin-users";
import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";
import {
  adminResetUserPassword,
  createAdminUser,
  deleteAdminUser,
  setAdminUserActiveStatus,
  updateAdminUserProfile,
  type AdminUserListItem,
} from "../../../lib/admin/users/admin-users-management";
import type { AdminFormActionState } from "../../../lib/admin/form-runtime";
import { saveAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";
import {
  AdminUserCreateValidationError,
  normalizeAdminFullName,
  validateAdminEmail,
  validateAdminFullName,
  validateAdminOptionalPasswordFields,
  validateAdminUsername,
  type AdminUserCreateFieldErrors,
} from "../../../lib/admin/users/admin-users-validation";
import {
  getAdminUsersDefaultColumnKeys,
  getAdminUsersPreferenceColumnKeys,
  ADMIN_USERS_LIST_VIEW_KEY,
  type AdminUserColumnKey,
} from "../../../lib/admin/users/list-config";

export type CreateAdminUserActionResult =
  | { success: true; user: AdminUserListItem }
  | { success: false; fieldErrors: AdminUserCreateFieldErrors };

function buildProfileChangeMetadata(
  before: { username: string; email: string; full_name: string | null; is_active: boolean },
  after: { username: string; email: string; full_name: string | null; is_active: boolean },
) {
  const metadata: Record<string, unknown> = {};
  if (before.username !== after.username) {
    metadata.username = { from: before.username, to: after.username };
  }
  if (before.email !== after.email) {
    metadata.email = { from: before.email, to: after.email };
  }
  if ((before.full_name ?? "") !== (after.full_name ?? "")) {
    metadata.full_name = { from: before.full_name, to: after.full_name };
  }
  if (before.username !== after.username || before.email !== after.email) {
    metadata.sessions_invalidated = true;
  }
  return metadata;
}

export async function createAdminUserAction(input: {
  username: string;
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
}): Promise<CreateAdminUserActionResult> {
  const actor = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();

  try {
    const user = await createAdminUser(input);

    await recordAdminAuditEvent({
      actorAdminUserId: actor.id,
      actorUsername: actor.username,
      action: AUDIT_ACTIONS.adminUserCreated,
      entityType: "admin_user",
      entityId: user.id,
      entityLabel: user.username,
      metadata: { username: user.username, email: user.email, role: user.role },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    revalidatePath("/admin/users-roles");
    return { success: true, user };
  } catch (error) {
    if (error instanceof AdminUserCreateValidationError) {
      return { success: false, fieldErrors: error.fieldErrors };
    }
    throw error;
  }
}

function readFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readFormBoolean(formData: FormData, name: string) {
  const values = formData.getAll(name);
  return values.at(-1) === "true";
}

function mapFieldErrors(
  errors: Record<string, string | undefined>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([field, message]) => [field, [message]]),
  );
}

function formError<TResult>(
  previousState: AdminFormActionState<TResult>,
  mode: "create" | "edit",
  input: {
    title?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
    focusTarget?: string;
  },
): AdminFormActionState<TResult> {
  return {
    status: "error",
    mode,
    revision: previousState.revision + 1,
    title: input.title,
    message: input.message,
    fieldErrors: input.fieldErrors,
    focusTarget: input.focusTarget,
  };
}

export async function createAdminUserFormAction(
  previousState: AdminFormActionState<AdminUserListItem>,
  formData: FormData,
): Promise<AdminFormActionState<AdminUserListItem>> {
  try {
    const result = await createAdminUserAction({
      username: readFormString(formData, "username"),
      email: readFormString(formData, "email"),
      full_name: readFormString(formData, "full_name"),
      password: readFormString(formData, "password"),
      confirmPassword: readFormString(formData, "confirmPassword"),
    });

    if (!result.success) {
      const fieldErrors = mapFieldErrors(result.fieldErrors);
      return formError(previousState, "create", {
        fieldErrors,
        focusTarget: Object.keys(fieldErrors)[0],
      });
    }

    return {
      status: "success",
      mode: "create",
      revision: previousState.revision + 1,
      title: "تم إنشاء المستخدم",
      message: `تم إنشاء المستخدم «${result.user.username}».`,
      entityId: result.user.id,
      savedRevision: result.user.updated_at,
      result: result.user,
    };
  } catch (error) {
    return formError(previousState, "create", {
      title: "تعذر إنشاء المستخدم",
      message:
        error instanceof Error ? error.message : "تعذر إنشاء المستخدم.",
    });
  }
}

export async function updateAdminUserFormAction(
  previousState: AdminFormActionState<AdminUserListItem>,
  formData: FormData,
): Promise<AdminFormActionState<AdminUserListItem>> {
  await requireAdminSession();
  const id = Number(readFormString(formData, "id"));
  const username = readFormString(formData, "username");
  const email = readFormString(formData, "email");
  const fullName = readFormString(formData, "full_name");
  const password = readFormString(formData, "password");
  const confirmPassword = readFormString(formData, "confirmPassword");

  if (!Number.isInteger(id) || id <= 0) {
    return formError(previousState, "edit", {
      title: "تعذر تحديث المستخدم",
      message: "معرّف المستخدم غير صالح. حدّث الصفحة وحاول مرة أخرى.",
    });
  }

  const fieldErrors = mapFieldErrors({
    username: validateAdminUsername(username) ?? undefined,
    email: validateAdminEmail(email) ?? undefined,
    full_name:
      validateAdminFullName(normalizeAdminFullName(fullName)) ?? undefined,
    ...validateAdminOptionalPasswordFields(password, confirmPassword),
  });

  if (Object.keys(fieldErrors).length > 0) {
    return formError(previousState, "edit", {
      fieldErrors,
      focusTarget: Object.keys(fieldErrors)[0],
    });
  }

  try {
    const user = await updateAdminUserAction({
      id,
      username,
      email,
      full_name: fullName,
      is_active: readFormBoolean(formData, "is_active"),
      ...(password.trim()
        ? { password, confirmPassword }
        : {}),
    });

    return {
      status: "success",
      mode: "edit",
      revision: previousState.revision + 1,
      title: "تم تحديث المستخدم",
      message: `تم تحديث المستخدم «${user.username}».`,
      entityId: user.id,
      savedRevision: user.updated_at,
      result: user,
    };
  } catch (error) {
    return formError(previousState, "edit", {
      title: "تعذر تحديث المستخدم",
      message:
        error instanceof Error ? error.message : "تعذر تحديث المستخدم.",
    });
  }
}

export async function updateAdminUserAction(input: {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  password?: string;
  confirmPassword?: string;
}) {
  const actor = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();

  if (input.id === actor.id && !input.is_active) {
    throw new Error("لا يمكنك تعطيل حسابك الحالي.");
  }

  const before = await getAdminUserById(input.id);
  if (!before) throw new Error("المستخدم غير موجود.");

  const user = await updateAdminUserProfile(input.id, {
    username: input.username,
    email: input.email,
    full_name: input.full_name,
    is_active: input.is_active,
  });

  const profileChanged =
    before.username !== user.username ||
    before.email !== user.email ||
    (before.full_name ?? "") !== (user.full_name ?? "");
  const activeChanged = before.is_active !== user.is_active;

  if (activeChanged) {
    await recordAdminAuditEvent({
      actorAdminUserId: actor.id,
      actorUsername: actor.username,
      action: user.is_active ? AUDIT_ACTIONS.adminUserActivated : AUDIT_ACTIONS.adminUserDeactivated,
      entityType: "admin_user",
      entityId: user.id,
      entityLabel: user.username,
      metadata: { username: user.username, sessions_invalidated: !user.is_active },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });
  }

  if (profileChanged) {
    await recordAdminAuditEvent({
      actorAdminUserId: actor.id,
      actorUsername: actor.username,
      action: AUDIT_ACTIONS.adminUserUpdated,
      entityType: "admin_user",
      entityId: user.id,
      entityLabel: user.username,
      metadata: buildProfileChangeMetadata(before, user),
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });
  }

  if (input.password?.trim()) {
    await adminResetUserPassword(input.id, actor.id, input.password, input.confirmPassword ?? "");

    await recordAdminAuditEvent({
      actorAdminUserId: actor.id,
      actorUsername: actor.username,
      action: AUDIT_ACTIONS.adminUserPasswordReset,
      entityType: "admin_user",
      entityId: user.id,
      entityLabel: user.username,
      metadata: { target_username: user.username, sessions_invalidated: true, via: "user_edit" },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });
  }

  revalidatePath("/admin/users-roles");
  return user;
}

export async function deleteAdminUserAction(userId: number) {
  const actor = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  const deleted = await deleteAdminUser(userId, actor.id);

  await recordAdminAuditEvent({
    actorAdminUserId: actor.id,
    actorUsername: actor.username,
    action: AUDIT_ACTIONS.adminUserDeleted,
    entityType: "admin_user",
    entityId: deleted.id,
    entityLabel: deleted.username,
    metadata: { username: deleted.username, email: deleted.email },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  revalidatePath("/admin/users-roles");
  return deleted;
}

export async function setAdminUserActiveAction(userId: number, isActive: boolean) {
  const actor = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  const user = await setAdminUserActiveStatus(userId, isActive, actor.id);

  await recordAdminAuditEvent({
    actorAdminUserId: actor.id,
    actorUsername: actor.username,
    action: isActive ? AUDIT_ACTIONS.adminUserActivated : AUDIT_ACTIONS.adminUserDeactivated,
    entityType: "admin_user",
    entityId: user.id,
    entityLabel: user.username,
    metadata: { username: user.username, sessions_invalidated: !isActive },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  revalidatePath("/admin/users-roles");
  return user;
}

export async function setAdminUserPasswordAction(input: {
  userId: number;
  password: string;
  confirmPassword: string;
}) {
  const actor = await requireAdminSession();
  const auditContext = await resolveServerActionAuditContext();
  const user = await adminResetUserPassword(
    input.userId,
    actor.id,
    input.password,
    input.confirmPassword,
  );

  await recordAdminAuditEvent({
    actorAdminUserId: actor.id,
    actorUsername: actor.username,
    action: AUDIT_ACTIONS.adminUserPasswordReset,
    entityType: "admin_user",
    entityId: user.id,
    entityLabel: user.username,
    metadata: { target_username: user.username, sessions_invalidated: true },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  revalidatePath("/admin/users-roles");
  return user;
}

export async function saveAdminUsersTablePreferences(
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: ADMIN_USERS_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: getAdminUsersPreferenceColumnKeys(),
  });
}

export async function restoreAdminUsersTablePreferences() {
  return saveAdminUsersTablePreferences([
    ...getAdminUsersDefaultColumnKeys(),
  ] as AdminUserColumnKey[]);
}
