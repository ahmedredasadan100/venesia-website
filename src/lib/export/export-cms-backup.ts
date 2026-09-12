import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { CMS_BACKUP_TABLES, type CmsBackupPayload } from "./cms-backup-config";

const EXPORT_PAGE_SIZE = 1000;

// Offset pagination is complete for a stable table, but is not a transaction
// snapshot. Counts and unique keys detect many concurrent changes, not an
// update/replacement that preserves both the row count and page boundaries.
export async function exportCmsBackup(): Promise<CmsBackupPayload> {
  const tables: Record<string, unknown[]> = {};
  const tableErrors: Record<string, string> = {};

  await Promise.all(
    CMS_BACKUP_TABLES.map(async (table) => {
      const { name, orderBy = "id" } = table;
      const primaryKey = "primaryKey" in table ? table.primaryKey : "id";
      try {
        const rows: unknown[] = [];
        const keys = new Set<string>();
        let expectedCount: number | undefined;
        do {
          let query = getSupabaseAdmin().from(name)
            .select("*", { count: "exact" })
            .order(orderBy, { ascending: true });
          if (orderBy !== primaryKey) query = query.order(primaryKey, { ascending: true });
          const { data, error, count } = await query.range(rows.length, rows.length + EXPORT_PAGE_SIZE - 1);
          if (error) throw new Error(error.message);
          if (count === null || !Number.isSafeInteger(count) || count < 0) {
            throw new Error("CMS export completeness count is unavailable.");
          }
          expectedCount ??= count;
          if (count !== expectedCount) throw new Error("CMS table changed during export.");
          if (!data || (data.length === 0 && rows.length < expectedCount)) {
            throw new Error("CMS export page is incomplete.");
          }
          for (const row of data) {
            const key = (row as Record<string, unknown>)[primaryKey];
            if ((typeof key !== "string" && typeof key !== "number") || keys.has(String(key))) {
              throw new Error("CMS export page has a missing or duplicate unique key.");
            }
            keys.add(String(key));
            rows.push(row);
          }
          if (rows.length > expectedCount) throw new Error("CMS export exceeded its completeness count.");
        } while (rows.length < expectedCount);

        const final = await getSupabaseAdmin().from(name).select(primaryKey, { count: "exact", head: true });
        if (final.error) throw new Error(final.error.message);
        if (final.count !== expectedCount) throw new Error("CMS table changed before export completed.");
        tables[name] = rows;
      } catch (error) {
        logError(`CMS backup: failed to export table`, error, { table: name });
        tableErrors[name] = error instanceof Error ? error.message : "CMS export failed.";
        tables[name] = [];
      }
    }),
  );

  return {
    exported_at: new Date().toISOString(),
    version: 1,
    tables,
    partial: Object.keys(tableErrors).length > 0,
    table_errors: Object.keys(tableErrors).length ? tableErrors : undefined,
  };
}
