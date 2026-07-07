import path from "path";

const MEDIA_ROOT_FOLDERS = new Set(["images", "files"]);

export type MediaAssetItem = {
  path: string;
  filename: string;
  extension: string;
  kind: "image" | "document";
  sizeBytes: number | null;
};

export type PublicMediaFolderListing = {
  folder: string;
  parentFolder: string | null;
  subfolders: string[];
  images: string[];
  documents: string[];
  items: MediaAssetItem[];
};

export function normalizeMediaFolder(folder: string) {
  const cleaned = folder.replace(/^\/+/, "").replace(/\\/g, "/").trim();
  if (!cleaned || cleaned.includes("..")) {
    throw new Error("Invalid folder path.");
  }
  return cleaned;
}

export function resolvePublicFolder(folder: string) {
  const normalized = normalizeMediaFolder(folder);
  const publicRoot = path.join(process.cwd(), "public");
  const target = path.join(publicRoot, normalized);

  if (!target.startsWith(publicRoot)) {
    throw new Error("Invalid folder path.");
  }

  return { normalized, publicRoot, target };
}

export function getMediaParentFolder(normalized: string) {
  return MEDIA_ROOT_FOLDERS.has(normalized) ? null : path.posix.dirname(normalized);
}
