import type { MediaSlotContract } from "../../../lib/media/media-slot-contract";
import { ADMIN_MEDIA_DIMENSION_DISCLOSURE } from "../../../lib/admin/admin-ui-styles";

/** Admin shows only the practical size; technical guidance stays in the presentation contract. */
export default function AdminMediaSlotGuidance({ slot, className, presentation = "default" }: { slot?: MediaSlotContract; className?: string; presentation?: "default" | "disclosure" }) {
  if (!slot || slot.design?.kind !== "recommended") return null;
  if (presentation === "disclosure") return <details data-admin-media-dimension="recommended" data-media-slot-owner={slot.owner} data-media-slot={slot.slot} data-media-slot-device={slot.device} className={ADMIN_MEDIA_DIMENSION_DISCLOSURE.root}>
    <summary className={ADMIN_MEDIA_DIMENSION_DISCLOSURE.summary}>الموصى به</summary>
    <p className={ADMIN_MEDIA_DIMENSION_DISCLOSURE.value} title="الأبعاد بوحدة البكسل (px)" aria-label={`${slot.design.width} × ${slot.design.height} px`}><bdi>{slot.design.width}×{slot.design.height}<span className="hidden @min-[7rem]/media-dimension:inline"> px</span></bdi></p>
  </details>;
  return <p data-media-slot-owner={slot.owner} data-media-slot={slot.slot} data-media-slot-device={slot.device} className={className ?? "text-xs leading-6 text-amber-600 dark:text-[#D8B87A]/75"}>
    المقاس التصميمي الموصى به: <bdi>{slot.design.width} × {slot.design.height} px</bdi>
  </p>;
}
