import type { MediaSlotContract } from "../../../lib/media/media-slot-contract";

/** Admin shows only the practical size; technical guidance stays in the presentation contract. */
export default function AdminMediaSlotGuidance({ slot }: { slot?: MediaSlotContract }) {
  if (!slot || slot.design?.kind !== "recommended") return null;
  return <p data-media-slot-owner={slot.owner} data-media-slot={slot.slot} data-media-slot-device={slot.device} className="text-xs leading-6 text-amber-600 dark:text-[#D8B87A]/75">
    المقاس التصميمي الموصى به: <bdi>{slot.design.width} × {slot.design.height} px</bdi>
  </p>;
}
