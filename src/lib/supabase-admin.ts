import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseFetch } from "./supabase-fetch";

let adminClient: SupabaseClient | null = null;

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
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(missingEnvMessage());
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
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
