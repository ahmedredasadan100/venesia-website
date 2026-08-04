import { redirect } from "next/navigation";

import { getCurrentAdminUserFromCookies } from "../../../lib/admin/auth/admin-users";
import { normalizeAdminEntityListQuery } from "../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";
import { loadAdminUsersEntityListResult } from "../../../lib/admin/users/entity-list-adapter";
import { adminUsersQueryContract } from "../../../lib/admin/users/entity-list-contract";
import {
  getAdminUsersDefaultColumnKeys,
  ADMIN_USERS_LIST_VIEW_KEY,
} from "../../../lib/admin/users/list-config";

import UsersManagementClient from "./UsersManagementClient";

export const dynamic = "force-dynamic";

export default async function UsersRolesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentAdminUserFromCookies();
  if (!currentUser) {
    redirect("/admin/login?next=/admin/users-roles");
  }

  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  const initialQuery = normalizeAdminEntityListQuery(
    adminUsersQueryContract,
    params,
  );
  const [initialResult, preference] = await Promise.all([
    loadAdminUsersEntityListResult(initialQuery),
    readAdminColumnPreferences(ADMIN_USERS_LIST_VIEW_KEY),
  ]);

  return (
    <UsersManagementClient
      initialQuery={initialQuery}
      initialResult={initialResult}
      initialVisibleColumns={
        preference.visibleColumns ?? [...getAdminUsersDefaultColumnKeys()]
      }
      preferenceError={preference.error}
      currentUserId={currentUser.id}
      currentUsername={currentUser.username}
    />
  );
}
