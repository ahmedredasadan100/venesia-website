import "server-only";

import { getCurrentAdminUserFromCookies, type AdminUserRecord } from "./admin-users";

export async function requireAdminSession(): Promise<AdminUserRecord> {
  const user = await getCurrentAdminUserFromCookies();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
