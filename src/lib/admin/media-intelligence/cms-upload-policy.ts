export const CMS_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"] as const;
export const CMS_PDF_EXTENSIONS = [".pdf"] as const;

export const CMS_IMAGE_EXTENSION_SET = new Set<string>(CMS_IMAGE_EXTENSIONS);
export const CMS_PDF_EXTENSION_SET = new Set<string>(CMS_PDF_EXTENSIONS);

export const CMS_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CMS_MAX_PDF_BYTES = 12 * 1024 * 1024;

export const CMS_IMAGE_ACCEPT = CMS_IMAGE_EXTENSIONS.join(",");
export const CMS_PDF_ACCEPT = "application/pdf,.pdf";

const CMS_IMAGE_MIME_BY_EXTENSION: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".avif": ["image/avif"],
};

const CMS_PDF_MIME_TYPES = new Set(["application/pdf"]);

export type CmsUploadKind = "image" | "pdf";

export type CmsUploadValidationPolicy = {
  maxImageBytes?: number;
  maxPdfBytes?: number;
  allowedImageExtensions?: readonly string[];
  allowedPdfExtensions?: readonly string[];
  mimeVerification?: boolean;
};

export function getExtension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function resolveCmsUploadKind(filename: string, mimeType = "", explicitKind?: string | null): CmsUploadKind {
  if (explicitKind === "pdf") return "pdf";
  const ext = getExtension(filename);
  if (CMS_PDF_EXTENSION_SET.has(ext)) return "pdf";
  if (mimeType && CMS_PDF_MIME_TYPES.has(mimeType.toLowerCase())) return "pdf";
  return "image";
}

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} ميجابايت`;
}

function validateMimeForExtension(ext: string, mimeType: string, kind: CmsUploadKind) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!normalizedMime || normalizedMime === "application/octet-stream") return null;

  if (kind === "pdf") {
    return CMS_PDF_MIME_TYPES.has(normalizedMime)
      ? null
      : "نوع الملف غير مطابق — يُقبل PDF فقط.";
  }

  const allowed = CMS_IMAGE_MIME_BY_EXTENSION[ext];
  if (!allowed?.includes(normalizedMime)) {
    return "امتداد الملف ونوعه غير متطابقين. ارفع صورة JPG أو PNG أو WEBP أو GIF أو AVIF فقط.";
  }

  return null;
}

export function validateCmsUploadFile(
  file: Pick<File, "name" | "type" | "size">,
  kind?: CmsUploadKind,
  policy: CmsUploadValidationPolicy = {},
): { ok: true; kind: CmsUploadKind } | { ok: false; message: string } {
  if (!file.size) {
    return { ok: false, message: "الملف فارغ — اختر ملفًا صالحًا." };
  }

  const resolvedKind = kind ?? resolveCmsUploadKind(file.name, file.type);
  const ext = getExtension(file.name);
  const allowedExtensions = new Set(
    resolvedKind === "pdf"
      ? (policy.allowedPdfExtensions ?? CMS_PDF_EXTENSIONS)
      : (policy.allowedImageExtensions ?? CMS_IMAGE_EXTENSIONS),
  );

  if (!allowedExtensions.has(ext)) {
    if (ext === ".svg") {
      return {
        ok: false,
        message: "ملفات SVG غير مسموحة في رفع المحتوى. استخدم JPG أو PNG أو WEBP أو GIF أو AVIF.",
      };
    }

    return resolvedKind === "pdf"
      ? { ok: false, message: "امتداد غير مدعوم — يُقبل PDF فقط." }
      : {
          ok: false,
          message: "امتداد غير مدعوم — الصور المسموحة: JPG, PNG, WEBP, GIF, AVIF.",
        };
  }

  const maxBytes =
    resolvedKind === "pdf"
      ? (policy.maxPdfBytes ?? CMS_MAX_PDF_BYTES)
      : (policy.maxImageBytes ?? CMS_MAX_IMAGE_BYTES);
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `حجم الملف أكبر من الحد المسموح (${formatMegabytes(maxBytes)}).`,
    };
  }

  const mimeError = policy.mimeVerification === false ? null : validateMimeForExtension(ext, file.type, resolvedKind);
  if (mimeError) {
    return { ok: false, message: mimeError };
  }

  return { ok: true, kind: resolvedKind };
}

export function sanitizeCmsUploadFilename(
  filename: string,
  allowedExtensions: Set<string>,
  fallbackStem: string,
) {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const ext = getExtension(base);
  const stem = base
    .slice(0, base.length - ext.length)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!allowedExtensions.has(ext)) {
    throw new Error("امتداد الملف غير مدعوم.");
  }

  return `${stem || fallbackStem}-${Date.now()}${ext}`;
}
