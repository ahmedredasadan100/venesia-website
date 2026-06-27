import { redirect } from "next/navigation";

import { getCurrentAdminUserFromCookies } from "../../../lib/admin/auth/admin-users";
import { listAdminUsers } from "../../../lib/admin/users/admin-users-management";

import UsersManagementClient from "./UsersManagementClient";

export const dynamic = "force-dynamic";

export default async function UsersRolesPage() {
  const currentUser = await getCurrentAdminUserFromCookies();
  if (!currentUser) {
    redirect("/admin/login?next=/admin/users-roles");
  }

  const users = await listAdminUsers();

  return (
    <UsersManagementClient
      initialUsers={users}
      currentUserId={currentUser.id}
      currentUsername={currentUser.username}
    />
  );
}
