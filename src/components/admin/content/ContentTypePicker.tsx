import Link from "next/link";
import { CONTENT_TYPE_OPTIONS } from "../../../lib/admin/content/content-types";

export default function ContentTypePicker() {
  return (
    <section className="rounded-[24px] border border-[#D8B87A]/14 bg-[#080B10]/88 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <p className="text-sm text-white/55">اختر نوع المحتوى أولًا لفتح المحرر المتخصص المناسب.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_TYPE_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/content/topics/new?type=${option.value}`}
            className="rounded-[16px] border border-white/10 bg-black/20 px-4 py-4 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/8"
          >
            <span className="block text-base font-semibold text-white">{option.label}</span>
            <span className="mt-1 block font-en text-xs text-white/35">{option.value}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
