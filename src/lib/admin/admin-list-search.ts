/** Shared Supabase text search helper for admin listing pages. */

export function escapeAdminListSearchTerm(term: string): string {
  return term.trim().replace(/[%_]/g, "");
}

export function buildAdminListSearchOrFilter(fields: readonly string[], term: string): string {
  const escaped = escapeAdminListSearchTerm(term);
  if (!escaped) return "";
  return fields.map((field) => `${field}.ilike.%${escaped}%`).join(",");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAdminListTextSearch(query: any, term: string | undefined | null, fields: readonly string[]) {
  const filter = term?.trim() ? buildAdminListSearchOrFilter(fields, term) : "";
  if (!filter) return query;
  return query.or(filter);
}
