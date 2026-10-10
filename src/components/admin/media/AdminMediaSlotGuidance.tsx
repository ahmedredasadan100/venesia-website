import { mediaSlotGuidance, type MediaSlotContract } from "../../../lib/media/media-slot-contract";

/** The field receives the selected presentation's slot; it knows no template names. */
export default function AdminMediaSlotGuidance({ slot }: { slot?: MediaSlotContract }) {
  if (!slot) return null;
  return <div data-media-slot-owner={slot.owner} data-media-slot={slot.slot} data-media-slot-device={slot.device} className="space-y-1 text-xs leading-6 text-amber-600 dark:text-[#D8B87A]/75">
    {mediaSlotGuidance(slot).map(line => <p key={line}>{line}</p>)}
  </div>;
}
