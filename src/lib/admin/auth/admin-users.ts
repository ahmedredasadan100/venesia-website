import "server-only";

import { cookies } from "next/headers";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  AdminSelfAccountValidationError,
  mapUniqueViolationToSelfAccountFieldErrors,
  normalizeAdminEmail,
  normalizeAdminFullName,
  validateAdminEmail,
  validateAdminFullName,
} from "../users/admin-users-validation";
import { hashPassword, verifyPassword } from "./password";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  type AdminSessionPayload,
  verifyAdminSessionToken,
} from "./session";

export type AdminUserRecord = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  session_version: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

const ADMIN_USER_SESSION_COLUMNS =
  "id, email, username, full_name, role, is_active, session_version, last_login_at, created_at, updated_at";

export class AdminAuthDependencyError extends Error {
  readonly code = "admin_auth_dependency_unavailable";
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super("Admin authentication dependency is unavailable.", { cause });
    this.name = "AdminAuthDependencyError";
    this.operation = operation;
  }
}

function toAdminAuthDependencyError(operation: string, error: unknown) {
  return error instanceof AdminAuthDependencyError
    ? error
    : new AdminAuthDependencyError(operation, error);
}

function mapAdminUser(row: Record<string, unknown>): AdminUserRecord {
  return {
    id: Number(row.id),
    email: String(row.email),
    username: String(row.username),
    password_hash: String(row.password_hash ?? ""),
    full_name: row.full_name ? String(row.full_name) : null,
    role: String(row.role ?? "admin"),
    is_active: Boolean(row.is_active),
    session_version: Number(row.session_version ?? 1),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function getAdminUserByIdWithColumns(id: number, columns: string) {
  const { data, error } = await getSupabaseAdmin().from("admin_users").select(columns).eq("id", id).maybeSingle();
  if (error) throw toAdminAuthDependencyError("admin_user_by_id", error);
  if (!data) return null;
  return mapAdminUser(data as unknown as Record<string, unknown>);
}

export async function getAdminUserById(id: number) {
  return getAdminUserByIdWithColumns(id, "*");
}

async function getAdminUserForSession(id: number) {
  return getAdminUserByIdWithColumns(id, ADMIN_USER_SESSION_COLUMNS);
}

async function getAdminUserByUsername(username: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw toAdminAuthDependencyError("admin_user_by_username", error);
  if (!data) return null;
  return mapAdminUser(data as Record<string, unknown>);
}

async function getAdminUserByEmail(email: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw toAdminAuthDependencyError("admin_user_by_email", error);
  if (!data) return null;
  return mapAdminUser(data as Record<string, unknown>);
}

export async function findAdminUserByLoginIdentifier(identifier: string) {
  const login = identifier.trim();
  if (!login) return null;

  const byUsername = await getAdminUserByUsername(login);
  if (byUsername) return byUsername;

  if (login.includes("@")) {
    return getAdminUserByEmail(login);
  }

  return null;
}

export async function authenticateAdminUser(identifier: string, password: string) {
  const user = await findAdminUserByLoginIdentifier(identifier);
  if (!user || !user.is_active) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw toAdminAuthDependencyError("admin_user_login_timestamp", error);
  }

  return user;
}

export async function validateAdminSessionPayload(payload: AdminSessionPayload | null) {
  if (!payload) return false;

  const user = await getAdminUserForSession(payload.id);
  if (!user || !user.is_active) return false;

  return user.session_version === payload.sv;
}

export async function getCurrentAdminUserFromCookies() {
  const config = getAdminAuthConfig();
  if (!config.configured) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = verifyAdminSessionToken(token, config.secret);
  if (!payload) return null;

  const valid = await validateAdminSessionPayload(payload);
  if (!valid) return null;

  return getAdminUserForSession(payload.id);
}

export async function verifyAdminUserPassword(userId: number, password: string) {
  const user = await getAdminUserById(userId);
  if (!user || !user.is_active) return false;
  return verifyPassword(password, user.password_hash);
}

export async function updateAdminUserPassword(userId: number, newPassword: string) {
  const user = await getAdminUserById(userId);
  if (!user) throw new Error("User not found.");

  const passwordHash = await hashPassword(newPassword);
  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({
      password_hash: passwordHash,
      session_version: user.session_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique/i.test(error.message ?? "");
}

export async function updateAdminUserIdentity(
  userId: number,
  input: { fullName: string | null; email: string },
) {
  const fullName = normalizeAdminFullName(input.fullName ?? "");
  const email = normalizeAdminEmail(input.email);
  const fieldErrors = {
    ...(validateAdminFullName(fullName)
      ? { full_name: validateAdminFullName(fullName) ?? undefined }
      : {}),
    ...(validateAdminEmail(email)
      ? { email: validateAdminEmail(email) ?? undefined }
      : {}),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    throw new AdminSelfAccountValidationError(fieldErrors);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({
      full_name: fullName,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("email, full_name")
    .maybeSingle<{ email: string; full_name: string | null }>();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminSelfAccountValidationError(
        mapUniqueViolationToSelfAccountFieldErrors(error),
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("User not found.");
  return data;
}

export async function updateAdminUserEmail(userId: number, email: string) {
  const normalized = normalizeAdminEmail(email);
  const emailError = validateAdminEmail(normalized);
  if (emailError) {
    throw new AdminSelfAccountValidationError({ email: emailError });
  }

  const existing = await getAdminUserByEmail(normalized);
  if (existing && existing.id !== userId) {
    throw new AdminSelfAccountValidationError({ email: "البريد الإلكتروني مستخدم بالفعل" });
  }

  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({
      email: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminSelfAccountValidationError(mapUniqueViolationToSelfAccountFieldErrors(error));
    }
    throw new Error(error.message);
  }
}

export async function revokeAllAdminUserSessions(userId: number) {
  const user = await getAdminUserById(userId);
  if (!user) throw new Error("User not found.");

  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({
      session_version: user.session_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

/** Bump session_version on logout so the current signed cookie cannot be reused. */
export async function invalidateAdminSessionOnLogout(userId: number) {
  await revokeAllAdminUserSessions(userId);
}

type AdminUsersDependencyState =
  | { status: "ready" }
  | { status: "empty" }
  | { status: "unavailable"; error: AdminAuthDependencyError };

export async function getAdminUsersDependencyState(): Promise<AdminUsersDependencyState> {
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return {
        status: "unavailable",
        error: toAdminAuthDependencyError("admin_users_availability", error),
      };
    }
    return (count ?? 0) > 0 ? { status: "ready" } : { status: "empty" };
  } catch (error) {
    return {
      status: "unavailable",
      error: toAdminAuthDependencyError("admin_users_availability", error),
    };
  }
}
