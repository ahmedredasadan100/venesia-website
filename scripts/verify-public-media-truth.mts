import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeYouTubeUrl,
  normalizeVideoUrl,
  normalizeVideoStartSeconds,
  normalizeVideoPayloadForStorage,
  parseMetaVideoEmbedResponse,
  resolveMetaVideoEmbedRequest,
  getVideoFormStructureIssue,
  VIDEO_PROVIDERS,
  parseMediaTopicPayload,
  parseVideoPayloadFromForm,
  resolveVideoPlayback,
  resolveYouTubeEmbedUrl,
  validateVideoPayload,
  type VideoProvider,
} from "../src/lib/admin/media-topic-payload.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

assert.equal(normalizeYouTubeUrl(""), null, "Blank video data must stay blank");
assert.equal(normalizeYouTubeUrl("https://example.com/not-video"), null, "Non-YouTube URLs must fail closed");
assert.equal(
  normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
);
assert.equal(
  resolveYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
);
assert.equal(resolveYouTubeEmbedUrl("not a URL"), null, "Invalid playback links must not create an iframe URL");

const canonicalVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const canonicalEmbedUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ";
for (const url of [
  canonicalVideoUrl,
  "http://youtube.com/watch?v=dQw4w9WgXcQ",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
  "www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://YOUTUBE.com/watch/?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://www.youtu.be/dQw4w9WgXcQ/",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ/",
  " https://youtu.be/dQw4w9WgXcQ?t=90 ",
]) {
  const payload = { kind: "video", provider: "youtube", video_url: url, thumbnail: " /poster.jpg ", duration: " custom-duration " } as const;
  assert.equal(normalizeYouTubeUrl(url), canonicalVideoUrl, `A supported YouTube URL must canonicalize: ${url}`);
  assert.equal(resolveYouTubeEmbedUrl(url), canonicalEmbedUrl, `Accepted video data must always resolve to the canonical iframe: ${url}`);
  assert.equal(validateVideoPayload(payload, { published: true }), null, `A supported YouTube URL must remain publishable: ${url}`);
  assert.deepEqual(normalizeVideoPayloadForStorage(payload), {
    kind: "video", provider: "youtube", video_url: canonicalVideoUrl, thumbnail: "/poster.jpg", duration: "custom-duration",
  }, "Canonical storage must preserve the existing provider, thumbnail and free-text duration contracts without adding playback-time state");
}

for (const url of [
  "",
  "https://youtube.com",
  "https://www.youtube.com/channel/dQw4w9WgXcQ",
  "https://www.youtube.com/@channel?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch",
  "https://www.youtube.com/watch?v=",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=other",
  "https://www.youtube.com/watch?v=invalid%20id",
  "https://www.youtube.com/watch?v=invalid%2Fid",
  "https://www.youtube.com/watch?v=invalid%26id",
  "https://www.youtube.com/embed/dQw4w9WgXcQ/extra",
  "https://www.youtube.com/shorts/",
  "https://youtu.be/dQw4w9WgXcQ/extra",
  "https://youtu.be/invalid%20id",
  "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com.example.org/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ",
  "https://user:secret@www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://user@youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com:8080/watch?v=dQw4w9WgXcQ",
  "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "javascript:alert(1)",
  "https://vimeo.com/123456789",
  "https://www.youtube.com/watch?v=invalid\nid",
]) {
  const payload = { kind: "video", provider: "youtube", video_url: url, duration: "3:45" } as const;
  assert.equal(normalizeYouTubeUrl(url), null, `An unsupported URL must fail at the shared public boundary: ${url}`);
  assert.equal(resolveYouTubeEmbedUrl(url), null, `An unsupported URL must never create an iframe: ${url}`);
  assert.ok(validateVideoPayload(payload, { published: true }), `An unsupported URL must block publishing: ${url}`);
  assert.equal(validateVideoPayload(payload, { published: false }), null, "Incomplete drafts must remain permitted under the existing contract");
  assert.equal(normalizeVideoPayloadForStorage(payload).video_url, url.trim(), "Draft storage must retain authored invalid URLs for correction, without data repair");
}

