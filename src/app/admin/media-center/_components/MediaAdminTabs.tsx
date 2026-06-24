import Link from "next/link";
import { MEDIA_TYPE_CONFIG, MEDIA_TYPES, type MediaAdminType, getMediaAdminPath } from "./media-admin-config";

type MediaAdminTabsProps = {
  activeType?: MediaAdminType | null;
};

export default function MediaAdminTabs({ activeType }: MediaAdminTabsProps) {
  const tabClass = (active: boolean) =>
    active
      ? "rounded-full bg-[#D8B87A] px-4 py-2 text-sm font-semibold text-[#06101C]"
      : "rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-4">
      <Link href="/admin/media-center" className={tabClass(!activeType)}>
        الكل
      </Link>

      {MEDIA_TYPES.map((type) => (
        <Link key={type} href={getMediaAdminPath(type)} className={tabClass(activeType === type)}>
          {MEDIA_TYPE_CONFIG[type].plural}
        </Link>
      ))}

      <Link
        href="/admin/media-center/categories"
        className="mr-auto rounded-full border border-[#D8B87A]/35 px-4 py-2 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
      >
        إدارة التصنيفات
      </Link>
    </div>
  );
}
