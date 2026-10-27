export const VIDEO_PROVIDERS = [
  { value: "youtube", label: "YouTube", urlLabel: "رابط فيديو YouTube", urlPlaceholder: "https://www.youtube.com/watch?v=...", supportsStartTime: true, playbackMode: "embed", urlHint: "رابط watch أو youtu.be أو embed أو shorts لفيديو YouTube." },
  { value: "vimeo", label: "Vimeo", urlLabel: "رابط فيديو Vimeo", urlPlaceholder: "https://vimeo.com/...", supportsStartTime: true, playbackMode: "embed", urlHint: "رابط vimeo.com للفيديو أو player.vimeo.com/video؛ احتفظ برمز h للفيديو غير المدرج." },
  { value: "facebook", label: "Facebook", urlLabel: "رابط فيديو Facebook", urlPlaceholder: "https://www.facebook.com/watch?v=...", supportsStartTime: false, playbackMode: "external", metaEmbed: { endpoint: "https://graph.facebook.com/v25.0/oembed_video", sdkUrl: "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v25.0", minWidth: 220 }, urlHint: "رابط Facebook كامل بصيغة videos أو watch أو reel؛ يُفتح الفيديو من مصدره عند تعذر التضمين." },
  { value: "tiktok", label: "TikTok", urlLabel: "رابط فيديو TikTok", urlPlaceholder: "https://www.tiktok.com/@account/video/...", supportsStartTime: false, playbackMode: "embed", urlHint: "رابط TikTok الكامل بصيغة @account/video/ID؛ الروابط المختصرة غير مدعومة." },
  { value: "instagram", label: "Instagram", urlLabel: "رابط فيديو Instagram", urlPlaceholder: "https://www.instagram.com/reel/...", supportsStartTime: false, playbackMode: "external", metaEmbed: { endpoint: "https://graph.facebook.com/v25.0/instagram_oembed", sdkUrl: "https://www.instagram.com/embed.js", minWidth: 326 }, urlHint: "رابط Instagram Reels كامل؛ يُفتح الفيديو من مصدره عند تعذر التضمين. روابط المنشورات العامة غير مدعومة." },
  { value: "direct", label: "رابط فيديو مباشر", urlLabel: "رابط ملف الفيديو المباشر", urlPlaceholder: "https://example.com/video.mp4", supportsStartTime: true, playbackMode: "direct", urlHint: "رابط HTTPS عام لملف MP4 أو WebM أو OGV. يعتمد التشغيل على إتاحة الملف ودعم المتصفح." },
] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number]["value"];

export type MetaVideoProvider = "facebook" | "instagram";

/** A checked embed identity only. External HTML, scripts and metadata never cross this boundary. */
export type MetaVideoEmbedResult =
  | { status: "ready"; provider: MetaVideoProvider; sourceUrl: string }
  | { status: "unavailable"; reason: "unsupported" | "invalid_response" | "network" | "timeout" | "denied" };

export type MetaVideoEmbedRequest = {
  provider: MetaVideoProvider;
  sourceUrl: string;
  endpoint: string;
  sdkUrl: string;
  minWidth: number;
};

export function isVideoProvider(value: unknown): value is VideoProvider {
  return VIDEO_PROVIDERS.some((provider) => provider.value === value);
}

export type VideoMediaPayload = {
  kind: "video";
  provider: VideoProvider;
  video_url: string;
  thumbnail?: string | null;
  duration?: string | null;
  /** Omitted in legacy data and at zero; otherwise a nonnegative integer in seconds. */
  start_seconds?: number | null;
};

export type VideoPlayback = {
  provider: VideoProvider;
  sourceUrl: string;
  mode: "embed" | "direct" | "external";
  embedUrl: string | null;
  directUrl: string | null;
  portrait: boolean;
  // No unauthenticated metadata scraping or invented provider image fallback.
  posterUrl: null;
};

