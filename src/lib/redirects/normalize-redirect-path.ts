export type NormalizedPathResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeInternalRedirectPath(raw: string): NormalizedPathResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "المسار مطلوب." };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return { ok: false, error: "استخدم مسارًا داخليًا يبدأ بـ / أو عنوان URL كامل للوجهة فقط." };
  }

  let path = trimmed;
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  path = path
    .split("/")
    .map((segment) => decodePathSegment(segment))
    .join("/");

  path = path.replace(/\/{2,}/g, "/");

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (path.includes("..")) {
    return { ok: false, error: "المسار غير صالح." };
  }

  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(path)) {
    return { ok: false, error: "المسار يحتوي على أحرف غير مسموحة." };
  }

  return { ok: true, value: path };
}

export type NormalizedDestinationResult =
  | { ok: true; kind: "internal"; value: string }
  | { ok: true; kind: "external"; value: string }
  | { ok: false; error: string };

const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeRedirectDestination(raw: string): NormalizedDestinationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "الوجهة مطلوبة." };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, error: "عنوان URL للوجهة غير صالح." };
    }

    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)) {
      return { ok: false, error: "بروتوكول الوجهة غير آمن أو غير مدعوم." };
    }

    return { ok: true, kind: "external", value: url.toString() };
  }

  const internal = normalizeInternalRedirectPath(trimmed);
  if (!internal.ok) {
    return internal;
  }

  return { ok: true, kind: "internal", value: internal.value };
}
