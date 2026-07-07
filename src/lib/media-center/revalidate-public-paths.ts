import "server-only";

import { revalidatePath } from "next/cache";

import { revalidateMediaCenterCache } from "../cache/revalidate-public-cache-tags";
import { MEDIA_CENTER_PUBLIC_PATHS } from "../media-center-page-config";

export function revalidateMediaCenterPublicPaths() {
  revalidateMediaCenterCache();
  for (const path of MEDIA_CENTER_PUBLIC_PATHS) {
    revalidatePath(path, "page");
  }
}
