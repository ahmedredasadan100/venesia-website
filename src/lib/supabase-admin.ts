import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { createSupabaseFetch } from "./supabase-fetch";

let adminClient: SupabaseClient<Database> | null = null;
let storageAdminClient: SupabaseClient<Database> | null = null;

export const SUPABASE_STORAGE_REQUEST_TIMEOUT_MS = 60_000;

function missingEnvMessage() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return `Missing required server environment variable(s): ${missing.join(", ")}. Add them to .env.local for server-side Supabase access.`;
}

/** Server-only Supabase client using the service role key. Never import in client components. */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(missingEnvMessage());
  }

  if (!adminClient) {
    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: createSupabaseFetch(),
      },
    });
  }

  return adminClient;
}

/** Storage uploads can legitimately exceed the short database-query timeout. */
export function getSupabaseStorageAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(missingEnvMessage());
  }

  if (!storageAdminClient) {
    storageAdminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: createSupabaseFetch(SUPABASE_STORAGE_REQUEST_TIMEOUT_MS),
      },
    });
  }

  return storageAdminClient;
}
