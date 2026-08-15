import { revalidatePath } from "next/cache";
import type { ProjectCategory } from "../../../../lib/projects/public-types";
import { revalidateProjectsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
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
