import { revalidatePath } from "next/cache";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";

export function revalidateTopicPaths(options: {
  id?: string | number;
  oldSlug?: string | null;
  newSlug?: string | null;
}) {
  revalidateTopicsCache();
  revalidatePath("/topics");
  revalidatePath("/admin/topics");
  revalidatePath("/admin/topics/new");

  if (options.id) {
    revalidatePath(`/admin/topics/${options.id}`);
    revalidatePath(`/admin/topics/${options.id}/preview`);
  }

  if (options.oldSlug) revalidatePath(`/topics/${options.oldSlug}`);
  if (options.newSlug) revalidatePath(`/topics/${options.newSlug}`);
}
