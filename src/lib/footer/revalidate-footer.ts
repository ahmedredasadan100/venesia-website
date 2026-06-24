import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateFooterPublicPaths() {
  revalidatePath("/", "layout");
}
