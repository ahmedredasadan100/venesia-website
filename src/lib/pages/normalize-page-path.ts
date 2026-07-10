const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type NormalizePagePathSuccess = {
  ok: true;
  path: string;
};

export type NormalizePagePathFailure = {
  ok: false;
  error: string;
};

export type NormalizePagePathResult = NormalizePagePathSuccess | NormalizePagePathFailure;

function hasControlCharacters(value: string) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function isExternalOrProtocolInput(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return true;
  }

  if (value.includes("://")) {
    return true;
  }

  // Reject host-like input such as example.com/page
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) {
    return true;
  }

  return false;
}

/**
 * Normalizes and validates a CMS public path input.
 * Does not check reserved routes or database uniqueness.
 */
export function normalizePagePathInput(raw: string): NormalizePagePathResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: "مسار الصفحة مطلوب." };
  }

  if (hasControlCharacters(trimmed)) {
    return { ok: false, error: "المسار يحتوي على أحرف غير مسموحة." };
  }

  if (isExternalOrProtocolInput(trimmed)) {
    return { ok: false, error: "اكتب مسارًا داخليًا فقط، وليس رابطًا كاملاً." };
  }

  if (trimmed.includes("?")) {
    return { ok: false, error: "لا يمكن إضافة query string في مسار الصفحة." };
  }

  if (trimmed.includes("#")) {
    return { ok: false, error: "لا يمكن إضافة anchor (#) في مسار الصفحة." };
  }

  if (trimmed.includes("\\")) {
    return { ok: false, error: "المسار لا يقبل الشرطة المائلة للخلف (\\)." };
  }

  let value = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  value = value.replace(/\/+/g, "/");

  if (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }

  if (value === "/") {
    return {
      ok: false,
      error: "لا يمكن إنشاء صفحة للمسار الرئيسي من هنا. تعيين الصفحة الرئيسية مرحلة لاحقة.",
    };
  }

  const segments = value.split("/").filter(Boolean);

  if (!segments.length) {
    return { ok: false, error: "مسار الصفحة غير صالح." };
  }

  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      return { ok: false, error: "المسار لا يقبل . أو .. كجزء من العنوان." };
    }

    const lower = segment.toLowerCase();

    if (!SEGMENT_PATTERN.test(lower)) {
      return {
        ok: false,
        error:
          "كل جزء في المسار يقبل حروفًا إنجليزية صغيرة وأرقام وشرطة (-) فقط، مثل: our-vision أو company-profile.",
      };
    }

    normalizedSegments.push(lower);
  }

  return { ok: true, path: `/${normalizedSegments.join("/")}` };
}

/**
 * Converts App Router catch-all segments into a normalized public path.
 */
export function resolvePublicPathFromSlugSegments(segments: string[]): NormalizePagePathResult {
  if (!segments.length) {
    return { ok: false, error: "مسار الصفحة غير صالح." };
  }

  const decodedSegments = segments.map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

  return normalizePagePathInput(`/${decodedSegments.join("/")}`);
}

/**
 * Derives the internal pages.slug from a normalized public path.
 * Example: /company/our-vision → company-our-vision
 */
export function generatePageSlugFromPath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .join("-");
}
