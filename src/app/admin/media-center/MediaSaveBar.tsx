import Link from "next/link";
import { getMediaAdminPath, getPublicMediaPath, type MediaAdminType } from "./_components/media-admin-config";

type MediaSaveBarProps = {
  itemId: number | string;
  type: MediaAdminType;
  slug?: string | null;
  status?: string | null;
  saveAction: (formData: FormData) => void;
  saveAndCloseAction: (formData: FormData) => void;
  draftAction: (formData: FormData) => void;
  publishAction: (formData: FormData) => void;
  unpublishAction: (formData: FormData) => void;
};

export default function MediaSaveBar({
  itemId,
  type,
  slug,
  status,
  saveAction,
  saveAndCloseAction,
  draftAction,
  publishAction,
  unpublishAction,
}: MediaSaveBarProps) {
  const isPublished = status === "published";
  const listPath = getMediaAdminPath(type);

  return (
    <div className="sticky bottom-5 z-40 mt-8 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">إدارة الحفظ والنشر</p>
          <p className="mt-1 text-xs text-white/45">
            أزرار النشر تحفظ بيانات الفورم الحالية أولًا؛ لا يوجد نشر فوق نسخة قديمة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            formAction={saveAction}
            className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ
          </button>

          <button
            type="submit"
            formAction={saveAndCloseAction}
            className="rounded-full border border-[#D8B87A]/35 px-6 py-3 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
          >
            حفظ وإغلاق
          </button>

          <Link
            href={listPath}
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/65 transition hover:border-white/30 hover:text-white"
          >
            إغلاق
          </Link>

          <button
            type="submit"
            formAction={draftAction}
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white/45 transition hover:border-white/25 hover:text-white"
          >
            حفظ كمسودة
          </button>

          {isPublished ? (
            <button
              type="submit"
              formAction={unpublishAction}
              className="rounded-full border border-[#D8B87A]/35 px-6 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              إخفاء العنصر
            </button>
          ) : (
            <button
              type="submit"
              formAction={publishAction}
              className="rounded-full border border-emerald-400/30 px-6 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/10"
            >
              نشر العنصر
            </button>
          )}

          <Link
            href={`/admin/media-center/items/${itemId}/preview`}
            target="_blank"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          >
            معاينة داخلية
          </Link>

          {slug ? (
            <Link
              href={getPublicMediaPath(type, slug)}
              target="_blank"
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white/45 transition hover:border-white/25 hover:text-white"
            >
              النسخة العامة
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
