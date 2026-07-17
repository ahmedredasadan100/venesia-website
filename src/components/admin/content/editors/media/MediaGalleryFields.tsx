"use client";

import { useState } from "react";

type GalleryImageValues = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

type MediaGalleryFieldsProps = {
  defaultImages?: GalleryImageValues[];
};

const EMPTY_ROW: GalleryImageValues = { url: "", alt: "", caption: "" };

export default function MediaGalleryFields({ defaultImages = [] }: MediaGalleryFieldsProps) {
  const [rows, setRows] = useState<GalleryImageValues[]>(
    defaultImages.length > 0 ? defaultImages : [{ ...EMPTY_ROW }],
  );

  function addRow() {
    setRows((current) => [...current, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function updateRow(index: number, field: keyof GalleryImageValues, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">صور المعرض</h3>
          <p className="mt-1 text-sm text-white/45">أضف رابطًا واحدًا على الأقل قبل النشر.</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#D8B87A]/35 hover:text-white"
        >
          إضافة صورة
        </button>
      </div>

      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={`gallery-row-${index}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white/70">صورة {index + 1}</span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-sm text-red-300/80 transition hover:text-red-200"
                >
                  حذف
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="text-sm font-medium text-white/70">رابط الصورة</span>
                <input
                  name="gallery_image_url"
                  value={row.url}
                  onChange={(event) => updateRow(index, "url", event.target.value)}
                  placeholder="/images/topics/example.jpg"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/70">النص البديل (alt)</span>
                <input
                  name="gallery_image_alt"
                  value={row.alt ?? ""}
                  onChange={(event) => updateRow(index, "alt", event.target.value)}
                  placeholder="وصف مختصر للصورة"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/70">التعليق (caption)</span>
                <input
                  name="gallery_image_caption"
                  value={row.caption ?? ""}
                  onChange={(event) => updateRow(index, "caption", event.target.value)}
                  placeholder="تعليق اختياري"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
