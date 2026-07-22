import "server-only";

import { listPublicImagePaths as listImagesFromMediaStorage } from "./media-library";

export async function listPublicImagePaths(folder = "images", limit = 240) {
  return listImagesFromMediaStorage(folder, limit);
}