for (const id of ["qa", "valid-video-id", "legacy_ID-1"]) {
  assert.equal(normalizeYouTubeUrl(`https://youtu.be/${id}`), `https://www.youtube.com/watch?v=${id}`, "Safe legacy identifiers must not gain an unrelated fixed-length validation rule");
}
const videoForm = new FormData();
videoForm.set("video_url", "https://youtu.be/dQw4w9WgXcQ");
videoForm.set("video_duration", "legacy-free-text");
videoForm.set("video_thumbnail", "/poster.jpg");
videoForm.set("video_provider", "vimeo");
assert.deepEqual(parseVideoPayloadFromForm(videoForm), {
  kind: "video", provider: "vimeo", video_url: "https://youtu.be/dQw4w9WgXcQ", duration: "legacy-free-text", thumbnail: "/poster.jpg",
}, "The existing parser binds the chosen provider and retains an authored draft URL and legacy duration");
assert.deepEqual(parseVideoPayloadFromForm(new FormData()), {
  kind: "video", provider: "youtube", video_url: "", duration: null, thumbnail: null,
}, "Create defaults must remain an optional empty YouTube draft");
console.log("PASS YouTube URL contract: supported watch/short/embed forms, fail-closed publication and playback, permissive drafts, canonical storage and preserved legacy values.");

