import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { loadPagesEntityListResult } from "../../../../lib/admin/pages/entity-list-adapter";
import { pagesQueryContract } from "../../../../lib/admin/pages/entity-list-contract";
import {
  getPagesDefaultColumnKeys,
  PAGES_LIST_VIEW_KEY,
} from "../../../../lib/admin/pages/pages-list-config";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import PagesTableClient from "./PagesTableClient";

export const dynamic = "force-dynamic";

export default async function PagesManagerPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => { if (typeof value === "string") params.set(key, value); });
  const initialQuery = normalizeAdminEntityListQuery(pagesQueryContract, params);
  const [initialResult, preference] = await Promise.all([
    loadPagesEntityListResult(initialQuery),
    readAdminColumnPreferences(PAGES_LIST_VIEW_KEY),
  ]);
  return (
    <PagesTableClient
      initialQuery={initialQuery}
      initialResult={initialResult}
      initialVisibleColumns={
        preference.visibleColumns ?? [...getPagesDefaultColumnKeys()]
      }
      preferenceError={preference.error}
    />
  );
}
