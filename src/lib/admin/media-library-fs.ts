import "server-only";

import fs from "fs";
import path from "path";

import {
  CMS_IMAGE_EXTENSION_SET,
  CMS_PDF_EXTENSION_SET,
  sanitizeCmsUploadFilename,
  validateCmsUploadFile,
} from "./media-intelligence/cms-upload-policy";
import {
  getMediaParentFolder,
  normalizeMediaFolder,
  resolvePublicFolder,
  type MediaAssetItem,
  type PublicMediaFolderListing,
} from "./media-library-paths";

const IMAGE_EXTENSIONS = CMS_IMAGE_EXTENSION_SET;
const PDF_EXTENSIONS = CMS_PDF_EXTENSION_SET;

function isImageFile(filename: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isPdfFile(filename: string) {
  return PDF_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function buildAssetItem(
  publicPath: string,
  filename: string,
  kind: "image" | "document",
  sizeBytes: number | null,
): MediaAssetItem {
  return {
    path: publicPath,
    filename,
    extension: path.extname(filename).toLowerCase(),
    kind,
    sizeBytes,
  };
}

function resolveReplaceDestination(normalized: string, target: string, replacePath?: string | null) {
  if (!replacePath?.trim()) return null;

  const trimmed = replacePath.trim();
  const relative = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (!relative.startsWith(`${normalized}/`)) return null;

  const destination = path.join(process.cwd(), "public", relative);
  const publicRoot = path.join(process.cwd(), "public");

  if (!destination.startsWith(publicRoot) || !fs.existsSync(destination)) {
    return null;
  }

  return destination;
}

export function listPublicMediaFolderFromFs(folder = "images"): PublicMediaFolderListing {
  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    return {
      folder: normalized,
      parentFolder: getMediaParentFolder(normalized),
      subfolders: [],
      images: [],
      documents: [],
      items: [],
    };
  }

  const entries = fs.readdirSync(target, { withFileTypes: true });
  const subfolders: string[] = [];
  const images: string[] = [];
  const documents: string[] = [];
  const items: MediaAssetItem[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subfolders.push(entry.name);
      continue;
    }

    if (!entry.isFile()) continue;

    const publicPath = `/${path.posix.join(normalized, entry.name)}`;
    let sizeBytes: number | null = null;
    try {
      sizeBytes = fs.statSync(path.join(target, entry.name)).size;
    } catch {
      sizeBytes = null;
    }

    if (isImageFile(entry.name)) {
      images.push(publicPath);
      items.push(buildAssetItem(publicPath, entry.name, "image", sizeBytes));
      continue;
    }

    if (isPdfFile(entry.name)) {
      documents.push(publicPath);
      items.push(buildAssetItem(publicPath, entry.name, "document", sizeBytes));
    }
  }

  return {
    folder: normalized,
    parentFolder: getMediaParentFolder(normalized),
    subfolders: subfolders.sort((a, b) => a.localeCompare(b)),
    images: images.sort((a, b) => a.localeCompare(b)),
    documents: documents.sort((a, b) => a.localeCompare(b)),
    items: items.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function listPublicImagePathsFromFs(folder = "images", limit = 240) {
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

export async function savePublicMediaUploadToFs(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  const validation = validateCmsUploadFile(file, "image");
  if (!validation.ok) throw new Error(validation.message);

  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const replaceDestination = resolveReplaceDestination(normalized, target, options?.replacePath);
  const filename = replaceDestination
    ? path.basename(replaceDestination)
    : sanitizeCmsUploadFilename(file.name, IMAGE_EXTENSIONS, "image");
  const destination = replaceDestination ?? path.join(target, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(destination, bytes);

  return {
    path: `/${path.posix.join(normalized, filename)}`,
    filename,
  };
}

export async function savePublicDocumentUploadToFs(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  const validation = validateCmsUploadFile(file, "pdf");
  if (!validation.ok) throw new Error(validation.message);

  const { normalized, target } = resolvePublicFolder(folder);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const replaceDestination = resolveReplaceDestination(normalized, target, options?.replacePath);
  const filename = replaceDestination
    ? path.basename(replaceDestination)
    : sanitizeCmsUploadFilename(file.name, PDF_EXTENSIONS, "document");
  const destination = replaceDestination ?? path.join(target, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(destination, bytes);

  return {
    path: `/${path.posix.join(normalized, filename)}`,
    filename,
  };
}
