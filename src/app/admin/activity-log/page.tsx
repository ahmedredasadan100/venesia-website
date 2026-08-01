import { redirect } from "next/navigation";

import { AUDIT_ACTION_OPTIONS } from "../../../lib/admin/audit/audit-actions";
import {
  listAuditActorUsernames,
  listAuditEntityTypes,
} from "../../../lib/admin/audit/list-admin-audit-logs";
import { activityLogEntityListAdapter } from "../../../lib/admin/audit/entity-list-adapter";
import { activityLogQueryContract } from "../../../lib/admin/audit/entity-list-contract";
import { ACTIVITY_LOG_LIST_VIEW_KEY } from "../../../lib/admin/audit/activity-log-list-config";
import { getCurrentAdminUserFromCookies } from "../../../lib/admin/auth/admin-users";
import { normalizeAdminEntityListQuery } from "../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";

import ActivityLogClient from "./ActivityLogClient";

export const dynamic = "force-dynamic";

type ActivityLogSearchParams = {
  actor?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: string;
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams?: Promise<ActivityLogSearchParams>;
}) {
  const currentUser = await getCurrentAdminUserFromCookies();
  if (!currentUser) {
    redirect("/admin/login?next=/admin/activity-log");
  }

  const query = (await searchParams) ?? {};
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  const initialQuery = normalizeAdminEntityListQuery(
    activityLogQueryContract,
    params,
  );

  const [
    initialResult,
    actorOptions,
    entityTypeOptions,
    columnPreferences,
  ] = await Promise.all([
    activityLogEntityListAdapter.load(initialQuery),
    listAuditActorUsernames(),
    listAuditEntityTypes(),
    readAdminColumnPreferences(ACTIVITY_LOG_LIST_VIEW_KEY),
  ]);

  return (
    <ActivityLogClient
      initialQuery={initialQuery}
      initialResult={initialResult}
      actionOptions={AUDIT_ACTION_OPTIONS}
      actorOptions={actorOptions}
      entityTypeOptions={entityTypeOptions}
      initialVisibleColumns={columnPreferences.visibleColumns}
    />
  );
}
