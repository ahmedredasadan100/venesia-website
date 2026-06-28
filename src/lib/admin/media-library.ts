import "server-only";

import {
  listCmsFolderFromStorage,
  uploadCmsDocumentToStorage,
  uploadCmsImageToStorage,
  useSupabaseCmsStorage,
} from "../storage/upload-cms-asset";

/**
 * Media uploads: filesystem in local dev, Supabase Storage in production.
 * Migration plan: docs/security-media-upload-migration.md
 */

export type { PublicMediaFolderListing } from "./media-library-paths";
export { normalizeMediaFolder } from "./media-library-paths";

export async function listPublicMediaFolder(folder = "images") {
  if (useSupabaseCmsStorage()) {
    return listCmsFolderFromStorage(folder);
  }

  const { listPublicMediaFolderFromFs } = await import("./media-library-fs");
  return listPublicMediaFolderFromFs(folder);
}

export async function savePublicMediaUpload(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  if (useSupabaseCmsStorage()) {
    return uploadCmsImageToStorage(folder, file, options);
  }

  const { savePublicMediaUploadToFs } = await import("./media-library-fs");
  return savePublicMediaUploadToFs(folder, file, options);
}

export async function savePublicDocumentUpload(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  if (useSupabaseCmsStorage()) {
    return uploadCmsDocumentToStorage(folder, file, options);
  }

  const { savePublicDocumentUploadToFs } = await import("./media-library-fs");
  return savePublicDocumentUploadToFs(folder, file, options);
}
