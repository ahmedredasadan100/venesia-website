import { listRedirects } from "./actions";
import RedirectsClient from "./RedirectsClient";

export const dynamic = "force-dynamic";

type RedirectsSearchParams = {
  notice?: string;
  error?: string;
  q?: string;
  status?: string;
  type?: string;
};

export default async function RedirectsPage({
  searchParams,
}: {
  searchParams?: Promise<RedirectsSearchParams>;
}) {
  const query = await searchParams;
  const filters = {
    q: query?.q ?? "",
    status: query?.status ?? "all",
    redirectType: query?.type ?? "all",
  };

  const redirects = await listRedirects({
    q: filters.q,
    status: filters.status === "all" ? undefined : filters.status,
    redirectType: filters.redirectType === "all" ? undefined : filters.redirectType,
  }).catch(() => []);
  const clientSnapshotKey = [
    filters.q,
    filters.status,
    filters.redirectType,
    query?.notice ?? "",
    query?.error ?? "",
    ...redirects.map((row) => `${row.id}:${row.updated_at}`),
  ].join("|");

  return (
    <RedirectsClient
      key={clientSnapshotKey}
      redirects={redirects}
      notice={query?.notice ?? null}
      error={query?.error ?? null}
      initialFilters={filters}
    />
  );
}
