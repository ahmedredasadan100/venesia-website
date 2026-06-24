import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { CMS_BACKUP_TABLES, type CmsBackupPayload } from "./cms-backup-config";

export async function exportCmsBackup(): Promise<CmsBackupPayload> {
  const tables: Record<string, unknown[]> = {};
  const tableErrors: Record<string, string> = {};

  await Promise.all(
    CMS_BACKUP_TABLES.map(async ({ name, orderBy = "id" }) => {
      let query = getSupabaseAdmin().from(name).select("*");

      if (orderBy) {
        query = query.order(orderBy, { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        logError(`CMS backup: failed to export table`, error, { table: name });
        tableErrors[name] = error.message;
        tables[name] = [];
        return;
      }

      tables[name] = data ?? [];
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
