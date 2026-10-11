import "server-only";

import type { Json } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { parseManagedStorageAsset } from "../../storage/upload-cms-asset";
import { extractMediaCandidateValues, replaceMediaValue } from "./reference-providers";

/** Catalog tombstones own deletion truth; a still-cached public URL does not. */
export async function readDeletedManagedValues(value: unknown, confirmedOnly = false): Promise<string[]> {
  const candidates = [...new Set(extractMediaCandidateValues(value))];
  const managed = candidates.flatMap(publicValue => {
    const identity = parseManagedStorageAsset(publicValue);
    return identity ? [{ publicValue, ...identity }] : [];
  });
  const deleted = new Set<string>();
  const keys = [...new Set(managed.map(item => item.objectPath))];
  for (let offset = 0; offset < keys.length; offset += 100) {
    let query = getSupabaseAdmin().from("media_assets")
      .select("bucket,object_key,status")
      .eq("provider", "supabase")
      .eq("status", "deleted")
      .in("object_key", keys.slice(offset, offset + 100));
    if (confirmedOnly) query = query.contains("metadata", { usageConfirmedDeletion: true });
    const { data, error } = await query;
    if (error) throw new Error("media_deleted_reference_state_unavailable");
    for (const row of data ?? []) deleted.add(`${row.bucket}\u0000${row.object_key}`);
  }
  return managed.filter(item => deleted.has(`${item.bucket}\u0000${item.objectPath}`))
    .map(item => item.publicValue);
}

/** Presentation projection only. Stored content and related row metadata survive. */
export async function omitDeletedManagedMedia<T>(value: T): Promise<T> {
  const deleted = await readUnavailableManagedValues(value);
  if (!deleted.length) return value;
  let projected = value as Json;
  for (const publicValue of deleted) projected = replaceMediaValue(projected, publicValue, "");
  return projected as T;
}

/** Presentation-only missing state. Never used to grant the deleted-reference save exception. */
async function readUnavailableCatalogValues(value: unknown, includeDeleted: boolean): Promise<string[]> {
  const managed = [...new Set(extractMediaCandidateValues(value))].flatMap(publicValue => {
    const identity = parseManagedStorageAsset(publicValue);
    return identity ? [{ publicValue, ...identity }] : [];
  });
  const missing = new Set<string>();
  const keys = [...new Set(managed.map(item => item.objectPath))];
  for (let offset = 0; offset < keys.length; offset += 100) {
    const { data, error } = await getSupabaseAdmin().from("media_assets")
      .select("bucket,object_key,status,missing_object")
      .eq("provider", "supabase").in("object_key", keys.slice(offset, offset + 100));
    if (error) throw new Error("media_missing_reference_state_unavailable");
    for (const row of data ?? []) {
      if (row.status === "missing" || row.status === "deleting" || row.missing_object || (includeDeleted && row.status === "deleted")) missing.add(`${row.bucket}\u0000${row.object_key}`);
    }
  }
  return managed.filter(item => missing.has(`${item.bucket}\u0000${item.objectPath}`)).map(item => item.publicValue);
}

export async function readMissingManagedValues(value: unknown): Promise<string[]> {
  return readUnavailableCatalogValues(value, false);
}

/** Public projection availability; save authorization continues to use confirmed deletion only. */
export async function readUnavailableManagedValues(value: unknown): Promise<string[]> {
  return readUnavailableCatalogValues(value, true);
}
