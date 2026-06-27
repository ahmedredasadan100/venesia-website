import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { getAdminUserById, updateAdminUserPassword } from "../auth/admin-users";
import { hashPassword } from "../auth/password";
import {
  AdminUserCreateValidationError,
  hasAdminUserCreateFieldErrors,
  mapUniqueViolationToCreateFieldErrors,
  normalizeAdminEmail,
  normalizeAdminFullName,
  normalizeAdminUsername,
  validateAdminCreateUserForm,
  validateAdminEmail,
  validateAdminFullName,
  validateAdminPasswordPair,
  validateAdminUsername,
} from "./admin-users-validation";

export type AdminUserListItem = {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

const LIST_SELECT =
  "id, email, username, full_name, role, is_active, last_login_at, created_at, updated_at";

function mapListItem(row: Record<string, unknown>): AdminUserListItem {
  return {
    id: Number(row.id),
    email: String(row.email),
    username: String(row.username),
    full_name: row.full_name ? String(row.full_name) : null,
    role: String(row.role ?? "admin"),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique/i.test(error.message ?? "");
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select(LIST_SELECT)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapListItem(row as Record<string, unknown>));
}

export async function countAdminUsers() {
  const { count, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countActiveAdminUsers() {
  const { count, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createAdminUser(input: {
  username: string;
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
}) {
  const fieldErrors = validateAdminCreateUserForm(input);
  if (hasAdminUserCreateFieldErrors(fieldErrors)) {
    throw new AdminUserCreateValidationError(fieldErrors);
  }

  const username = normalizeAdminUsername(input.username);
  const email = normalizeAdminEmail(input.email);
  const fullName = normalizeAdminFullName(input.full_name);

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .insert({
      username,
      email,
      full_name: fullName,
      password_hash: passwordHash,
      role: "admin",
      is_active: true,
      session_version: 1,
      created_at: now,
      updated_at: now,
    })
    .select(LIST_SELECT)
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminUserCreateValidationError(mapUniqueViolationToCreateFieldErrors(error));
    }
    throw new Error(error.message);
  }

  return mapListItem(data as Record<string, unknown>);
}

export async function updateAdminUserProfile(
  targetUserId: number,
  input: {
    username: string;
    email: string;
    full_name: string;
    is_active: boolean;
  },
) {
  const user = await getAdminUserById(targetUserId);
  if (!user) throw new Error("المستخدم غير موجود.");

  const username = normalizeAdminUsername(input.username);
  const email = normalizeAdminEmail(input.email);
  const fullName = normalizeAdminFullName(input.full_name);
  const nextActive = input.is_active;

  const usernameError = validateAdminUsername(username);
  if (usernameError) throw new Error(usernameError);

  const emailError = validateAdminEmail(email);
  if (emailError) throw new Error(emailError);

  const fullNameError = validateAdminFullName(fullName);
  if (fullNameError) throw new Error(fullNameError);

  if (!nextActive && user.is_active) {
    const activeCount = await countActiveAdminUsers();
    if (activeCount <= 1) {
      throw new Error("لا يمكن تعطيل آخر مستخدم نشط في النظام.");
    }
  }

  const usernameChanged = user.username !== username;
  const emailChanged = user.email !== email;
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    username,
    email,
    full_name: fullName,
    is_active: nextActive,
    updated_at: now,
  };

  if (usernameChanged || emailChanged || (user.is_active && !nextActive)) {
    payload.session_version = user.session_version + 1;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .update(payload)
    .eq("id", targetUserId)
    .select(LIST_SELECT)
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.");
    }
    throw new Error(error.message);
  }

  return mapListItem(data as Record<string, unknown>);
}

export async function setAdminUserActiveStatus(
  targetUserId: number,
  isActive: boolean,
  actingUserId: number,
) {
  if (targetUserId === actingUserId && !isActive) {
    throw new Error("لا يمكنك تعطيل حسابك الحالي.");
  }

  const user = await getAdminUserById(targetUserId);
  if (!user) throw new Error("المستخدم غير موجود.");

  if (!isActive && user.is_active) {
    const activeCount = await countActiveAdminUsers();
    if (activeCount <= 1) {
      throw new Error("لا يمكن تعطيل آخر مستخدم نشط في النظام.");
    }
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    is_active: isActive,
    updated_at: now,
  };

  if (!isActive && user.is_active) {
    payload.session_version = user.session_version + 1;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .update(payload)
    .eq("id", targetUserId)
    .select(LIST_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapListItem(data as Record<string, unknown>);
}

export async function deleteAdminUser(targetUserId: number, actingUserId: number) {
  if (targetUserId === actingUserId) {
    throw new Error("لا يمكنك حذف حسابك الحالي.");
  }

  const user = await getAdminUserById(targetUserId);
  if (!user) throw new Error("المستخدم غير موجود.");

  const totalCount = await countAdminUsers();
  if (totalCount <= 1) {
    throw new Error("لا يمكن حذف آخر مستخدم في النظام.");
  }

  if (user.is_active) {
    const activeCount = await countActiveAdminUsers();
    if (activeCount <= 1) {
      throw new Error("لا يمكن حذف آخر مستخدم نشط في النظام.");
    }
  }

  const { error } = await getSupabaseAdmin().from("admin_users").delete().eq("id", targetUserId);
  if (error) throw new Error(error.message);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

export async function adminResetUserPassword(
  targetUserId: number,
  actingUserId: number,
  password: string,
  confirmPassword: string,
) {
  if (targetUserId === actingUserId) {
    throw new Error("لتغيير كلمة مرورك استخدم صفحة الأمان في الإعدادات.");
  }

  const user = await getAdminUserById(targetUserId);
  if (!user) throw new Error("المستخدم غير موجود.");

  const passwordError = validateAdminPasswordPair(password, confirmPassword);
  if (passwordError) throw new Error(passwordError);

  await updateAdminUserPassword(targetUserId, password);

  const updated = await getAdminUserById(targetUserId);
  if (!updated) throw new Error("المستخدم غير موجود.");

  return {
    id: updated.id,
    email: updated.email,
    username: updated.username,
    full_name: updated.full_name,
    role: updated.role,
    is_active: updated.is_active,
    last_login_at: updated.last_login_at,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  } satisfies AdminUserListItem;
}
