import "server-only";

import fs from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const MEDIA_ROOT_FOLDERS = new Set(["images", "files"]);

export type PublicMediaFolderListing = {
  folder: string;
  parentFolder: string | null;
  subfolders: string[];
  images: string[];
  documents: string[];
};

function isImageFile(filename: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isPdfFile(filename: string) {
  return PDF_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function getMediaParentFolder(normalized: string) {
  return MEDIA_ROOT_FOLDERS.has(normalized) ? null : path.posix.dirname(normalized);
}

export function normalizeMediaFolder(folder: string) {
  const cleaned = folder.replace(/^\/+/, "").replace(/\\/g, "/").trim();
  if (!cleaned || cleaned.includes("..")) {
    throw new Error("Invalid folder path.");
  }
  return cleaned;
}

function resolvePublicFolder(folder: string) {
  const normalized = normalizeMediaFolder(folder);
  const publicRoot = path.join(process.cwd(), "public");
  const target = path.join(publicRoot, normalized);

  if (!target.startsWith(publicRoot)) {
    throw new Error("Invalid folder path.");
  }

  return { normalized, publicRoot, target };
}

export async function listPublicMediaFolder(folder = "images"): Promise<PublicMediaFolderListing> {
  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    return {
      folder: normalized,
      parentFolder: getMediaParentFolder(normalized),
      subfolders: [],
      images: [],
      documents: [],
    };
  }

  const entries = fs.readdirSync(target, { withFileTypes: true });
  const subfolders: string[] = [];
  const images: string[] = [];
  const documents: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subfolders.push(entry.name);
      continue;
    }

    if (!entry.isFile()) continue;

    if (isImageFile(entry.name)) {
      images.push(`/${path.posix.join(normalized, entry.name)}`);
      continue;
    }

    if (isPdfFile(entry.name)) {
      documents.push(`/${path.posix.join(normalized, entry.name)}`);
    }
  }

  return {
    folder: normalized,
    parentFolder: getMediaParentFolder(normalized),
    subfolders: subfolders.sort((a, b) => a.localeCompare(b)),
    images: images.sort((a, b) => a.localeCompare(b)),
    documents: documents.sort((a, b) => a.localeCompare(b)),
  };
}

export async function listPublicImagePaths(folder = "images", limit = 240) {
  const publicRoot = path.join(process.cwd(), "public");
  const normalized = normalizeMediaFolder(folder);
  const results: string[] = [];

  function walkImages(dir: string) {
    if (results.length >= limit) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkImages(fullPath);
        continue;
      }

      if (!entry.isFile() || !isImageFile(entry.name)) continue;
      results.push(`/${path.relative(publicRoot, fullPath).split(path.sep).join("/")}`);
    }
  }

  walkImages(path.join(publicRoot, normalized));
  return results.slice(0, limit).sort((a, b) => a.localeCompare(b));
}

function sanitizeUploadFilename(filename: string, allowedExtensions: Set<string>, fallbackStem: string) {
  const base = path.basename(filename);
  const ext = path.extname(base).toLowerCase();
  const stem = path
    .basename(base, ext)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!allowedExtensions.has(ext)) {
    throw new Error("Unsupported file type.");
  }

  return `${stem || fallbackStem}-${Date.now()}${ext}`;
}

export async function savePublicMediaUpload(folder: string, file: File) {
  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const filename = sanitizeUploadFilename(file.name, IMAGE_EXTENSIONS, "image");
  const destination = path.join(target, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(destination, bytes);

  return {
    path: `/${path.posix.join(normalized, filename)}`,
    filename,
  };
}

export async function savePublicDocumentUpload(folder: string, file: File) {
  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const filename = sanitizeUploadFilename(file.name, PDF_EXTENSIONS, "document");
  const destination = path.join(target, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(destination, bytes);

  return {
    path: `/${path.posix.join(normalized, filename)}`,
    filename,
  };
}
