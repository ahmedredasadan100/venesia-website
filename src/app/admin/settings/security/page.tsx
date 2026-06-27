import { redirect } from "next/navigation";

import { getCurrentAdminUserFromCookies } from "../../../../lib/admin/auth/admin-users";

import SecuritySettingsClient from "./SecuritySettingsClient";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const user = await getCurrentAdminUserFromCookies();
  if (!user) {
    redirect("/admin/login?next=/admin/settings/security");
  }

  return (
    <SecuritySettingsClient
      username={user.username}
      email={user.email}
      fullName={user.full_name}
      lastLoginAt={user.last_login_at}
    />
  );
}
