"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  resolveMetaVideoEmbedRequest,
  resolveVideoPlayback,
  VIDEO_PROVIDERS,
  type MetaVideoEmbedResult,
  type VideoMediaPayload,
} from "../../lib/admin/media-topic-payload";
import type { MediaContentItem } from "../../lib/media-center/types";

type MetaPayload = Pick<VideoMediaPayload, "provider" | "video_url">;
type FacebookInstance = {
  pause: () => void;
  subscribe: (event: string, callback: () => void) => { release: () => void };
};
type FacebookReady = { type: string; id: string; instance: FacebookInstance };
type MetaWindow = Window & {
  fbAsyncInit?: () => void;
  FB?: {
    XFBML: { parse: (container: HTMLElement) => void };
    Event: {
      subscribe: (event: string, callback: (message: FacebookReady) => void) => void;
      unsubscribe: (event: string, callback: (message: FacebookReady) => void) => void;
    };
  };
  instgrm?: { Embeds: { process: () => void } };
};

const sdkLoads = new Map<string, Promise<void>>();

/** Only the fixed official SDK URL supplied by the canonical provider owner is loaded. */
function loadMetaSdk(src: string, provider: "facebook" | "instagram"): Promise<void> {
  const existing = sdkLoads.get(src);
  if (existing) return existing;
  const pending = (async () => {
    if (provider === "facebook") {
      // Meta's official integration initializes Instagram first. Its loader otherwise
      // skips initialization after Facebook, breaking later provider/SPA navigation.
      const instagram = VIDEO_PROVIDERS.find((entry) => entry.value === "instagram");
      if (!instagram) throw new Error("Instagram provider unavailable");
      await loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram");
      if (!(window as MetaWindow).instgrm?.Embeds) throw new Error("Instagram SDK unavailable");
    }
    await new Promise<void>((resolve, reject) => {
      const sdkWindow = window as MetaWindow;
      const previousInit = sdkWindow.fbAsyncInit;
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      const restore = () => {
        if (sdkWindow.fbAsyncInit === onFacebookReady) sdkWindow.fbAsyncInit = previousInit;
      };
      const ready = () => { window.clearTimeout(timer); restore(); resolve(); };
      const onFacebookReady = () => { try { previousInit?.(); } finally { ready(); } };
      const timer = window.setTimeout(() => {
        restore();
        script.remove();
        reject(new Error("Meta SDK timeout"));
      }, 12000);
      if (provider === "facebook") sdkWindow.fbAsyncInit = onFacebookReady;
      // Facebook's loader fetches another bundle: its load event is not SDK readiness.
      script.onload = () => { if (provider === "instagram") ready(); };
      script.onerror = () => {
        window.clearTimeout(timer);
        restore();
        script.remove();
        reject(new Error("Meta SDK unavailable"));
      };
      document.head.append(script);
    });
  })();
  sdkLoads.set(src, pending);
  void pending.catch(() => sdkLoads.delete(src));
  return pending;
}

