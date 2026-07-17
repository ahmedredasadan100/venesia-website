import AdminToneBadge from "../ui/AdminToneBadge";
import { resolveAdminTone } from "../../../lib/admin/content/admin-tone-palette";

type AdminCategoryBadgeProps = {
  name?: string | null;
  colorToken?: string | null;
  className?: string;
};

export default function AdminCategoryBadge({
  name,
  colorToken,
  className = "",
}: AdminCategoryBadgeProps) {
  const tone = resolveAdminTone(colorToken);

  return (
    <AdminToneBadge
      toneClassName={tone.className}
      className={`max-w-full whitespace-nowrap px-2.5 py-1 text-xs ${className}`}
    >
      <span className="truncate" title={name || "غير مصنف"}>
        {name || "غير مصنف"}
      </span>
    </AdminToneBadge>
  );
}
