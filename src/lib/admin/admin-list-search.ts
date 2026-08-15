/** Shared Supabase text search helper for admin listing pages. */

export function escapeAdminListSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[%_*]/g, "\\$&");
}

export function buildAdminListSearchOrFilter(fields: readonly string[], term: string): string {
  const escaped = escapeAdminListSearchTerm(term);
  if (!escaped) return "";
  fields.forEach((field) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new TypeError(`Invalid Admin list search field: ${field}`);
    }
  });
  const pattern = `"%${escaped}%"`;
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}
