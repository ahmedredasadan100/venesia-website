import { revalidatePath } from "next/cache";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../../lib/cache/revalidate-public-cache-tags";

export function revalidateMediaContentPaths(id?: string | number) {
  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/admin/content/categories");

  if (id) {
    revalidatePath(`/admin/content/topics/${id}`);
    revalidatePath(`/admin/content/topics/${id}/preview`);
  }
}
