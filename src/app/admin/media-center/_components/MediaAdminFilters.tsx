"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MediaAdminTabs from "./MediaAdminTabs";
import type { MediaAdminType } from "./media-admin-config";

type Category = {
  name: string;
  slug: string;
};

type MediaAdminFiltersProps = {
  basePath: string;
  activeType?: MediaAdminType | null;
  q: string;
  status: string;
  category: string;
  sort: string;
  featured: string;
  popular: string;
  limit: string;
  categories: Category[];
  currentPage: number;
  totalPages: number;
};

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" d="M8 6h12M8 12h12M8 18h12" />
      <path strokeLinecap="round" d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  label,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  label: string;
  icon?: ReactNode;
}) {
  return (
    <label className="group relative inline-flex h-12 min-w-[178px] items-center overflow-hidden rounded-[10px] border border-white/10 bg-black/20 text-sm text-white/72 transition focus-within:border-[#D8B87A]/40 hover:border-white/18">
      <span className="pointer-events-none flex shrink-0 items-center gap-2 px-4 text-white/42">
        {icon ?? <ChevronDownIcon />}
        <span>{label}</span>
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-[120px] flex-1 appearance-none bg-transparent py-0 pl-8 pr-1 text-sm font-medium text-white outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue} className="bg-[#080B10] text-white">
            {optionLabel}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute left-3 text-white/45 transition group-focus-within:text-[#D8B87A]">
        <ChevronDownIcon />
      </span>
    </label>
  );
}

export default function MediaAdminFilters({
  basePath,
  activeType = null,
  q,
  status,
  category,
  sort,
  featured,
  popular,
  limit,
  categories,
  currentPage,
  totalPages,
}: MediaAdminFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });

    params.delete("page");

    const query = params.toString();
    router.push(query ? `${basePath}?${query}#media-table` : `${basePath}#media-table`);
  }

  function updateParam(key: string, value: string) {
    const shouldDelete =
      !value ||
      value === "all" ||
      (key === "sort" && value === "published_desc") ||
      (key === "limit" && value === "10");

    if (key === "limit" && value === "all") {
      pushParams({ limit: "all" });
      return;
    }

    pushParams({ [key]: shouldDelete ? null : value });
  }

  return (
    <section
      dir="rtl"
      className="rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl"
    >
      <MediaAdminTabs activeType={activeType} />

      <div className="mt-4 flex flex-wrap items-center justify-start gap-3">
        <form
          className="w-full xl:w-[520px]"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            updateParam("q", String(formData.get("q") ?? "").trim());
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث بالعنوان، الرابط، التصنيف أو المشروع..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45"
          />
        </form>

        <SelectBox
          value={sort}
          onChange={(value) => updateParam("sort", value)}
          label="ترتيب حسب"
          icon={<FilterIcon />}
          options={[
            ["published_desc", "الأحدث نشرًا"],
            ["published_asc", "الأقدم نشرًا"],
            ["created_desc", "الأحدث إنشاءً"],
            ["updated_desc", "آخر تعديل"],
            ["title_asc", "العنوان أ-ي"],
          ]}
        />

        <SelectBox
          value={status}
          onChange={(value) => updateParam("status", value)}
          label="الحالة"
          icon={<ChevronDownIcon />}
          options={[
            ["all", "كل الحالات"],
            ["published", "منشور"],
            ["draft", "مسودة"],
            ["unpublished", "مخفي"],
            ["archived", "أرشيف"],
          ]}
        />

        <SelectBox
          value={category}
          onChange={(value) => updateParam("category", value)}
          label="التصنيف"
          icon={<ListIcon />}
          options={[
            ["all", "كل التصنيفات"],
            ...categories.map((item) => [item.slug, item.name] as [string, string]),
          ]}
        />

        <SelectBox
          value={featured}
          onChange={(value) => updateParam("featured", value)}
          label="التمييز"
          options={[
            ["all", "الكل"],
            ["yes", "مميز"],
            ["no", "غير مميز"],
          ]}
        />

        <SelectBox
          value={popular}
          onChange={(value) => updateParam("popular", value)}
          label="الشيوع"
          options={[
            ["all", "الكل"],
            ["yes", "شائع"],
            ["no", "غير شائع"],
          ]}
        />

        <SelectBox
          value={limit}
          onChange={(value) => updateParam("limit", value)}
          label="العرض"
          options={[
            ["10", "عرض 10"],
            ["20", "عرض 20"],
            ["50", "عرض 50"],
            ["all", "عرض الكل"],
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <Link
          href={basePath}
          className="rounded-[10px] border border-white/10 bg-white/[0.035] px-5 py-2.5 text-sm text-white/55 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
        >
          تصفير الفلاتر
        </Link>

        <span className="rounded-full border border-[#D8B87A]/18 bg-[#D8B87A]/8 px-4 py-2 text-xs text-[#E6C882]">
          الصفحة {currentPage} من {totalPages}
        </span>
      </div>
    </section>
  );
}
