import { redirect } from "next/navigation";

import { AUDIT_ACTION_OPTIONS } from "../../../lib/admin/audit/audit-actions";
import {
  listAdminAuditLogs,
  listAuditActorUsernames,
  listAuditEntityTypes,
} from "../../../lib/admin/audit/list-admin-audit-logs";
import { getCurrentAdminUserFromCookies } from "../../../lib/admin/auth/admin-users";

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
  const page = Math.max(1, Number(query.page ?? "1") || 1);

  const [result, actorOptions, entityTypeOptions] = await Promise.all([
    listAdminAuditLogs({
      actorUsername: query.actor,
      action: query.action,
      entityType: query.entityType,
      dateFrom: query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : undefined,
      dateTo: query.dateTo ? `${query.dateTo}T23:59:59.999Z` : undefined,
      query: query.q,
      page,
      pageSize: 25,
    }),
    listAuditActorUsernames(),
    listAuditEntityTypes(),
  ]);

  return (
    <ActivityLogClient
      initialResult={result}
      actionOptions={AUDIT_ACTION_OPTIONS}
      actorOptions={actorOptions}
      entityTypeOptions={entityTypeOptions}
      initialFilters={{
        actor: query.actor ?? "",
        action: query.action ?? "",
        entityType: query.entityType ?? "",
        dateFrom: query.dateFrom ?? "",
        dateTo: query.dateTo ?? "",
        q: query.q ?? "",
        page,
      }}
    />
  );
}
