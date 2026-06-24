import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";

type TrackPageContentProps = {
  composition: PageComposition;
};

export default function TrackPageContent({ composition }: TrackPageContentProps) {
  return (
    <main dir="rtl" className="relative z-10 overflow-hidden bg-[#03070b] text-white">
      <PageSlotLayout composition={composition} />
    </main>
  );
}
