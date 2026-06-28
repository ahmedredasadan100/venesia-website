import "server-only";

import { listPublicImagePathsFromStorage, useSupabaseCmsStorage } from "../storage/upload-cms-asset";

export async function listPublicImagePaths(folder = "images", limit = 240) {
  if (useSupabaseCmsStorage()) {
    return listPublicImagePathsFromStorage(folder, limit);
  }

  const { listPublicImagePathsFromFs } = await import("./media-library-fs");
  return listPublicImagePathsFromFs(folder, limit);
}
