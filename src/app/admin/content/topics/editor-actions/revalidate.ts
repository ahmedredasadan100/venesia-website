import { revalidatePath } from "next/cache";

import type { ContentType } from "../../../../../lib/admin/content/content-types";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../../lib/cache/revalidate-public-cache-tags";
import {
  resolvePublicContentBasePath,
  resolvePublicContentPath,
} from "../../../../../lib/content/public-content-path";

export function revalidateUnifiedContentPaths(options: {
  contentType: ContentType;
  id?: string | number;
  oldSlug?: string | null;
  newSlug?: string | null;
}) {
  revalidateTopicsCache();
  if (options.contentType !== "article") revalidateMediaCenterCache();

  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath(resolvePublicContentBasePath(options.contentType));

  if (options.id) {
    revalidatePath(`/admin/content/topics/${options.id}`);
    revalidatePath(`/admin/content/topics/${options.id}/preview`);
  }
  if (options.oldSlug) {
    revalidatePath(
      resolvePublicContentPath(options.contentType, options.oldSlug),
    );
  }
  if (options.newSlug) {
    revalidatePath(
      resolvePublicContentPath(options.contentType, options.newSlug),
    );
  }
}
