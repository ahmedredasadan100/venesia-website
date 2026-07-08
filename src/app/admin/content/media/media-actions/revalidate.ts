import { revalidatePath } from "next/cache";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../../lib/cache/revalidate-public-cache-tags";

export function revalidateMediaContentPaths(id?: string | number) {
  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidatePath("/admin/content/media");
  revalidatePath("/admin/content/media/new");
  revalidatePath("/admin/topics/categories");

  if (id) {
    revalidatePath(`/admin/content/media/${id}`);
  }
}
