import Link from "next/link";
import { AdminActionButton } from "../../../../components/admin/ui";
import { MEDIA_EDITABLE_CONTENT_TYPES, getContentTypeLabel } from "./media-content-config";

type MediaListNavPanelProps = {
  activeContentType: string;
};

function buildFilterHref(contentType: string) {
  if (contentType === "all") return "/admin/content/media";
  return `/admin/content/media?content_type=${encodeURIComponent(contentType)}`;
}

export default function MediaListNavPanel({ activeContentType }: MediaListNavPanelProps) {
  const items = [
    { value: "all", label: "كل الأنواع" },
    ...MEDIA_EDITABLE_CONTENT_TYPES.map((type) => ({
      value: type,
      label: getContentTypeLabel(type),
    })),
  ];

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/12 bg-[#080B10]/78 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-en text-[10px] tracking-[0.28em] text-[#D8B87A]/70">MEDIA SECTIONS</p>
          <p className="mt-1 text-sm text-white/55">انتقل سريعًا بين أقسام المركز الإعلامي أو افتح إدارة التصنيفات.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => {
            const active = activeContentType === item.value;
            return (
              <Link
                key={item.value}
                href={buildFilterHref(item.value)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[#D8B87A]/40 bg-[#D8B87A]/14 text-[#F4D99A] shadow-[0_0_22px_rgba(216,184,122,0.10)]"
                    : "border-white/10 bg-black/20 text-white/58 hover:border-[#D8B87A]/24 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <AdminActionButton href="/admin/topics/categories" variant="dark">
          إدارة التصنيفات
        </AdminActionButton>
      </div>
    </section>
  );
}