const providerCases: Array<{ provider: VideoProvider; url: string; normalized: string; mode: "embed" | "direct" | "external"; portrait?: boolean }> = [
  { provider: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", normalized: canonicalVideoUrl, mode: "embed" },
  { provider: "vimeo", url: "https://player.vimeo.com/video/76979871?h=a1b2c3", normalized: "https://vimeo.com/76979871/a1b2c3", mode: "embed" },
  { provider: "facebook", url: "https://m.facebook.com/Venesia/videos/123456789/", normalized: "https://www.facebook.com/watch?v=123456789", mode: "external" },
  { provider: "tiktok", url: "https://www.tiktok.com/@venesia/video/1234567890123456789?is_from_webapp=1", normalized: "https://www.tiktok.com/@venesia/video/1234567890123456789", mode: "embed", portrait: true },
  { provider: "instagram", url: "https://www.instagram.com/reel/ABC_def-123/?igsh=tracking", normalized: "https://www.instagram.com/reel/ABC_def-123/", mode: "external", portrait: true },
  { provider: "direct", url: "https://cdn.example.com/assets/film.mp4?token=signed%2Bvalue#t=20", normalized: "https://cdn.example.com/assets/film.mp4?token=signed%2Bvalue", mode: "direct" },
];
assert.deepEqual(providerCases.map((item) => item.provider), VIDEO_PROVIDERS.map((item) => item.value), "Every selectable provider has a tested canonical path");
for (const example of providerCases) {
  const supportsStart = VIDEO_PROVIDERS.find((item) => item.value === example.provider)!.supportsStartTime;
  const form = new FormData();
  form.set("video_provider", example.provider);
  form.set("video_url", example.url);
  form.set("video_thumbnail", " /manual-poster.jpg ");
  form.set("video_duration", " legacy-free-text ");
  form.set("video_start_seconds", supportsStart ? "17" : "0");
  assert.equal(getVideoFormStructureIssue(form), null);
  const parsed = parseVideoPayloadFromForm(form);
  assert.ok(parsed, `${example.provider}: native form values must parse`);
  const stored = normalizeVideoPayloadForStorage(parsed);
  assert.equal(stored.provider, example.provider);
  assert.equal(stored.video_url, example.normalized);
  assert.equal(stored.duration, "legacy-free-text", `${example.provider}: old duration remains authored data`);
  assert.equal(stored.thumbnail, "/manual-poster.jpg");
  assert.equal(stored.start_seconds, supportsStart ? 17 : undefined);
  assert.deepEqual(parseMediaTopicPayload(JSON.parse(JSON.stringify(stored))), stored, `${example.provider}: existing JSON wire round-trip preserves the complete payload`);
  assert.equal(validateVideoPayload(stored, { published: true }), null);
  const playback = resolveVideoPlayback(stored);
  assert.ok(playback, `${example.provider}: accepted publication must resolve honest playback/source output`);
  assert.equal(playback.mode, example.mode);
  assert.equal(playback.sourceUrl, example.normalized);
  assert.equal(playback.portrait, Boolean(example.portrait));
  assert.equal(playback.posterUrl, null, "No invented or scraped provider cover is exposed");
  assert.equal(Boolean(playback.embedUrl), example.mode === "embed");
  assert.equal(Boolean(playback.directUrl), example.mode === "direct");
  if (example.provider === "youtube") assert.equal(playback.embedUrl, `${canonicalEmbedUrl}?start=17`);
  if (example.provider === "vimeo") assert.equal(playback.embedUrl, "https://player.vimeo.com/video/76979871?h=a1b2c3#t=17s");
  if (example.provider === "direct") assert.equal(playback.directUrl, `${example.normalized}#t=17`);
  if (example.provider === "tiktok") assert.equal(playback.embedUrl, "https://www.tiktok.com/player/v1/1234567890123456789?autoplay=0");
  assert.equal(normalizeVideoUrl(example.provider, example.url), example.normalized);
  for (const invalidUrl of ["javascript:alert(1)", "https://notyoutube.com/watch?v=123", "https://user:secret@www.vimeo.com/123", "https://example.org/not-a-video"]) {
    const invalid = { ...stored, video_url: invalidUrl };
    assert.equal(normalizeVideoUrl(example.provider, invalidUrl), null);
    assert.equal(resolveVideoPlayback(invalid), null);
    assert.ok(validateVideoPayload(invalid, { published: true }), `${example.provider}: invalid URLs block publication`);
    assert.equal(validateVideoPayload(invalid, { published: false }), null, `${example.provider}: incomplete authored draft URLs remain correctable`);
    assert.equal(normalizeVideoPayloadForStorage(invalid).video_url, invalidUrl);
  }
  if (!supportsStart) {
    form.set("video_start_seconds", "17");
    assert.equal(getVideoFormStructureIssue(form)?.field, "video_start_seconds");
    assert.equal(parseVideoPayloadFromForm(form), null);
    assert.equal(resolveVideoPlayback({ ...stored, start_seconds: 17 }), null);
    assert.ok(validateVideoPayload({ ...stored, start_seconds: 17 }, { published: false }), "Unsupported start time cannot silently enter draft persistence");
  }
}
for (const [provider, url] of [
  ["vimeo", "https://vimeo.com/76979871/a1b2c3"],
  ["vimeo", "https://vimeo.com/76979871?h=a1b2c3"],
  ["facebook", "https://www.facebook.com/watch/?v=123456789"],
  ["facebook", "https://www.facebook.com/reel/123456789"],
  ["instagram", "https://instagram.com/reels/ABC_def-123/"],
  ["direct", "https://cdn.example.com/film.WEBM"],
  ["direct", "https://cdn.example.com/film.ogv?download=1"],
] as const) assert.ok(normalizeVideoUrl(provider, url), `Supported ${provider} form: ${url}`);
for (const [provider, urls] of [
  ["vimeo", ["https://notvimeo.com/123", "https://vimeo.com/channels/staffpicks", "https://vimeo.com/0", "https://vimeo.com/123?h=a&h=b", "https://vimeo.com/123/a?h=b", "https://player.vimeo.com/video/123/extra"]],
  ["facebook", ["https://notfacebook.com/watch?v=123", "https://facebook.com/PageName", "https://facebook.com/watch?v=123&v=456", "https://fb.watch/ambiguous", "https://facebook.com/share/v/ambiguous", "https://facebook.com/reel/0"]],
  ["tiktok", ["https://nottiktok.com/@name/video/123", "https://www.tiktok.com/@name", "https://www.tiktok.com/@name/photo/123", "https://vm.tiktok.com/ambiguous", "https://www.tiktok.com/@name/video/0"]],
  ["instagram", ["https://notinstagram.com/reel/ABC", "https://instagram.com/name", "https://instagram.com/p/ABC/", "https://instagram.com/stories/name/123", "https://instagram.com/reel/ABC/extra"]],
  ["direct", ["http://cdn.example.com/film.mp4", "https://localhost/film.mp4", "https://127.0.0.1/film.mp4", "https://169.254.169.254/film.mp4", "https://[::1]/film.mp4", "https://media.local/film.mp4", "https://cdn.example.com/image.jpg", "https://cdn.example.com/film.mp4/extra", "https://user:secret@cdn.example.com/film.mp4", "https://cdn.example.com:8443/film.mp4", "data:video/mp4;base64,AAAA", "https://cdn..example.com/film.mp4"]],
] as Array<[VideoProvider, string[]]>) {
  for (const url of urls) assert.equal(normalizeVideoUrl(provider, url), null, `${provider} rejects ambiguous or unsafe URL ${url}`);
}
for (const input of ["-1", "1.5", "1e2", "NaN", "Infinity", "9007199254740992", -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, true, {}]) {
  assert.equal(normalizeVideoStartSeconds(input), null, `Invalid start value ${String(input)} rejects`);
}
for (const [input, seconds] of [[undefined, 0], [null, 0], ["", 0], [" 0 ", 0], ["0017", 17], [17, 17]] as const) assert.equal(normalizeVideoStartSeconds(input), seconds);
const structuralForm = new FormData();
for (const provider of ["constructor", "__proto__", "unsupported", ""]) {
  structuralForm.set("video_provider", provider);
  assert.equal(getVideoFormStructureIssue(structuralForm)?.field, "video_provider");
  assert.equal(parseVideoPayloadFromForm(structuralForm), null);
}
structuralForm.set("video_provider", "youtube");
for (const value of ["-1", "1e2", "1.5", "9007199254740992"]) {
  structuralForm.set("video_start_seconds", value);
  assert.equal(getVideoFormStructureIssue(structuralForm)?.field, "video_start_seconds");
  assert.equal(parseVideoPayloadFromForm(structuralForm), null);
}
for (const start of [-1, 1.5, "17", Number.NaN, true]) {
  assert.equal(parseMediaTopicPayload({ kind: "video", provider: "youtube", video_url: canonicalVideoUrl, start_seconds: start }), null, "Malformed persisted start data fails closed");
}
assert.equal(parseMediaTopicPayload({ kind: "video", provider: "unknown", video_url: canonicalVideoUrl }), null);
assert.deepEqual(normalizeVideoPayloadForStorage({ kind: "video", provider: "youtube", video_url: canonicalVideoUrl, start_seconds: 0 }), { kind: "video", provider: "youtube", video_url: canonicalVideoUrl, duration: null, thumbnail: null }, "Zero start leaves the legacy wire shape intact");
console.log("PASS six-provider native form / JSON / draft / publish / playback contracts, provider-aware start seconds, direct URL safety, external-only Meta and preserved legacy duration.");
const facebookEmbedPayload = { provider: "facebook", video_url: "https://m.facebook.com/Meta/videos/10153231379946729/?tracking=1" } as const;
const instagramEmbedPayload = { provider: "instagram", video_url: "https://instagram.com/reel/DGOSAUyC903/?igsh=tracking" } as const;
const facebookEmbedResponse = {
  version: "1.0", provider_name: "Facebook", provider_url: "https://www.facebook.com/", type: "video",
  html: '<div class="fb-video" data-href="https://www.facebook.com/watch?v=10153231379946729"></div>',
};
const instagramEmbedResponse = {
  version: "1.0", provider_name: "Instagram", provider_url: "https://www.instagram.com", type: "rich",
  html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/DGOSAUyC903/?utm_source=ig_embed&amp;utm_campaign=loading"></blockquote>',
};
for (const [payload, response, endpoint, sdkUrl, minWidth] of [
  [facebookEmbedPayload, facebookEmbedResponse, "https://graph.facebook.com/v25.0/oembed_video", "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v25.0", 220],
  [instagramEmbedPayload, instagramEmbedResponse, "https://graph.facebook.com/v25.0/instagram_oembed", "https://www.instagram.com/embed.js", 326],
] as const) {
  const request = resolveMetaVideoEmbedRequest(payload);
  assert.ok(request);
  assert.deepEqual(request, { provider: payload.provider, sourceUrl: normalizeVideoUrl(payload.provider, payload.video_url), endpoint, sdkUrl, minWidth });
  const ready = { status: "ready", provider: payload.provider, sourceUrl: request.sourceUrl };
  assert.deepEqual(parseMetaVideoEmbedResponse(response, payload), ready);
  assert.deepEqual(parseMetaVideoEmbedResponse({ ...response, title: "untrusted title", thumbnail_url: "https://evil.test/tracker", html: `${response.html}<script>alert(1)</script>` }, payload), ready, "Only canonical identity survives; external markup, scripts and metadata never enter the render result");
  for (const invalid of [null, [], "<html>Login</html>", {}, { ...response, version: "2.0" }, { ...response, provider_name: "Other" }, { ...response, provider_url: "https://www.facebook.com.evil.test" }, { ...response, type: "link" }, { ...response, html: "<script>alert(1)</script>" }, { ...response, html: "x".repeat(65_537) }, { ...response, html: response.html.replace(request.sourceUrl.split("?")[0], "https://evil.test/") }]) {
    assert.deepEqual(parseMetaVideoEmbedResponse(invalid, payload), { status: "unavailable", reason: "invalid_response" }, `${payload.provider}: malformed or mismatched official response fails closed`);
  }
  assert.deepEqual(parseMetaVideoEmbedResponse({ error: { message: "Not embeddable" } }, payload), { status: "unavailable", reason: "denied" });
}
for (const payload of [
  { provider: "youtube", video_url: canonicalVideoUrl },
  { provider: "facebook", video_url: "https://www.facebook.com/share/v/short" },
  { provider: "facebook", video_url: "https://facebook.com.evil.test/reel/123" },
  { provider: "instagram", video_url: "https://www.instagram.com/p/DGOSAUyC903/" },
  { provider: "instagram", video_url: `https://www.instagram.com/reel/${"x".repeat(2_049)}/` },
] as const) {
  assert.equal(resolveMetaVideoEmbedRequest(payload), null, "Only current canonical Meta video/reel paths can issue an official request");
  assert.deepEqual(parseMetaVideoEmbedResponse(facebookEmbedResponse, payload), { status: "unavailable", reason: "unsupported" });
}
assert.deepEqual(parseMetaVideoEmbedResponse({ ...facebookEmbedResponse, html: '<div class="fb-video" data-href="https://www.facebook.com/watch?v=10153231379946729" data-href="https://evil.test/"></div>' }, facebookEmbedPayload), { status: "unavailable", reason: "invalid_response" }, "Ambiguous identity attributes fail closed");
assert.deepEqual(parseMetaVideoEmbedResponse({ ...instagramEmbedResponse, html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/tv/DGOSAUyC903/"></blockquote>' }, instagramEmbedPayload), { status: "unavailable", reason: "invalid_response" }, "A Reel response cannot silently change to a different unsupported media route");
console.log("PASS Meta official oEmbed request boundaries, canonical identities, strict response narrowing and discarded untrusted HTML/metadata.");
for (const unlistedUrl of ["https://vimeo.com/76979871/a1b2c3", "https://vimeo.com/76979871?h=a1b2c3", "https://player.vimeo.com/video/76979871?h=a1b2c3"]) {
  const canonical = normalizeVideoUrl("vimeo", unlistedUrl);
  assert.equal(canonical, "https://vimeo.com/76979871/a1b2c3", "The source action keeps a full unlisted sharing link, separate from the embed h parameter");
  assert.equal(normalizeVideoUrl("vimeo", canonical!), canonical, "Unlisted canonical storage remains idempotent");
  assert.equal(resolveVideoPlayback({ provider: "vimeo", video_url: canonical!, start_seconds: 17 })?.embedUrl, "https://player.vimeo.com/video/76979871?h=a1b2c3#t=17s", "Embed privacy token and playback time survive source-link normalization");
}
assert.deepEqual(
  parseMediaTopicPayload({
    kind: "video",
    provider: "youtube",
    video_url: "https://youtu.be/dQw4w9WgXcQ",
    duration: "3:32",
  }),
  {
    kind: "video",
    provider: "youtube",
    video_url: "https://youtu.be/dQw4w9WgXcQ",
    thumbnail: null,
    duration: "3:32",
  },
);
assert.equal(
  parseMediaTopicPayload({ kind: "video", provider: "youtube", video_url: 42 }),
  null,
  "Malformed Database JSON must fail closed before reaching public media consumers",
);
assert.deepEqual(
  parseMediaTopicPayload({
    kind: "gallery",
    images: [
      { url: "/valid.jpg", alt: "Valid" },
      { url: 42, alt: "Invalid" },
    ],
  }),
  null,
  "A malformed Gallery item must reject the complete Database JSON payload",
);
assert.equal(
  parseMediaTopicPayload({
    kind: "video",
    provider: "youtube",
    video_url: "https://youtu.be/dQw4w9WgXcQ",
    thumbnail: 42,
  }),
  null,
  "Malformed optional Video fields must reject the complete Database JSON payload",
);
assert.equal(
  parseMediaTopicPayload({
    kind: "gallery",
    images: [{ url: "/valid.jpg", alt: 42 }],
  }),
  null,
  "Malformed optional Gallery fields must reject the complete Database JSON payload",
);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

for (const removedOwner of [
  "src/lib/media-center/legacy-provider.ts",
  "src/lib/media-center/source.ts",
  "src/lib/media-center/content-type-map.ts",
]) {
  assert.equal(existsSync(resolve(ROOT, removedOwner)), false, `${removedOwner} must stay removed`);
}

const sourceFiles = walk(resolve(ROOT, "src")).filter((file) =>
  [".ts", ".tsx", ".json"].includes(extname(file)),
);
const legacySourceReferences = sourceFiles.filter((file) => readFileSync(file, "utf8").includes("media_items"));
assert.deepEqual(
  legacySourceReferences.map((file) => relative(ROOT, file).replaceAll("\\", "/")),
  [],
  "runtime source must not retain the media_items owner",
);

const envExample = read(".env.example");
assert.ok(!envExample.includes("PUBLIC_MEDIA_CONTENT_SOURCE"));
assert.ok(!envExample.includes("PUBLIC_MEDIA_LEGACY_FALLBACK"));

const types = read("src/lib/media-center/types.ts");
const provider = read("src/lib/media-center/unified-provider.ts");
const publicOwner = read("src/lib/media-center.ts");
const publicContentOwner = read("src/lib/content/public-content-read/owner.ts");
assert.ok(types.includes('Exclude<ContentType, "article">'), "Public Media must reuse the Unified Content type contract");
assert.ok(types.includes("resolvePublicContentPath(item.type, item.slug)"), "Public Media links must use the shared content path owner");
assert.ok(provider.includes("loadPublicContentCollection") && !provider.includes('.from("topics")'));
assert.ok(publicContentOwner.includes('.from("topics")') && !publicContentOwner.includes("media_items"));
assert.ok(!publicOwner.includes("legacy") && !publicOwner.includes("PUBLIC_MEDIA_"));

const detailLinkPattern = /\/media-center\/(?:news|videos|gallery|press|site-updates)\/\$\{/;
const mediaComponents = walk(resolve(ROOT, "src/components/media-center"))
  .filter((file) => [".ts", ".tsx"].includes(extname(file)));
for (const component of mediaComponents) {
  const componentSource = readFileSync(component, "utf8");
  assert.ok(
    !detailLinkPattern.test(componentSource),
    `${relative(ROOT, component)} contains a parallel media detail link resolver`,
  );
  if (componentSource.includes('"use client"') || componentSource.includes("'use client'")) {
    assert.ok(
      !/from\s+["']\.\.\/\.\.\/lib\/media-center["']/.test(componentSource),
      `${relative(ROOT, component)} imports the server loader barrel across the client boundary`,
    );
  }
}

const metadata = read("src/lib/media-center/generate-media-detail-metadata.ts");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const revalidation = read("src/lib/media-center/revalidate-public-paths.ts");
const mediaPayloadOwner = read("src/lib/admin/media-topic-payload.ts");
const publicMediaArticle = read("src/components/media-center/MediaDetailArticle.tsx");
const publicMediaPlayback = read("src/components/media-center/MediaVideoPlayback.tsx");
function hasSharedPublicVideoOwner(article: string, playback: string) {
  return article.match(/\bimport\s*\{\s*MediaVideoPlayback\s*\}\s*from\s*["']\.\/MediaVideoPlayback["']/gu)?.length === 1 &&
    article.match(/\bexport\s*\{\s*MediaVideoPlayback\s*\}\s*from\s*["']\.\/MediaVideoPlayback["']/gu)?.length === 1 &&
    article.includes('<MediaVideoPlayback item={item} metaEmbed={metaEmbed} />') &&
    !article.includes("function MediaVideoPlayback") && playback.match(/export function MediaVideoPlayback\(/gu)?.length === 1;
}
assert.ok(metadata.includes("getMediaItemBySlug"), "Metadata must consume the public media owner");
assert.ok(sitemap.includes("loadPublicContentSitemapRows") && sitemap.includes("item.href"));
assert.ok(revalidation.includes("revalidateMediaCenterCache") && revalidation.includes("MEDIA_CENTER_PUBLIC_PATHS"));
assert.ok(mediaPayloadOwner.includes("export function resolveYouTubeEmbedUrl"), "Video link resolution must stay in the existing payload owner");
assert.ok(publicContentOwner.includes("parseMediaTopicPayload(row.media_payload)"), "Public Content must narrow Database JSON through the existing payload owner");
assert.ok(publicContentOwner.includes("normalizeVideoUrl(video.provider, video.video_url)") && publicContentOwner.includes("validateVideoPayload(video, { published: true })"), "Unified Content must reject invalid provider-aware video URLs at its public detail boundary");
assert.ok(hasSharedPublicVideoOwner(publicMediaArticle, publicMediaPlayback), "Public Article must render and retain the stable re-export of its one canonical shared playback owner");
for (const invalid of [
  publicMediaArticle.replace('import { MediaVideoPlayback } from "./MediaVideoPlayback";', 'import { MediaVideoPlayback } from "./ParallelPlayback";'),
  publicMediaArticle.replace('export { MediaVideoPlayback } from "./MediaVideoPlayback";', ""),
  publicMediaArticle.replace('metaEmbed={metaEmbed}', 'metaEmbed={undefined}'),
  publicMediaArticle + "\nfunction MediaVideoPlayback() {}",
]) assert.ok(invalid !== publicMediaArticle && !hasSharedPublicVideoOwner(invalid, publicMediaPlayback), "Public playback source fixtures reject parallel owners, lost re-export, detached approval and local implementations");
assert.ok(publicMediaPlayback.includes("resolveVideoPlayback({") && publicMediaPlayback.includes('provider: item.videoProvider ?? "youtube"'), "Public playback must use the canonical provider descriptor with the existing YouTube legacy default");
assert.ok(publicMediaPlayback.includes('playback.mode === "external"') && publicMediaPlayback.includes("href={playback.sourceUrl}") && publicMediaPlayback.includes('rel="noopener noreferrer"'), "External-only providers need a secure honest source action");
assert.ok(publicMediaPlayback.includes("src={playback.directUrl}") && publicMediaPlayback.includes("object-contain") && !publicMediaPlayback.includes("autoPlay"), "Direct playback must retain controls, uncropped content and no autoplay");
assert.ok(publicMediaPlayback.includes("data-public-media-video-unavailable"), "Missing video links need an explicit public fail-safe state");
assert.ok(!publicMediaPlayback.includes("item.videoUrl || item.image"), "The video player must not receive an image URL as a playback fallback");

const links = read("src/lib/admin/links/providers/resources.ts");
const linkTypes = read("src/lib/admin/links/types.ts");
assert.ok(links.includes("resolvePublicContentPath(row.content_type, row.slug)"));
assert.ok(!links.includes("mediaLinkProvider") && !linkTypes.includes('"media_items"'));

const diagnostics = read("src/lib/seo/run-global-seo-health.ts");
const closureProof = read("src/lib/seo/public-media-closure-proof.ts");
assert.ok(diagnostics.includes('supabase.rpc("public_media_closure_provenance")')
  && diagnostics.includes("evaluatePublicMediaClosureProof({")
  && closureProof.includes("historical-evidence-compatible")
  && closureProof.includes("validated-empty-legacy")
  && closureProof.includes('error.code === "PGRST202"')
  && closureProof.includes("value.migration_registered !== true")
  && closureProof.includes("value.structural_complete !== true")
  && closureProof.includes("value.historical_audit_total !== expectedTotal"),
"Global SEO must distinguish completed empty initialization from historical evidence without inferring the path from zero counts");
for (const check of [
  "public_media_single_source",
  "public_media_module_contract",
  "public_media_link_contract",
  "public_media_category_migration_audit_evidence",
  "public_media_migration_audit_evidence",
  "public_media_seo_normalization_evidence",
  "public_media_editorial_contract",
  "public_media_playable_video_data",
]) {
  assert.ok(diagnostics.includes(check), `Diagnostics is missing ${check}`);
}

const migration = read("sql/migrations/20260804180000_public_media_truth_closure.sql");
for (const proof of [
  "Public Media Truth backfill refused",
  "Public Media Truth row parity failed",
  "insert into public.topics",
  "public_media_migration_map",
  "drop table public.media_items",
  "drop table public.media_categories",
  "public_media_single_source",
  "public_media_seo_normalization_evidence",
  "public_media.seo_title_normalized",
  "public_media.legacy_item_migrated",
  "public_media.legacy_category_migrated",
  "Public Media Truth category parity failed",
  "original_seo_title",
  "normalized_seo_title",
  "expected 14 over-limit titles",
]) {
  assert.ok(migration.includes(proof), `Migration is missing ${proof}`);
}

const manifest = JSON.parse(read("src/lib/admin/media-catalog/write-adoption-manifest.json"));
assert.ok(manifest.providerRegistry.some((provider: { domainKey: string }) => provider.domainKey === "topics"));
assert.ok(!manifest.providerRegistry.some((provider: { domainKey: string }) => provider.domainKey === "legacy_media_items"));

console.log("PASS Public Media Truth: one topics source, one content/link contract, shared metadata/sitemap/cache consumers, diagnostics, and guarded legacy removal.");

// The shared renderer must not invent a legacy image for empty authored content.
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, jsx: { runtime: "automatic" } });
const { default: PublicMediaImage, PUBLIC_MEDIA_IMAGE_FALLBACK } = await jiti.import<typeof import("../src/components/public/PublicMediaImage")>("../src/components/public/PublicMediaImage.tsx");
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
assert.equal(PUBLIC_MEDIA_IMAGE_FALLBACK, null);
assert.equal(renderToStaticMarkup(createElement(PublicMediaImage, { src: "", alt: "No authored image", width: 20, height: 20 })), "");
console.log("PASS shared Public Media renderer keeps absent authored images absent.");
