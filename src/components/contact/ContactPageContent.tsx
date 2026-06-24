import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";

type ContactPageContentProps = {
  composition: PageComposition;
};

export default function ContactPageContent({ composition }: ContactPageContentProps) {
  return (
    <main dir="rtl" className="overflow-hidden bg-[#03070b] text-white">
      <PageSlotLayout composition={composition} />
    </main>
  );
}
