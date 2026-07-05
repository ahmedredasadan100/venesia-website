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
    <span
      className={[
        "inline-flex max-w-full min-w-[72px] justify-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold",
        getMediaContentTypeBadgeClassName(contentType),
      ].join(" ")}
    >
      {text}
    </span>
  );
}