function isStartSeconds(value: unknown): value is number | null | undefined {
  return value === undefined || value === null ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

export function normalizeVideoStartSeconds(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number(trimmed);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

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
    isVideoProvider(value.provider) &&
    typeof value.video_url === "string" &&
    isOptionalNullableString(value.thumbnail) &&
    isOptionalNullableString(value.duration) &&
    isStartSeconds(value.start_seconds)
  ) {
    return {
      kind: "video",
      provider: value.provider,
      video_url: value.video_url,
      thumbnail: value.thumbnail ?? null,
      duration: value.duration ?? null,
      ...(value.start_seconds ? { start_seconds: value.start_seconds } : {}),
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

export function normalizeYouTubeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !YOUTUBE_HOSTS.has(host) ||
      url.username || url.password || url.port ||
      /[\u0000-\u001f\u007f]/.test(trimmed)
    ) return null;

    const shortLink = host === "youtu.be" || host === "www.youtu.be";
    const id = shortLink
      ? /^\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1]
      : /^\/watch\/?$/.test(url.pathname)
        ? url.searchParams.getAll("v").length === 1 ? url.searchParams.get("v") : null
        : /^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];

    // Keep the existing nonempty ID contract, including authored legacy IDs,
    // while rejecting routes or characters that cannot identify one video.
    return id && /^[A-Za-z0-9_-]+$/.test(id)
      ? `https://www.youtube.com/watch?v=${id}`
      : null;
  } catch {
    return null;
  }
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

function readVideoUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.port
      ? url
      : null;
  } catch {
    return null;
  }
}

function resolveVideoSource(provider: VideoProvider, raw: string): VideoPlayback | null {
  const url = readVideoUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const base = { provider, embedUrl: null, directUrl: null, portrait: false, posterUrl: null };

  if (provider === "youtube") {
    const sourceUrl = normalizeYouTubeUrl(raw);
    const embedUrl = resolveYouTubeEmbedUrl(raw);
    return sourceUrl && embedUrl ? { ...base, sourceUrl, embedUrl, mode: "embed" } : null;
  }

  if (provider === "vimeo") {
    const onPlayer = host === "player.vimeo.com";
    if (!onPlayer && host !== "vimeo.com" && host !== "www.vimeo.com") return null;
    const match = onPlayer
      ? /^\/video\/(\d+)\/?$/.exec(url.pathname)
      : /^\/(\d+)(?:\/([A-Za-z0-9]+))?\/?$/.exec(url.pathname);
    if (!match || /^0+$/.test(match[1]) || url.searchParams.getAll("h").length > 1) return null;
    const queryHash = url.searchParams.get("h");
    if (match[2] && queryHash && match[2] !== queryHash) return null;
    const hash = match[2] ?? queryHash;
    if (hash !== null && hash !== undefined && !/^[A-Za-z0-9]+$/.test(hash)) return null;
    const suffix = hash ? `?h=${hash}` : "";
    return { ...base, sourceUrl: `https://vimeo.com/${match[1]}${hash ? `/${hash}` : ""}`, embedUrl: `https://player.vimeo.com/video/${match[1]}${suffix}`, mode: "embed" };
  }

  if (provider === "facebook") {
    if (!["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"].includes(host)) return null;
    const watch = /^\/watch\/?$/.test(url.pathname) && url.searchParams.getAll("v").length === 1
      ? url.searchParams.get("v")
      : null;
    const reel = /^\/reel\/(\d+)\/?$/.exec(url.pathname);
    const video = /^\/(?:[A-Za-z0-9_.-]+\/)?videos\/(\d+)\/?$/.exec(url.pathname);
    const id = watch ?? reel?.[1] ?? video?.[1];
    if (!id || !/^[1-9]\d*$/.test(id)) return null;
    return { ...base, sourceUrl: reel ? `https://www.facebook.com/reel/${id}` : `https://www.facebook.com/watch?v=${id}`, portrait: Boolean(reel), mode: "external" };
  }

  if (provider === "tiktok") {
    if (host !== "tiktok.com" && host !== "www.tiktok.com") return null;
    const match = /^\/@([A-Za-z0-9_.]+)\/video\/([1-9]\d*)\/?$/.exec(url.pathname);
    if (!match) return null;
    return { ...base, sourceUrl: `https://www.tiktok.com/@${match[1]}/video/${match[2]}`, embedUrl: `https://www.tiktok.com/player/v1/${match[2]}?autoplay=0`, portrait: true, mode: "embed" };
  }

  if (provider === "instagram") {
    if (host !== "instagram.com" && host !== "www.instagram.com") return null;
    const match = /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    return { ...base, sourceUrl: `https://www.instagram.com/reel/${match[1]}/`, portrait: true, mode: "external" };
  }

  if (provider === "direct") {
    // Direct sources are browser-loaded public media files, never server-fetched URLs.
    // Require a DNS hostname rather than loopback, private or other literal addresses.
    if (url.protocol !== "https:" || !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(host) ||
      host.split(".").some((label) => !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) ||
      !/\.(?:mp4|webm|ogv)$/i.test(url.pathname)) return null;
    url.hash = "";
    const sourceUrl = url.toString();
    return { ...base, sourceUrl, directUrl: sourceUrl, mode: "direct" };
  }
  return null;
}

