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
  revalidateUnifiedContentBatchPaths({
    contentType: options.contentType,
    entries: [options],
  });
}

export function revalidateUnifiedContentBatchPaths(options: {
  contentType: ContentType;
  entries: readonly {
    id?: string | number;
    oldSlug?: string | null;
    newSlug?: string | null;
  }[];
}) {
  revalidateTopicsCache();
  if (options.contentType !== "article") revalidateMediaCenterCache();

  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath(resolvePublicContentBasePath(options.contentType));

  for (const entry of options.entries) {
    if (entry.id) {
      revalidatePath(`/admin/content/topics/${entry.id}`);
      revalidatePath(`/admin/content/topics/${entry.id}/preview`);
    }
    if (entry.oldSlug) {
      revalidatePath(
        resolvePublicContentPath(options.contentType, entry.oldSlug),
      );
    }
    if (entry.newSlug) {
      revalidatePath(
        resolvePublicContentPath(options.contentType, entry.newSlug),
      );
    }
  }
}
