import "server-only";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "../supabase-admin";
import { MEDIA_CENTER_PUBLIC_PATHS } from "../media-center-page-config";

import { ASSIGNMENT_TABLES, ALL_ASSIGNMENT_TABLES } from "./block-module-registry";

const BASE_PUBLIC_PATHS = ["/", "/about", "/contact", "/topics", "/track-your-project", ...MEDIA_CENTER_PUBLIC_PATHS];

function addPagePaths(paths: Set<string>, page?: { path: string | null; slug: string | null } | null) {
  if (!page) return;
  if (page.path) paths.add(page.path);
  if (page.slug === "home") paths.add("/");
  if (page.slug === "about") paths.add("/about");
  if (page.slug === "contact") paths.add("/contact");
  if (page.slug === "topics") paths.add("/topics");
  if (page.slug === "track-your-project") paths.add("/track-your-project");
  if (page.slug?.startsWith("media-center")) {
    paths.add(page.path ?? "/media-center");
  }
}

async function collectAssignedPublicPaths() {
  const pageIds = new Set<number>();

  await Promise.all(
    ALL_ASSIGNMENT_TABLES.map(async (table) => {
      const { data } = await getSupabaseAdmin().from(table).select("page_id");
      for (const row of data ?? []) {
        pageIds.add(row.page_id);
      }
    }),
  );

  const paths = new Set<string>(BASE_PUBLIC_PATHS);

  if (pageIds.size) {
    const { data: pages } = await getSupabaseAdmin()
      .from("pages")
      .select("path,slug")
      .in("id", [...pageIds]);

    for (const page of pages ?? []) {
      addPagePaths(paths, page);
    }
  }

  return paths;
}

export async function revalidatePublicPagesWithBlockAssignments() {
  const paths = await collectAssignedPublicPaths();

  for (const path of paths) {
    revalidatePath(path, "page");
  }
}

export async function revalidateBlockModulePaths(_modulePath: string) {
  revalidatePath("/admin/pages-blocks/pages", "layout");
  await revalidatePublicPagesWithBlockAssignments();
}

export async function revalidatePageBlocksPath(pageId: number) {
  revalidatePath("/admin/pages-blocks/pages", "layout");
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`, "page");

  const { data: page } = await getSupabaseAdmin()
    .from("pages")
    .select("path,slug")
    .eq("id", pageId)
    .maybeSingle();

  const paths = new Set<string>(BASE_PUBLIC_PATHS);
  addPagePaths(paths, page);

  for (const path of paths) {
    revalidatePath(path, "page");
  }
}