export function normalizeVideoUrl(provider: VideoProvider, raw: string): string | null {
  return resolveVideoSource(provider, raw)?.sourceUrl ?? null;
}

export function resolveMetaVideoEmbedRequest(
  payload: Pick<VideoMediaPayload, "provider" | "video_url">,
): MetaVideoEmbedRequest | null {
  if (!payload || (payload.provider !== "facebook" && payload.provider !== "instagram") ||
    typeof payload.video_url !== "string") return null;
  const sourceUrl = normalizeVideoUrl(payload.provider, payload.video_url);
  const provider = VIDEO_PROVIDERS.find((item) => item.value === payload.provider);
  return sourceUrl && sourceUrl.length <= 2_048 && provider && "metaEmbed" in provider
    ? { provider: payload.provider, sourceUrl, ...provider.metaEmbed }
    : null;
}

export function parseMetaVideoEmbedResponse(
  value: unknown,
  payload: Pick<VideoMediaPayload, "provider" | "video_url">,
): MetaVideoEmbedResult {
  const request = resolveMetaVideoEmbedRequest(payload);
  if (!request) return { status: "unavailable", reason: "unsupported" };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  const response = value as Record<string, unknown>;
  const providerName = request.provider === "facebook" ? "Facebook" : "Instagram";
  const providerUrl = `https://www.${request.provider}.com`;
  if (response.error) return { status: "unavailable", reason: "denied" };
  if (response.version !== "1.0" || response.provider_name !== providerName ||
    (response.provider_url !== providerUrl && response.provider_url !== `${providerUrl}/`) ||
    response.type !== (request.provider === "facebook" ? "video" : "rich") ||
    typeof response.html !== "string" || response.html.length > 65_536) {
    return { status: "unavailable", reason: "invalid_response" };
  }

  // Read only the identity attribute from the provider's expected container.
  // The returned markup, attributes, styles and scripts are never rendered.
  const container = request.provider === "facebook"
    ? /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bfb-video\b[^"']*["'][^>]*>/i
    : /<blockquote\b[^>]*\bclass\s*=\s*["'][^"']*\binstagram-media\b[^"']*["'][^>]*>/i;
  const openingTag = container.exec(response.html)?.[0];
  const attribute = request.provider === "facebook" ? "data-href" : "data-instgrm-permalink";
  const links = openingTag ? [...openingTag.matchAll(new RegExp(`\\s${attribute}\\s*=\\s*(["'])(.*?)\\1`, "gi"))] : [];
  const link = links.length === 1 ? links[0][2].replaceAll("&amp;", "&") : null;
  if (!link || normalizeVideoUrl(request.provider, link) !== request.sourceUrl) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  return { status: "ready", provider: request.provider, sourceUrl: request.sourceUrl };
}

export function resolveVideoPlayback(
  payload: Pick<VideoMediaPayload, "provider" | "video_url" | "start_seconds">,
): VideoPlayback | null {
  if (!isVideoProvider(payload.provider) || !isStartSeconds(payload.start_seconds)) return null;
  const start = payload.start_seconds ?? 0;
  const provider = VIDEO_PROVIDERS.find((item) => item.value === payload.provider);
  if (!provider || (start > 0 && !provider.supportsStartTime)) return null;
  const playback = resolveVideoSource(payload.provider, payload.video_url);
  if (!playback || !start) return playback;
  if (payload.provider === "youtube" && playback.embedUrl) {
    return { ...playback, embedUrl: `${playback.embedUrl}?start=${start}` };
  }
  if (payload.provider === "vimeo" && playback.embedUrl) {
    return { ...playback, embedUrl: `${playback.embedUrl}#t=${start}s` };
  }
  if (payload.provider === "direct" && playback.directUrl) {
    return { ...playback, directUrl: `${playback.directUrl}#t=${start}` };
  }
  return playback;
}

export function getVideoFormStructureIssue(formData: FormData): { field: string; message: string } | null {
  const provider = formData.has("video_provider") ? String(formData.get("video_provider")).trim() : "youtube";
  if (!isVideoProvider(provider)) return { field: "video_provider", message: "اختر مزود فيديو مدعومًا." };
  const start = normalizeVideoStartSeconds(formData.get("video_start_seconds"));
  if (start === null) {
    return { field: "video_start_seconds", message: "وقت البدء يجب أن يكون عددًا صحيحًا غير سالب بالثواني." };
  }
  if (start > 0 && !VIDEO_PROVIDERS.find((item) => item.value === provider)?.supportsStartTime) {
    return { field: "video_start_seconds", message: "مزود الفيديو المختار لا يدعم وقت بدء مخصصًا. استخدم صفرًا للبدء من البداية." };
  }
  return null;
}

export function parseVideoPayloadFromForm(formData: FormData): VideoMediaPayload | null {
  if (getVideoFormStructureIssue(formData)) return null;
  const rawProvider = formData.has("video_provider") ? String(formData.get("video_provider")).trim() : "youtube";
  if (!isVideoProvider(rawProvider)) return null;
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  const duration = String(formData.get("video_duration") ?? "").trim();
  const thumbnail = String(formData.get("video_thumbnail") ?? "").trim();
  const startSeconds = normalizeVideoStartSeconds(formData.get("video_start_seconds")) ?? 0;

  return {
    kind: "video",
    provider: rawProvider,
    video_url: videoUrl,
    thumbnail: thumbnail || null,
    duration: duration || null,
    ...(startSeconds > 0 ? { start_seconds: startSeconds } : {}),
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
  if (payload.kind !== "video" || !isVideoProvider(payload.provider) || !isStartSeconds(payload.start_seconds)) {
    return "بيانات الفيديو غير صالحة.";
  }

  if ((payload.start_seconds ?? 0) > 0 && !VIDEO_PROVIDERS.find((item) => item.value === payload.provider)?.supportsStartTime) {
    return "مزود الفيديو المختار لا يدعم وقت بدء مخصصًا.";
  }

  if (!options.published) return null;

  const normalized = normalizeVideoUrl(payload.provider, payload.video_url);
  if (!normalized) {
    return `رابط الفيديو غير صالح للمزود المختار. ${VIDEO_PROVIDERS.find((item) => item.value === payload.provider)?.urlHint ?? ""}`;
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
  const normalizedUrl = normalizeVideoUrl(payload.provider, payload.video_url);

  return {
    kind: "video",
    provider: payload.provider,
    video_url: normalizedUrl ?? payload.video_url.trim(),
    thumbnail: payload.thumbnail?.trim() || null,
    duration: payload.duration?.trim() || null,
    ...(payload.start_seconds ? { start_seconds: payload.start_seconds } : {}),
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
