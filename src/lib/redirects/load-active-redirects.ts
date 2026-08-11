import type { ActiveRedirectRule } from "./redirect-types";

type RedirectRow = {
  source_path: string;
  destination_path: string;
  redirect_type: "301" | "302";
};

export async function loadActiveRedirectForRuntime(
  sourcePath: string,
): Promise<ActiveRedirectRule | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const search = new URLSearchParams({
      select: "source_path,destination_path,redirect_type",
      status: "eq.active",
      source_path: `eq.${sourcePath}`,
      order: "updated_at.desc",
      limit: "1",
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/url_redirects?${search}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as RedirectRow[];
    const row = rows[0];
    if (!row) return null;

    return {
      sourcePath: row.source_path,
      destinationPath: row.destination_path,
      redirectType: row.redirect_type,
    };
  } catch {
    return null;
  }
}
