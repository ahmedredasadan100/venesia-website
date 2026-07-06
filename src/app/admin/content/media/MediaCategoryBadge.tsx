import AdminToneBadge from "../../../../components/admin/ui/AdminToneBadge";
import { getMediaContentTypeBadgeClassName } from "./media-content-type-style";

export default function MediaCategoryBadge({
  label,
  contentType,
}: {
  label?: string | null;
  contentType?: string | null;
}) {
  const text = label?.trim() || "—";

  return (
    <AdminToneBadge
      toneClassName={getMediaContentTypeBadgeClassName(contentType)}
      className="max-w-full min-w-[72px] truncate px-2.5 py-1 text-xs"
    >
      {text}
    </AdminToneBadge>
  );
}
