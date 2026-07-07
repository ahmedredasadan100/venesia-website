"use client";

import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import RevealAnimations from "../RevealAnimations";
import PageSlotLayout from "../page-composition/PageSlotLayout";

type AboutPageContentProps = {
  composition: PageComposition;
};

export default function AboutPageContent({ composition }: AboutPageContentProps) {
  return (
    <main className="relative z-10">
      <RevealAnimations />
      <PageSlotLayout composition={composition} />
    </main>
  );
}
