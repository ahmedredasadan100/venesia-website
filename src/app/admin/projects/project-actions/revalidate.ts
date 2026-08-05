import { revalidatePath } from "next/cache";
import type { ProjectCategory } from "../../../../lib/projects/public-types";
import { revalidateProjectsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { listPath } from "./helpers";

export function revalidateProjectPaths(
  type: ProjectCategory,
  id?: number,
  slug?: string | null,
  previousSlug?: string | null,
) {
  revalidateProjectsCache();
  revalidatePath("/admin/projects");
  revalidatePath(listPath(type));
  if (id) revalidatePath(`/admin/projects/${id}`);

  revalidatePath("/projects", "page");
  revalidatePath("/", "page");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/projects/${slug}`, "page");
  if (previousSlug && previousSlug !== slug) revalidatePath(`/projects/${previousSlug}`, "page");
}

export async function revalidateProjectPathsById(type: ProjectCategory, id?: number, previousSlug?: string | null) {
  let slug: string | null = null;
  if (id) {
    const { data } = await getSupabaseAdmin().from("projects").select("slug").eq("id", id).maybeSingle();
    slug = data?.slug ?? null;
  }
  revalidateProjectPaths(type, id, slug, previousSlug);
}
