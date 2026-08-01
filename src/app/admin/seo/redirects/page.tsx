import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { loadRedirectsEntityListResult } from "../../../../lib/admin/redirects/entity-list-adapter";
import { redirectsQueryContract } from "../../../../lib/admin/redirects/entity-list-contract";
import {
  getRedirectsDefaultColumnKeys,
  REDIRECTS_LIST_VIEW_KEY,
} from "../../../../lib/admin/redirects/list-config";
import RedirectsClient from "./RedirectsClient";

export const dynamic = "force-dynamic";

export default async function RedirectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });

  const initialQuery = normalizeAdminEntityListQuery(
    redirectsQueryContract,
    params,
  );
  const [initialResult, preference] = await Promise.all([
    loadRedirectsEntityListResult(initialQuery),
    readAdminColumnPreferences(REDIRECTS_LIST_VIEW_KEY),
  ]);

  return (
    <RedirectsClient
      initialQuery={initialQuery}
      initialResult={initialResult}
      initialVisibleColumns={
        preference.visibleColumns ?? [...getRedirectsDefaultColumnKeys()]
      }
      preferenceError={preference.error}
    />
  );
}
