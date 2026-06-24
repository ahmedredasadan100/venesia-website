import "server-only";

import { revalidatePath } from "next/cache";

import { MEDIA_CENTER_PUBLIC_PATHS } from "../media-center-page-config";

export function revalidateMediaCenterPublicPaths() {
  for (const path of MEDIA_CENTER_PUBLIC_PATHS) {
    revalidatePath(path, "page");
  }
}
