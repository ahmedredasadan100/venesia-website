/** Shared Supabase text search helper for admin listing pages. */

export function escapeAdminListSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[%_*]/g, "\\$&");
}

function quotePostgrestSearchPattern(pattern: string): string {
  // The quoted OR operand is decoded before PostgreSQL interprets the pattern.
  return '"' + pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function buildAdminListSearchOrFilter(fields: readonly string[], term: string): string {
  const escaped = escapeAdminListSearchTerm(term);
  if (!escaped) return "";
  fields.forEach((field) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new TypeError(`Invalid Admin list search field: ${field}`);
    }
  });
  // PostgREST aliases every asterisk to % for ILIKE, even escaped asterisks.
  // A fully escaped regex preserves literal substring search for those terms.
  const containsAsterisk = term.includes("*");
  const operator = containsAsterisk ? "imatch" : "ilike";
  const pattern = containsAsterisk
    ? term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : `%${escaped}%`;
  const quoted = quotePostgrestSearchPattern(pattern);
  return fields.map((field) => `${field}.${operator}.${quoted}`).join(",");
}
