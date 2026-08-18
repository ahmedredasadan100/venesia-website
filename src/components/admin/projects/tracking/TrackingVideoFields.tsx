"use client";

import { useState } from "react";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { adminFormFieldClassName } from "../../ui";
import type { TrackingMediaAdminRow } from "../../../../lib/admin/projects/tracking-contract";

type VideoDraft = {
  client_key: string;
  url: string;
  poster_url: string;
  title: string;
};

export default function TrackingVideoFields({ media }: { media: TrackingMediaAdminRow[] }) {
  const [videos, setVideos] = useState<VideoDraft[]>(() => media.filter((item) => item.media_kind === "video").map((item) => ({ client_key: item.client_key, url: item.public_url, poster_url: item.poster_url ?? "", title: item.title ?? "" })));
  const update = (key: string, patch: Partial<VideoDraft>) => setVideos((current) => current.map((video) => video.client_key === key ? { ...video, ...patch } : video));

  return (
    <div className="space-y-3" data-project-tracking-video-fields>
      <input type="hidden" name="videos_json" value={JSON.stringify(videos)} />
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-white">الفيديوهات</h3><p className="mt-1 text-xs text-white/42">الرابط يبقى External Video وفق العقد الحالي، وصورة الغلاف تُختار من Media Catalog.</p></div>
        <button type="button" onClick={() => setVideos((current) => [...current, { client_key: crypto.randomUUID(), url: "", poster_url: "", title: "" }])} className="rounded-xl border border-[#D8B87A]/35 px-4 py-2 text-xs font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10">إضافة فيديو</button>
      </div>
      {videos.map((video, index) => (
        <div key={video.client_key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between"><strong className="text-sm text-[#D8B87A]">فيديو {index + 1}</strong><button type="button" onClick={() => setVideos((current) => current.filter((item) => item.client_key !== video.client_key))} className="text-xs text-red-300 hover:text-red-200">إزالة</button></div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="space-y-2"><span className="text-xs text-white/55">رابط الفيديو</span><input dir="ltr" type="url" required value={video.url} onChange={(event) => update(video.client_key, { url: event.target.value })} className={adminFormFieldClassName("font-mono text-xs")} placeholder="https://..." /></label>
            <label className="space-y-2"><span className="text-xs text-white/55">عنوان اختياري</span><input value={video.title} onChange={(event) => update(video.client_key, { title: event.target.value })} className={adminFormFieldClassName()} /></label>
          </div>
          <div className="mt-4 max-w-xs"><AdminMediaImageField name={`poster_${video.client_key}`} label="غلاف الفيديو" defaultValue={video.poster_url} dimensionHint="content" variant="compact" onValueChange={(value) => update(video.client_key, { poster_url: value })} /></div>
        </div>
      ))}
      {!videos.length ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">لا توجد فيديوهات في هذا التحديث.</p> : null}
    </div>
  );
}
