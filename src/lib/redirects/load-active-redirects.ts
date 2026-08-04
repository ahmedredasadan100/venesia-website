import type { ActiveRedirectRule } from "./redirect-types";

type RedirectRow = {
  source_path: string;
  destination_path: string;
  redirect_type: "301" | "302";
};

export async function loadActiveRedirectsForRuntime(): Promise<ActiveRedirectRule[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/url_redirects?select=source_path,destination_path,redirect_type&status=eq.active&order=updated_at.desc`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    const rows = (await response.json()) as RedirectRow[];
    return rows.map((row) => ({
      sourcePath: row.source_path,
      destinationPath: row.destination_path,
      redirectType: row.redirect_type,
    }));

  } catch {
    return [];
  }
}