export function MediaVideoPlayback({
  item,
  metaEmbed,
  requestMetaEmbed,
}: {
  item: Pick<MediaContentItem, "title" | "videoUrl"> & Partial<Pick<MediaContentItem, "videoProvider" | "videoStartSeconds" | "image">>;
  /** Explicit public/saved-preview opt-in; omitted consumers retain the external default. */
  metaEmbed?: MetaVideoEmbedResult;
  /** Authenticated Media editor read port; never saves or changes the form model. */
  requestMetaEmbed?: (payload: MetaPayload) => Promise<MetaVideoEmbedResult>;
}) {
  const playback = resolveVideoPlayback({
    provider: item.videoProvider ?? "youtube",
    video_url: item.videoUrl ?? "",
    start_seconds: item.videoStartSeconds ?? 0,
  });
  const request = playback ? resolveMetaVideoEmbedRequest({
    provider: playback.provider,
    video_url: playback.sourceUrl,
  }) : null;
  const provider = request?.provider;
  const sourceUrl = request?.sourceUrl;
  const sdkUrl = request?.sdkUrl;
  const minWidth = request?.minWidth ?? 0;
  const requestKey = provider && sourceUrl ? `${provider}:${sourceUrl}` : "";
  const optedIn = Boolean(metaEmbed || requestMetaEmbed);
  const [response, setResponse] = useState<{ key: string; result: MetaVideoEmbedResult } | null>(null);
  const checked = metaEmbed ?? (response?.key === requestKey ? response.result : undefined);
  const approved = checked?.status === "ready" && checked.provider === provider && checked.sourceUrl === sourceUrl;
  const rejected = Boolean(checked && !approved);
  const hostRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [sdkState, setSdkState] = useState<{ key: string; state: "loading" | "mounted" | "unavailable" } | null>(null);
  // A new media identity may retry; geometry changes must not revive a failed SDK.
  if (sdkState && (!optedIn || sdkState.key !== requestKey)) setSdkState(null);
  const mediaId = `meta-video-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fits = width !== null && width >= minWidth;
  const renderWidth = Math.floor(width ?? 0);
  const embedState = sdkState?.key === requestKey ? sdkState.state : "loading";
  const embedEligible = Boolean(optedIn && approved && fits && embedState !== "unavailable");

  useEffect(() => {
    if (!provider || !sourceUrl || !requestMetaEmbed || metaEmbed) return;
    let active = true;
    // A live URL can change on every keystroke; only a settled canonical URL is requested.
    const timer = window.setTimeout(() => {
      void requestMetaEmbed({ provider, video_url: sourceUrl }).then(
        (result) => { if (active) setResponse({ key: requestKey, result }); },
        () => { if (active) setResponse({ key: requestKey, result: { status: "unavailable", reason: "network" } }); },
      );
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [provider, sourceUrl, requestKey, requestMetaEmbed, metaEmbed]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !optedIn || !requestKey) return;
    const measure = () => setWidth(host.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [optedIn, requestKey]);

  useEffect(() => {
    const container = embedRef.current;
    if (!embedEligible || !container || !provider || !sourceUrl || !sdkUrl) return;
    let active = true;
    let instance: FacebookInstance | undefined;
    let releaseError: { release: () => void } | undefined;
    let readyHandler: ((message: FacebookReady) => void) | undefined;
    const sdkWindow = window as MetaWindow;
    const setState = (state: "mounted" | "unavailable") => {
      if (!active) return;
      if (state === "unavailable") {
        active = false;
        window.clearTimeout(timer);
        observer.disconnect();
        if (readyHandler) sdkWindow.FB?.Event.unsubscribe("xfbml.ready", readyHandler);
        readyHandler = undefined;
        releaseError?.release();
        releaseError = undefined;
        try { instance?.pause(); } catch { /* The provider may already have removed its player. */ }
        instance = undefined;
        container.replaceChildren();
      }
      setSdkState({ key: requestKey, state });
    };
    const timer = window.setTimeout(() => setState("unavailable"), 30000);
    const mounted = () => { window.clearTimeout(timer); setState("mounted"); };
    const observer = new MutationObserver(() => {
      const iframe = container.querySelector("iframe");
      if (iframe) {
        iframe.title = `تشغيل ${item.title}`;
        iframe.addEventListener("load", mounted, { once: true });
        iframe.addEventListener("error", () => setState("unavailable"), { once: true });
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    if (provider === "facebook" && !document.getElementById("fb-root")) {
      const sdkRoot = document.createElement("div");
      sdkRoot.id = "fb-root";
      document.body.append(sdkRoot);
    }
    void loadMetaSdk(sdkUrl, provider).then(() => {
      if (!active) return;
      // Reconstruct only inert, approved SDK markup. Response HTML is never inserted.
      const media = document.createElement(provider === "facebook" ? "div" : "blockquote");
      media.id = mediaId;
      const link = document.createElement("a");
      link.href = sourceUrl;
      link.textContent = "فتح مصدر الفيديو";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (provider === "facebook") {
        const fb = sdkWindow.FB;
        if (!fb?.XFBML || !fb.Event) throw new Error("Facebook SDK unavailable");
        media.className = "fb-video";
        media.dataset.href = sourceUrl;
        media.dataset.width = String(renderWidth);
        media.dataset.showText = "false";
        media.dataset.autoplay = "false";
        media.dataset.allowfullscreen = "true";
        const fallback = document.createElement("blockquote");
        fallback.className = "fb-xfbml-parse-ignore";
        fallback.append(link);
        media.append(fallback);
        readyHandler = (message) => {
          if (!active || message.type !== "video" || message.id !== mediaId) return;
          instance = message.instance;
          releaseError = instance.subscribe("error", () => setState("unavailable"));
          mounted();
        };
        fb.Event.subscribe("xfbml.ready", readyHandler);
        container.replaceChildren(media);
        fb.XFBML.parse(container);
      } else {
        if (!sdkWindow.instgrm?.Embeds) throw new Error("Instagram SDK unavailable");
        media.className = "instagram-media";
        media.dataset.instgrmPermalink = sourceUrl;
        media.dataset.instgrmVersion = "14";
        media.append(link);
        container.replaceChildren(media);
        sdkWindow.instgrm.Embeds.process();
      }
    }).catch(() => setState("unavailable"));
    return () => {
      active = false;
      window.clearTimeout(timer);
      observer.disconnect();
      if (readyHandler) sdkWindow.FB?.Event.unsubscribe("xfbml.ready", readyHandler);
      releaseError?.release();
      try { instance?.pause(); } catch { /* The provider may already have removed its player. */ }
      container.replaceChildren();
    };
  }, [embedEligible, provider, sourceUrl, sdkUrl, requestKey, mediaId, item.title, renderWidth]);

  if (!playback) {
    return (
      <div role="status" data-public-media-video-unavailable className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.06] px-6 py-5 text-sm leading-7 text-amber-100/80">
        الفيديو غير متاح للتشغيل حاليًا. تظل تفاصيل المحتوى والصورة المنشورة متاحة.
      </div>
    );
  }

  return (
    <div ref={hostRef} className="min-w-0 space-y-3" data-public-media-video-provider={playback.provider} data-public-media-video-mode={embedEligible ? "meta-sdk" : playback.mode} data-meta-embed-state={optedIn && requestKey ? (!fits && width !== null ? "narrow" : rejected || embedState === "unavailable" ? "unavailable" : embedEligible ? embedState : "loading") : undefined}>
      {playback.mode === "external" ? (
        <>
          {embedEligible ? <div ref={embedRef} dir="ltr" hidden={embedState === "unavailable"} data-meta-video-embed /> : null}
          {!embedEligible || embedState !== "mounted" ? (
            <p role="status" className="rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-4 text-sm leading-7 text-white/60">
              {optedIn && requestKey && !fits && width !== null
                ? "مساحة العرض أضيق من الحد الذي يدعمه المزود. يمكنك فتح الفيديو من مصدره."
                : optedIn && requestKey && !rejected && embedState !== "unavailable"
                  ? "جارٍ التحقق من إتاحة التضمين الرسمي. يمكنك فتح المصدر مباشرة."
                  : "تتوفر مشاهدة الفيديو عبر المصدر الخارجي. قد يتطلب فتح الفيديو تسجيل الدخول أو السماح بعرضه من إعدادات الخصوصية."}
            </p>
          ) : null}
        </>
      ) : (
        <div className={`${playback.portrait ? "mx-auto aspect-[9/16] w-full max-w-sm" : "aspect-video"} overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30`}>
          {playback.mode === "direct" && playback.directUrl ? (
            <video key={playback.directUrl} src={playback.directUrl} poster={item.image || undefined} controls playsInline preload="none" className="h-full w-full object-contain" aria-label={`تشغيل ${item.title}`} />
          ) : playback.embedUrl ? (
            <iframe key={playback.embedUrl} src={playback.embedUrl} title={`تشغيل ${item.title}`} className="h-full w-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-6 text-white/50">
        {playback.mode !== "external" || embedEligible ? <p>{playback.mode === "direct" ? "إذا تعذر تشغيل الملف في المتصفح، يمكنك فتح المصدر مباشرة." : "قد يمنع المزود التضمين أو يتعذر تشغيل المحتوى. يمكنك فتح المصدر مباشرة."}</p> : null}
        <a href={playback.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-4 py-1.5 text-[#D8B87A] transition hover:border-[#D8B87A]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]">فتح مصدر الفيديو</a>
      </div>
    </div>
  );
}
