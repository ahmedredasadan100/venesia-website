export type VideoMediaPayload = {
  kind: "video";
  provider: "youtube";
  video_url: string;
  thumbnail?: string | null;
  duration?: string | null;
};

export type GalleryImageItem = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

export type GalleryMediaPayload = {
  kind: "gallery";
  images: GalleryImageItem[];
};

export type MediaTopicPayload = VideoMediaPayload | GalleryMediaPayload;

export type RichMediaContentType = "video" | "gallery";

function isJsonObject(
  value: Json | undefined,
): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalNullableString(
  value: Json | undefined,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

/**
 * Narrows the Database JSON wire contract to the canonical media payload.
 * Invalid persisted JSON fails closed instead of being asserted as domain data.
 */
export function parseMediaTopicPayload(value: Json | undefined): MediaTopicPayload | null {
  if (!isJsonObject(value)) return null;

  if (
    value.kind === "video" &&
    value.provider === "youtube" &&
    typeof value.video_url === "string" &&
    isOptionalNullableString(value.thumbnail) &&
    isOptionalNullableString(value.duration)
  ) {
    return {
      kind: "video",
      provider: "youtube",
      video_url: value.video_url,
      thumbnail: value.thumbnail ?? null,
      duration: value.duration ?? null,
    };
  }

  if (value.kind !== "gallery" || !Array.isArray(value.images)) return null;

  const images: GalleryImageItem[] = [];
  for (const item of value.images) {
    if (
      !isJsonObject(item) ||
      typeof item.url !== "string" ||
      !isOptionalNullableString(item.alt) ||
      !isOptionalNullableString(item.caption)
    ) {
      return null;
    }
    images.push({
      url: item.url,
      alt: item.alt ?? null,
      caption: item.caption ?? null,
    });
  }

  return {
    kind: "gallery",
    images,
  };
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

export function isRichMediaContentType(contentType: string): contentType is RichMediaContentType {
  return contentType === "video" || contentType === "gallery";
}

export function normalizeYouTubeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/watch?v=${id}` : null;
    }

    if (host.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/watch?v=${id}` : null;
      }

      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://www.youtube.com/watch?v=${id}` : null;
      }

      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://www.youtube.com/watch?v=${id}` : null;
      }
    }

    if (YOUTUBE_HOSTS.has(host) || host.endsWith("youtube.com")) {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveYouTubeEmbedUrl(raw: string): string | null {
  const normalized = normalizeYouTubeUrl(raw);
  if (!normalized) return null;

  try {
    const id = new URL(normalized).searchParams.get("v")?.trim();
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

export function parseVideoPayloadFromForm(formData: FormData): VideoMediaPayload {
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  const duration = String(formData.get("video_duration") ?? "").trim();
  const thumbnail = String(formData.get("video_thumbnail") ?? "").trim();

  return {
    kind: "video",
    provider: "youtube",
    video_url: videoUrl,
    thumbnail: thumbnail || null,
    duration: duration || null,
  };
}

export function parseGalleryPayloadFromForm(formData: FormData): GalleryMediaPayload {
  const urls = formData.getAll("gallery_image_url").map(String);
  const alts = formData.getAll("gallery_image_alt").map(String);
  const captions = formData.getAll("gallery_image_caption").map(String);

  const images = urls
    .map((url, index) => ({
      url: url.trim(),
      alt: (alts[index] ?? "").trim() || null,
      caption: (captions[index] ?? "").trim() || null,
    }))
    .filter((item) => item.url.length > 0);

  return {
    kind: "gallery",
    images,
  };
}

export function validateVideoPayload(
  payload: VideoMediaPayload,
  options: { published: boolean },
): string | null {
  if (payload.kind !== "video" || payload.provider !== "youtube") {
    return "بيانات الفيديو غير صالحة.";
  }

  if (!options.published) return null;

  const normalized = normalizeYouTubeUrl(payload.video_url);
  if (!normalized) {
    return "رابط YouTube غير صالح. استخدم رابط watch أو youtu.be.";
  }

  return null;
}

export function validateGalleryPayload(
  payload: GalleryMediaPayload,
  options: { published: boolean },
): string | null {
  if (payload.kind !== "gallery") {
    return "بيانات معرض الصور غير صالحة.";
  }

  if (!options.published) return null;

  if (payload.images.length === 0) {
    return "أضف صورة واحدة على الأقل لمعرض الصور قبل النشر.";
  }

  return null;
}

export function assertPayloadMatchesContentType(
  contentType: string,
  payload: MediaTopicPayload | null,
): string | null {
  if (contentType === "video") {
    if (!payload || payload.kind !== "video") {
      return "بيانات الفيديو مطلوبة لهذا النوع.";
    }
    return null;
  }

  if (contentType === "gallery") {
    if (!payload || payload.kind !== "gallery") {
      return "بيانات معرض الصور مطلوبة لهذا النوع.";
    }
    return null;
  }

  if (payload) {
    return "لا يمكن حفظ media_payload لهذا النوع من المحتوى.";
  }

  return null;
}

export function normalizeVideoPayloadForStorage(payload: VideoMediaPayload): VideoMediaPayload {
  const normalizedUrl = normalizeYouTubeUrl(payload.video_url);

  return {
    kind: "video",
    provider: "youtube",
    video_url: normalizedUrl ?? payload.video_url.trim(),
    thumbnail: payload.thumbnail?.trim() || null,
    duration: payload.duration?.trim() || null,
  };
}

export function resolveCoverImageForGallery(coverImage: string, payload: GalleryMediaPayload) {
  if (coverImage.trim()) return coverImage.trim();
  return payload.images[0]?.url?.trim() ?? "";
}

export function resolveCoverImageForVideo(coverImage: string, payload: VideoMediaPayload) {
  if (coverImage.trim()) return coverImage.trim();
  return payload.thumbnail?.trim() ?? "";
}

export function parseMediaPayloadFromForm(
  contentType: string,
  formData: FormData,
): MediaTopicPayload | null {
  if (contentType === "video") {
    return parseVideoPayloadFromForm(formData);
  }

  if (contentType === "gallery") {
    return parseGalleryPayloadFromForm(formData);
  }

  return null;
}
import type { Json } from "../database.types";
