import "server-only";

import { revalidatePath } from "next/cache";

import { revalidateFooterCache } from "../cache/revalidate-public-cache-tags";

export function revalidateFooterPublicPaths() {
  revalidateFooterCache();
  revalidatePath("/", "layout");
}
