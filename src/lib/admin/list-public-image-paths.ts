import "server-only";

import { listPublicImagePathsFromStorage, isSupabaseCmsStorageEnabled } from "../storage/upload-cms-asset";

export async function listPublicImagePaths(folder = "images", limit = 240) {
  if (isSupabaseCmsStorageEnabled()) {
    return listPublicImagePathsFromStorage(folder, limit);
  }

  const { listPublicImagePathsFromFs } = await import("./media-library-fs");
  return listPublicImagePathsFromFs(folder, limit);
}
