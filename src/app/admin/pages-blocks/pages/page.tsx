import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { loadPagesEntityListResult } from "../../../../lib/admin/pages/entity-list-adapter";
import { pagesQueryContract } from "../../../../lib/admin/pages/entity-list-contract";
import PagesTableClient from "./PagesTableClient";

export const dynamic = "force-dynamic";

export default async function PagesManagerPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => { if (typeof value === "string") params.set(key, value); });
  const initialQuery = normalizeAdminEntityListQuery(pagesQueryContract, params);
  const initialResult = await loadPagesEntityListResult(initialQuery);
  return <PagesTableClient initialQuery={initialQuery} initialResult={initialResult} />;
}
